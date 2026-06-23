"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

/** Create a staff member: a User (login) + StaffProfile + role + payroll rule. */
export async function createStaff(formData: FormData) {
  const user = await requireSection("staff");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleKey = String(formData.get("roleKey") ?? "");
  if (!name || !email || !password || !roleKey) return;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) redirect("/staff/new?error=email_taken");

  const role = await db.role.findUnique({ where: { key: roleKey } });
  if (!role) return;

  const created = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      roles: { create: { roleId: role.id } },
      staffProfile: {
        create: {
          phone: String(formData.get("phone") ?? "") || null,
          employeeType: String(formData.get("employeeType") ?? "") || null,
          transportAvailable: formData.get("transportAvailable") === "on",
          payrollRule: {
            create: {
              payType: String(formData.get("payType") ?? "hourly"),
              baseHourlyRate: parseFloat(String(formData.get("baseHourlyRate") ?? "0")) || 0,
              commissionPercent: parseFloat(String(formData.get("commissionPercent") ?? "0")) || 0,
            },
          },
        },
      },
    },
    include: { staffProfile: true },
  });
  await writeAudit({ actorId: user.id, entityType: "staff", entityId: created.id, action: "create", newValue: { name, roleKey } });
  revalidatePath("/staff");
  redirect(`/staff/${created.staffProfile!.id}`);
}

/** Toggle service eligibility for a staff member (spec 5.9 / 10.2). */
export async function toggleEligibility(staffId: string, formData: FormData) {
  await requireSection("staff");
  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return;
  const existing = await db.serviceEligibility.findUnique({
    where: { staffId_serviceId: { staffId, serviceId } },
  });
  if (existing) {
    await db.serviceEligibility.delete({ where: { id: existing.id } });
  } else {
    await db.serviceEligibility.create({ data: { staffId, serviceId } });
  }
  revalidatePath(`/staff/${staffId}`);
}

export async function updatePayroll(staffId: string, formData: FormData) {
  const user = await requireSection("staff");
  const data = {
    payType: String(formData.get("payType") ?? "hourly"),
    baseHourlyRate: parseFloat(String(formData.get("baseHourlyRate") ?? "0")) || 0,
    overtimeRate: parseFloat(String(formData.get("overtimeRate") ?? "0")) || 0,
    minPerJob: parseFloat(String(formData.get("minPerJob") ?? "0")) || 0,
    commissionPercent: parseFloat(String(formData.get("commissionPercent") ?? "0")) || 0,
    commissionFixed: parseFloat(String(formData.get("commissionFixed") ?? "0")) || 0,
  };
  await db.payrollRule.upsert({
    where: { staffId },
    create: { staffId, ...data },
    update: data,
  });
  await writeAudit({ actorId: user.id, entityType: "payroll", entityId: staffId, action: "update", newValue: data });
  revalidatePath(`/staff/${staffId}`);
}
