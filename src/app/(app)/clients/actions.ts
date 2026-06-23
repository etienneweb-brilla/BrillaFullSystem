"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function createClient(formData: FormData) {
  const user = await requireSection("clients");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/clients/new");
  const client = await db.client.create({
    data: {
      name,
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      billingAddress: String(formData.get("billingAddress") ?? "") || null,
      vatNumber: String(formData.get("vatNumber") ?? "") || null,
      paymentTerms: String(formData.get("paymentTerms") ?? "") || null,
      clientTypeId: String(formData.get("clientTypeId") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    },
  });
  await writeAudit({ actorId: user.id, entityType: "client", entityId: client.id, action: "create", newValue: { name } });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}
