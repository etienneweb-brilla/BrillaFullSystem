"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { parseJson } from "@/lib/format";
import { computeServiceLinePay, sumPay, type PayrollRuleConfig, type PayResult } from "@/lib/payroll";

export async function createPeriod(formData: FormData) {
  await requireSection("payroll");
  const label = String(formData.get("label") ?? "").trim();
  const start = String(formData.get("startDate") ?? "");
  const end = String(formData.get("endDate") ?? "");
  if (!label || !start || !end) return;
  const period = await db.payrollPeriod.create({
    data: { label, startDate: new Date(start), endDate: new Date(end) },
  });
  redirect(`/payroll/${period.id}`);
}

/**
 * Compute pay for every staff member from COMPLETED service lines in the period range.
 * Commission reads each service line (rule #7). Skipped if the period is locked.
 */
export async function computePeriod(periodId: string) {
  const user = await requireSection("payroll");
  const period = await db.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period || period.lockedAt) return;

  // Clear previous non-adjustment entries, then recompute.
  await db.payrollEntry.deleteMany({ where: { periodId, isAdjustment: false } });

  const lines = await db.serviceLine.findMany({
    where: {
      status: "completed",
      assignedStaffId: { not: null },
      workOrder: { scheduledAt: { gte: period.startDate, lte: period.endDate } },
    },
    include: { assignedStaff: { include: { payrollRule: true } } },
  });

  // Group by staff
  const byStaff = new Map<string, typeof lines>();
  for (const l of lines) {
    const k = l.assignedStaffId!;
    if (!byStaff.has(k)) byStaff.set(k, []);
    byStaff.get(k)!.push(l);
  }

  for (const [staffId, staffLines] of byStaff) {
    const rule = staffLines[0].assignedStaff?.payrollRule;
    const results: PayResult[] = staffLines.map((l) => {
      const cfg = parseJson<Partial<PayrollRuleConfig>>(l.payrollConfig, {});
      return computeServiceLinePay(
        {
          payType: (cfg.payType as PayrollRuleConfig["payType"]) ?? (rule?.payType as PayrollRuleConfig["payType"]) ?? "commission",
          commissionPercent: cfg.commissionPercent ?? rule?.commissionPercent ?? 0,
          commissionFixed: rule?.commissionFixed ?? 0,
          baseHourlyRate: rule?.baseHourlyRate ?? 0,
          minPerJob: rule?.minPerJob ?? 0,
        },
        { serviceLinePrice: l.price },
      );
    });
    const total = sumPay(results);
    await db.payrollEntry.create({
      data: {
        periodId,
        staffId,
        base: total.base,
        commission: total.commission,
        total: total.total,
        computedFrom: JSON.stringify({ lineIds: staffLines.map((l) => l.id) }),
      },
    });
  }
  await writeAudit({ actorId: user.id, entityType: "payroll", entityId: periodId, action: "update", newValue: { computed: byStaff.size } });
  revalidatePath(`/payroll/${periodId}`);
}

export async function lockPeriod(periodId: string) {
  const user = await requireSection("payroll");
  await db.payrollPeriod.update({ where: { id: periodId }, data: { lockedAt: new Date(), lockedById: user.id } });
  await writeAudit({ actorId: user.id, entityType: "payroll", entityId: periodId, action: "update", newValue: { locked: true } });
  revalidatePath(`/payroll/${periodId}`);
}

export async function unlockPeriod(periodId: string) {
  const user = await requireSection("payroll");
  await db.payrollPeriod.update({ where: { id: periodId }, data: { lockedAt: null, lockedById: null } });
  await writeAudit({ actorId: user.id, entityType: "payroll", entityId: periodId, action: "update", newValue: { locked: false } });
  revalidatePath(`/payroll/${periodId}`);
}

/** After locking, corrections are adjustment entries only (spec §12.4). */
export async function addAdjustment(periodId: string, formData: FormData) {
  const user = await requireSection("payroll");
  const staffId = String(formData.get("staffId") ?? "");
  const amount = parseFloat(String(formData.get("amount") ?? "0")) || 0;
  const note = String(formData.get("note") ?? "") || null;
  if (!staffId || amount === 0) return;
  await db.payrollEntry.create({
    data: { periodId, staffId, base: amount, commission: 0, total: amount, isAdjustment: true, note },
  });
  await writeAudit({ actorId: user.id, entityType: "payroll", entityId: periodId, action: "update", newValue: { adjustment: amount, staffId } });
  revalidatePath(`/payroll/${periodId}`);
}
