"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { saveSetting, getFinanceSettings } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

export async function saveCompany(formData: FormData) {
  const user = await requireSection("settings");
  await saveSetting("company", {
    name: String(formData.get("name") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? ""),
  });
  await writeAudit({ actorId: user.id, entityType: "settings", entityId: "company", action: "update" });
  revalidatePath("/settings");
}

export async function saveFinance(formData: FormData) {
  const user = await requireSection("settings");
  const oldValue = await getFinanceSettings();
  const newValue = {
    currency: String(formData.get("currency") ?? "AED"),
    vatEnabled: formData.get("vatEnabled") === "on",
    vatRate: parseFloat(String(formData.get("vatRate") ?? "0")) || 0,
    vatNumber: String(formData.get("vatNumber") ?? ""),
    inclusive: formData.get("inclusive") === "on",
    paymentTerms: String(formData.get("paymentTerms") ?? ""),
  };
  await saveSetting("finance", newValue);
  // VAT/finance changes are audited specifically (spec §35).
  await writeAudit({ actorId: user.id, entityType: "settings", entityId: "finance", action: "update", oldValue, newValue });
  revalidatePath("/settings");
}

export async function addCategory(formData: FormData) {
  await requireSection("settings");
  const name = String(formData.get("name") ?? "").trim();
  if (name) await db.serviceCategory.upsert({ where: { name }, create: { name }, update: {} });
  revalidatePath("/settings");
}

export async function deleteCategory(formData: FormData) {
  await requireSection("settings");
  const id = String(formData.get("id"));
  await db.serviceCategory.delete({ where: { id } }).catch(() => {});
  revalidatePath("/settings");
}

export async function addClientType(formData: FormData) {
  await requireSection("settings");
  const name = String(formData.get("name") ?? "").trim();
  if (name) await db.clientType.upsert({ where: { name }, create: { name }, update: {} });
  revalidatePath("/settings");
}

export async function deleteClientType(formData: FormData) {
  await requireSection("settings");
  const id = String(formData.get("id"));
  await db.clientType.delete({ where: { id } }).catch(() => {});
  revalidatePath("/settings");
}

export async function addPropertyField(formData: FormData) {
  await requireSection("settings");
  const key = String(formData.get("key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type") ?? "text");
  if (!key || !label) return;
  const existing = await db.fieldDefinition.findFirst({ where: { scope: "property", ownerId: null, key } });
  if (!existing) {
    await db.fieldDefinition.create({ data: { scope: "property", ownerId: null, key, label, type } });
  }
  revalidatePath("/settings");
}

export async function deletePropertyField(formData: FormData) {
  await requireSection("settings");
  const id = String(formData.get("id"));
  await db.fieldDefinition.delete({ where: { id } }).catch(() => {});
  revalidatePath("/settings");
}
