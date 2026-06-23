"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function createSupplier(formData: FormData) {
  const user = await requireSection("suppliers");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supplier = await db.supplier.create({
    data: {
      name,
      contactPerson: String(formData.get("contactPerson") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      serviceType: String(formData.get("serviceType") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      status: String(formData.get("status") ?? "active"),
    },
  });
  await writeAudit({ actorId: user.id, entityType: "supplier", entityId: supplier.id, action: "create", newValue: { name } });
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function updateSupplierStatus(formData: FormData) {
  await requireSection("suppliers");
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "active");
  await db.supplier.update({ where: { id }, data: { status } }).catch(() => {});
  revalidatePath("/suppliers");
}
