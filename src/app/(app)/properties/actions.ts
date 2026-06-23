"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

/**
 * Save property-specific linen setup (Phase 4 part 7). Stores per-bed item quantities.
 * Property-specific only — no global bed template. Inputs named linen_<bed>_<itemId>.
 */
export async function saveLinenSetup(propertyId: string, formData: FormData) {
  const user = await requireSection("properties");
  const setup: Record<string, Record<string, number>> = { single: {}, double: {} };
  for (const [k, v] of formData.entries()) {
    const m = /^linen_(single|double)_(.+)$/.exec(k);
    if (!m) continue;
    const qty = parseInt(String(v), 10);
    if (qty > 0) setup[m[1]][m[2]] = qty;
  }
  await db.property.update({ where: { id: propertyId }, data: { linenSetup: JSON.stringify(setup) } });
  await writeAudit({ actorId: user.id, entityType: "property", entityId: propertyId, action: "update", newValue: { linenSetup: true } });
  revalidatePath(`/properties/${propertyId}`);
}

export async function createProperty(formData: FormData) {
  const user = await requireSection("properties");
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!clientId || !name) return;

  // Collect dynamic field values (inputs named field_<key>).
  const fieldDefs = await db.fieldDefinition.findMany({ where: { scope: "property", ownerId: null } });
  const fieldValues: Record<string, unknown> = {};
  for (const def of fieldDefs) {
    const raw = formData.get(`field_${def.key}`);
    if (raw == null || raw === "") continue;
    fieldValues[def.key] = def.type === "number" ? Number(raw) : String(raw);
  }

  const property = await db.property.create({
    data: {
      clientId,
      name,
      address: String(formData.get("address") ?? "") || null,
      propertyType: String(formData.get("propertyType") ?? "") || null,
      accessInstructions: String(formData.get("accessInstructions") ?? "") || null,
      keyboxCode: String(formData.get("keyboxCode") ?? "") || null,
      alarmCode: String(formData.get("alarmCode") ?? "") || null,
      parkingInstructions: String(formData.get("parkingInstructions") ?? "") || null,
      instructions: JSON.stringify({
        cleaning: String(formData.get("instr_cleaning") ?? ""),
        laundry: String(formData.get("instr_laundry") ?? ""),
        general: String(formData.get("instr_general") ?? ""),
      }),
      fieldValues: JSON.stringify(fieldValues),
    },
  });
  await writeAudit({ actorId: user.id, entityType: "property", entityId: property.id, action: "create", newValue: { name } });
  revalidatePath("/properties");
  redirect(`/properties/${property.id}`);
}
