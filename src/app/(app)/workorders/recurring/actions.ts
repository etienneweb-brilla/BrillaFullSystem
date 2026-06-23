"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/format";
import { createWorkOrderFromTemplate, advanceDate, type TemplateLine } from "@/lib/workorderGen";

export async function createRecurring(formData: FormData) {
  await requireSection("recurring");
  const clientId = String(formData.get("clientId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);
  const start = String(formData.get("nextRunAt") ?? "");
  if (!clientId || !propertyId || !label || serviceIds.length === 0 || !start) return;

  const hours = parseFloat(String(formData.get("hours") ?? "")) || undefined;
  const manpower = parseFloat(String(formData.get("manpower") ?? "")) || undefined;
  const template: TemplateLine[] = serviceIds.map((serviceId) => ({
    serviceId,
    inputs: { hours, manpower },
    fulfilmentMode: "internal",
  }));

  const endRaw = String(formData.get("endDate") ?? "");
  const daysOfWeek = formData.getAll("daysOfWeek").map((d) => parseInt(String(d), 10)).filter((n) => !isNaN(n));

  await db.recurringWorkOrder.create({
    data: {
      label,
      clientId,
      propertyId,
      template: JSON.stringify(template),
      frequency: String(formData.get("frequency") ?? "weekly"),
      intervalDays: parseInt(String(formData.get("intervalDays") ?? "0"), 10) || 0,
      daysOfWeek: JSON.stringify(daysOfWeek),
      startDate: new Date(start),
      endDate: endRaw ? new Date(endRaw) : null,
      nextRunAt: new Date(start),
    },
  });
  revalidatePath("/workorders/recurring");
  redirect("/workorders/recurring");
}

export async function toggleRecurring(formData: FormData) {
  await requireSection("recurring");
  const id = String(formData.get("id"));
  const r = await db.recurringWorkOrder.findUnique({ where: { id } });
  if (r) await db.recurringWorkOrder.update({ where: { id }, data: { active: !r.active } });
  revalidatePath("/workorders/recurring");
}

/** Materialise every active schedule whose nextRunAt is due, advancing the schedule. */
export async function generateDue() {
  await requireSection("recurring");
  const now = new Date();
  const due = await db.recurringWorkOrder.findMany({ where: { active: true, nextRunAt: { lte: now } } });
  let created = 0;
  for (const r of due) {
    // Respect the schedule's end date.
    if (r.endDate && r.nextRunAt > r.endDate) {
      await db.recurringWorkOrder.update({ where: { id: r.id }, data: { active: false } });
      continue;
    }
    const template = parseJson<TemplateLine[]>(r.template, []);
    if (template.length === 0) continue;
    await createWorkOrderFromTemplate(r.clientId, r.propertyId, template, r.nextRunAt);
    const daysOfWeek = parseJson<number[]>(r.daysOfWeek, []);
    await db.recurringWorkOrder.update({
      where: { id: r.id },
      data: { lastRunAt: now, nextRunAt: advanceDate(r.nextRunAt, r.frequency, r.intervalDays, daysOfWeek) },
    });
    created++;
  }
  revalidatePath("/workorders/recurring");
  revalidatePath("/workorders");
  redirect(`/workorders/recurring?generated=${created}`);
}
