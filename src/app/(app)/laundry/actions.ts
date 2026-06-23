"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextLaundryBatchNumber } from "@/lib/sequence";

// --- Laundry item catalogue (spec 15.2) ---
export async function createLaundryItem(formData: FormData) {
  await requireSection("laundry");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.laundryItem.create({
    data: {
      name,
      category: String(formData.get("category") ?? "") || null,
      clientPrice: parseFloat(String(formData.get("clientPrice") ?? "0")) || 0,
      supplierCost: parseFloat(String(formData.get("supplierCost") ?? "0")) || 0,
      internalCost: parseFloat(String(formData.get("internalCost") ?? "0")) || 0,
    },
  });
  revalidatePath("/laundry/items");
}

export async function toggleLaundryItem(formData: FormData) {
  await requireSection("laundry");
  const id = String(formData.get("id"));
  const item = await db.laundryItem.findUnique({ where: { id } });
  if (item) await db.laundryItem.update({ where: { id }, data: { active: !item.active } });
  revalidatePath("/laundry/items");
}

interface BatchLinePayload {
  propertyId?: string;
  laundryItemId?: string;
  itemName: string;
  collectedQty: number;
}

// --- Create a collection batch (spec 15.4 / 15.5 / 15.6) ---
export async function createBatch(formData: FormData) {
  const user = await requireSection("laundry");
  const lines = JSON.parse(String(formData.get("lines") ?? "[]")) as BatchLinePayload[];
  const valid = lines.filter((l) => l.itemName && l.collectedQty > 0);
  if (valid.length === 0) redirect("/laundry/new?error=empty");

  const number = await nextLaundryBatchNumber();
  const batch = await db.laundryBatch.create({
    data: {
      number,
      status: "created",
      fulfilmentMode: String(formData.get("fulfilmentMode") ?? "outsourced"),
      supplierId: String(formData.get("supplierId") ?? "") || null,
      driverStaffId: String(formData.get("driverStaffId") ?? "") || null,
      workOrderId: String(formData.get("workOrderId") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      items: {
        create: valid.map((l) => ({
          propertyId: l.propertyId || null,
          laundryItemId: l.laundryItemId || null,
          itemName: l.itemName,
          collectedQty: Math.round(l.collectedQty),
        })),
      },
    },
  });
  await writeAudit({ actorId: user.id, entityType: "laundrybatch", entityId: batch.id, action: "create", newValue: { number } });
  revalidatePath("/laundry");
  redirect(`/laundry/${batch.id}`);
}

const BATCH_FLOW = ["created", "collected", "sent", "processing", "returned", "verified", "completed"];

export async function setBatchStatus(batchId: string, formData: FormData) {
  const user = await requireSection("laundry");
  const status = String(formData.get("status") ?? "");
  if (!BATCH_FLOW.includes(status)) return;
  const data: { status: string; collectionDate?: Date; returnDate?: Date } = { status };
  if (status === "collected") data.collectionDate = new Date();
  if (status === "returned") data.returnDate = new Date();
  await db.laundryBatch.update({ where: { id: batchId }, data });
  await writeAudit({ actorId: user.id, entityType: "laundrybatch", entityId: batchId, action: "status_change", newValue: { status } });
  revalidatePath(`/laundry/${batchId}`);
}

export async function assignBatch(batchId: string, formData: FormData) {
  await requireSection("laundry");
  await db.laundryBatch.update({
    where: { id: batchId },
    data: {
      supplierId: String(formData.get("supplierId") ?? "") || null,
      driverStaffId: String(formData.get("driverStaffId") ?? "") || null,
      fulfilmentMode: String(formData.get("fulfilmentMode") ?? "outsourced"),
    },
  });
  revalidatePath(`/laundry/${batchId}`);
}

/**
 * Return verification (spec 15.7): record returned/damaged counts per item. The system
 * flags shortfalls and AUTOMATICALLY creates an Issue if anything is missing or damaged.
 */
export async function recordReturns(batchId: string, formData: FormData) {
  const user = await requireSection("laundry");
  const batch = await db.laundryBatch.findUnique({ where: { id: batchId }, include: { items: true } });
  if (!batch) return;

  let totalMissing = 0;
  let totalDamaged = 0;
  for (const item of batch.items) {
    const returned = Math.max(0, parseInt(String(formData.get(`returned_${item.id}`) ?? "0"), 10) || 0);
    const damaged = Math.max(0, parseInt(String(formData.get(`damaged_${item.id}`) ?? "0"), 10) || 0);
    await db.laundryBatchItem.update({ where: { id: item.id }, data: { returnedQty: returned, damagedQty: damaged } });
    totalMissing += Math.max(item.collectedQty - returned - damaged, 0);
    totalDamaged += damaged;
  }

  const hasDiscrepancy = totalMissing > 0 || totalDamaged > 0;
  await db.laundryBatch.update({
    where: { id: batchId },
    data: { status: hasDiscrepancy ? "returned" : "verified", returnDate: new Date() },
  });

  // Auto-create an issue on discrepancy (spec 15.7).
  if (hasDiscrepancy) {
    await db.issue.create({
      data: {
        type: totalDamaged > 0 ? "damaged_linen" : "missing_laundry",
        title: `Laundry batch ${batch.number}: ${totalMissing} missing, ${totalDamaged} damaged`,
        description: "Auto-generated from return verification.",
        priority: "high",
        workOrderId: batch.workOrderId,
        createdById: user.id,
      },
    });
  }
  await writeAudit({ actorId: user.id, entityType: "laundrybatch", entityId: batchId, action: "update", newValue: { totalMissing, totalDamaged } });
  revalidatePath(`/laundry/${batchId}`);
}
