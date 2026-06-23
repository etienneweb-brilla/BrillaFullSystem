"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

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
