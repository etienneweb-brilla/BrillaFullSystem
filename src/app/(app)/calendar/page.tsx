import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getFinanceSettings } from "@/lib/settings";
import { parseJson } from "@/lib/format";
import { computeServiceLinePay, type PayrollRuleConfig } from "@/lib/payroll";
import { startOfDay, addDays, startOfWeek } from "@/lib/calendar";
import CalendarBoard, { type CalItem, type StaffOption } from "./CalendarBoard";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireSection("calendar");
  const finance = await getFinanceSettings();

  const tasks = await db.task.findMany({
    where: { status: { notIn: ["cancelled"] } },
    include: {
      workOrder: { include: { client: true, property: true } },
      serviceLine: { include: { serviceVersion: { include: { service: { include: { category: true } } } } } },
      assignedStaff: { include: { user: true } },
      attachments: true,
    },
    orderBy: [{ scheduledStart: "asc" }, { dueAt: "asc" }],
  });

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);

  const items: CalItem[] = tasks.map((t) => {
    const line = t.serviceLine;
    const svc = line?.serviceVersion.service;
    const payCfg = parseJson<Partial<PayrollRuleConfig>>(line?.payrollConfig, {});
    const pay = line
      ? computeServiceLinePay(
          { payType: (payCfg.payType as PayrollRuleConfig["payType"]) ?? "commission", commissionPercent: payCfg.commissionPercent ?? 0, baseHourlyRate: payCfg.baseHourlyRate ?? 0 },
          { serviceLinePrice: line.price },
        )
      : null;
    const instr = parseJson<Record<string, string>>(t.workOrder.property.instructions, {});
    const isOverdue = t.status !== "completed" && !!t.dueAt && t.dueAt < now;

    return {
      taskId: t.id,
      taskName: t.name,
      status: isOverdue && t.status !== "completed" ? "overdue" : t.status,
      rawStatus: t.status,
      priority: t.priority ?? "normal",
      scheduledStart: (t.scheduledStart ?? t.dueAt)?.toISOString() ?? null,
      scheduledEnd: t.scheduledEnd?.toISOString() ?? null,
      dueAt: t.dueAt?.toISOString() ?? null,
      woId: t.workOrderId,
      woNumber: t.workOrder.number,
      woStatus: t.workOrder.status,
      clientName: t.workOrder.client.name,
      propertyName: t.workOrder.property.name,
      propertyId: t.workOrder.propertyId,
      serviceLineId: line?.id ?? null,
      serviceId: svc?.id ?? null,
      serviceName: svc?.name ?? "—",
      categoryName: svc?.category?.name ?? null,
      categoryKey: svc?.categoryId ?? svc?.category?.name ?? null,
      staffId: t.assignedStaffId,
      staffName: t.assignedStaff?.user.name ?? null,
      price: line?.price ?? 0,
      commission: pay?.commission ?? 0,
      profit: line ? line.price - line.supplierCost - line.materialCost - line.driverCost - (pay?.total ?? 0) : 0,
      notes: t.notes,
      photoUrls: t.attachments.map((a) => a.url),
      checklistTemplateId: t.checklistTemplateId,
      access: t.workOrder.property.accessInstructions,
      parking: t.workOrder.property.parkingInstructions,
      alarm: t.workOrder.property.alarmCode,
      serviceInstructions: instr,
      requiredRoleKey: t.requiredRoleKey,
    };
  });

  const [staff, services, categories, clients, properties] = await Promise.all([
    db.staffProfile.findMany({ where: { active: true }, include: { user: true, eligibility: true } }),
    db.service.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.serviceCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const staffOptions: StaffOption[] = staff.map((s) => ({
    id: s.id,
    name: s.user.name,
    eligibleServiceIds: s.eligibility.map((e) => e.serviceId),
  }));

  // Summary numbers
  const inRange = (iso: string | null, from: Date, to: Date) => !!iso && new Date(iso) >= from && new Date(iso) < to;
  const tasksToday = items.filter((i) => inRange(i.scheduledStart, today, tomorrow));
  const completedToday = tasks.filter((t) => t.completedAt && t.completedAt >= today && t.completedAt < tomorrow).length;
  const lines = await db.serviceLine.findMany({
    where: { workOrder: { scheduledAt: { gte: weekStart, lt: weekEnd } } },
    include: { workOrder: { select: { scheduledAt: true } } },
  });
  const revenueWeek = lines.reduce((s, l) => s + l.price, 0);
  const revenueToday = lines.filter((l) => l.workOrder.scheduledAt && l.workOrder.scheduledAt >= today && l.workOrder.scheduledAt < tomorrow).reduce((s, l) => s + l.price, 0);
  const staffWorking = await db.timeEntry.count({ where: { clockOut: null } });

  const summary = {
    tasksToday: tasksToday.length,
    completedToday,
    pendingToday: tasksToday.filter((i) => i.rawStatus === "pending" || i.rawStatus === "assigned").length,
    overdue: items.filter((i) => i.status === "overdue").length,
    unassigned: items.filter((i) => !i.staffId).length,
    staffWorking,
    revenueToday,
    revenueWeek,
    currency: finance.currency,
  };

  return (
    <CalendarBoard
      items={items}
      staff={staffOptions}
      services={services}
      categories={categories}
      clients={clients}
      properties={properties}
      summary={summary}
    />
  );
}
