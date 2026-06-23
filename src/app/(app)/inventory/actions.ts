"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { round2 } from "@/lib/pricing";

export async function addCategory(formData: FormData) {
  await requireSection("inventory");
  const name = String(formData.get("name") ?? "").trim();
  if (name) await db.inventoryCategory.upsert({ where: { name }, create: { name }, update: {} });
  revalidatePath("/inventory");
}

export async function createItem(formData: FormData) {
  await requireSection("inventory");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.inventoryItem.create({
    data: {
      name,
      categoryId: String(formData.get("categoryId") ?? "") || null,
      unit: String(formData.get("unit") ?? "unit"),
      stockLevel: parseFloat(String(formData.get("stockLevel") ?? "0")) || 0,
      lowStockThreshold: parseFloat(String(formData.get("lowStockThreshold") ?? "0")) || 0,
      cost: parseFloat(String(formData.get("cost") ?? "0")) || 0,
    },
  });
  revalidatePath("/inventory");
}

/** Adjust stock up or down (e.g. restock). */
export async function adjustStock(formData: FormData) {
  await requireSection("inventory");
  const id = String(formData.get("id"));
  const delta = parseFloat(String(formData.get("delta") ?? "0")) || 0;
  const item = await db.inventoryItem.findUnique({ where: { id } });
  if (!item) return;
  await db.inventoryItem.update({ where: { id }, data: { stockLevel: round2(item.stockLevel + delta) } });
  revalidatePath("/inventory");
}

/**
 * Log usage: decrements stock and, if linked to a service line, adds the used cost to
 * that line's materialCost (feeds the profit engine — spec §26 material cost link).
 */
export async function logUsage(formData: FormData) {
  await requireSection("inventory");
  const itemId = String(formData.get("itemId") ?? "");
  const qty = parseFloat(String(formData.get("qty") ?? "0")) || 0;
  const serviceLineId = String(formData.get("serviceLineId") ?? "") || null;
  if (!itemId || qty <= 0) return;
  const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  await db.inventoryUsage.create({
    data: { itemId, qty, serviceLineId, note: String(formData.get("note") ?? "") || null },
  });
  await db.inventoryItem.update({ where: { id: itemId }, data: { stockLevel: round2(item.stockLevel - qty) } });

  if (serviceLineId) {
    const line = await db.serviceLine.findUnique({ where: { id: serviceLineId } });
    if (line) {
      await db.serviceLine.update({
        where: { id: serviceLineId },
        data: { materialCost: round2(line.materialCost + qty * item.cost) },
      });
    }
  }
  revalidatePath("/inventory");
}
