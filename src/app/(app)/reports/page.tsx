import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { getFinanceSettings } from "@/lib/settings";
import { summarize, groupSummary, monthKey, type ServiceLineLike } from "@/lib/profit";
import { computeServiceLinePay, type PayrollRuleConfig } from "@/lib/payroll";
import { parseJson } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function ReportsPage() {
  await requireSection("reports");
  const finance = await getFinanceSettings();
  const cur = finance.currency;

  const [lines, invoices, tasks, batches] = await Promise.all([
    db.serviceLine.findMany({
      include: {
        workOrder: { include: { client: true, property: true } },
        serviceVersion: { include: { service: true } },
        assignedStaff: { include: { user: true } },
      },
    }),
    db.invoice.findMany({ include: { client: true } }),
    db.task.findMany({ include: { workOrder: { include: { property: true } }, assignedStaff: { include: { user: true } } } }),
    db.laundryBatch.findMany({ include: { items: { include: { laundryItem: true } }, supplier: true } }),
  ]);

  // Attribute labour (commission) to each line so profit includes staff pay.
  const enriched = lines.map((l) => {
    const cfg = parseJson<Partial<PayrollRuleConfig>>(l.payrollConfig, {});
    const pay = computeServiceLinePay(
      { payType: (cfg.payType as PayrollRuleConfig["payType"]) ?? "commission", commissionPercent: cfg.commissionPercent ?? 0, baseHourlyRate: cfg.baseHourlyRate ?? 0 },
      { serviceLinePrice: l.price },
    );
    return { ...l, labourCost: pay.total };
  });

  const asLike = (l: (typeof enriched)[number]): ServiceLineLike => ({
    price: l.price,
    supplierCost: l.supplierCost,
    materialCost: l.materialCost,
    driverCost: l.driverCost,
    labourCost: l.labourCost,
  });

  const overall = summarize(enriched.map(asLike));

  const byService = groupSummary(enriched, (l) => l.serviceVersion.serviceId, (l) => l.serviceVersion.service.name);
  const byClient = groupSummary(enriched, (l) => l.workOrder.clientId, (l) => l.workOrder.client.name);
  const byProperty = groupSummary(enriched, (l) => l.workOrder.propertyId, (l) => l.workOrder.property.name);
  const byStaff = groupSummary(
    enriched.filter((l) => l.assignedStaff),
    (l) => l.assignedStaffId!,
    (l) => l.assignedStaff!.user.name,
  );
  const byMonth = groupSummary(enriched, (l) => monthKey(l.createdAt), (l) => monthKey(l.createdAt));

  // Commission report — per staff, commission earned from their service lines.
  const commissionByStaff = new Map<string, { name: string; commission: number; lines: number }>();
  for (const l of lines) {
    if (!l.assignedStaff) continue;
    const cfg = parseJson<Partial<PayrollRuleConfig>>(l.payrollConfig, {});
    const pay = computeServiceLinePay(
      { payType: (cfg.payType as PayrollRuleConfig["payType"]) ?? "commission", commissionPercent: cfg.commissionPercent ?? 0 },
      { serviceLinePrice: l.price },
    );
    const k = l.assignedStaffId!;
    const cur2 = commissionByStaff.get(k) ?? { name: l.assignedStaff.user.name, commission: 0, lines: 0 };
    cur2.commission += pay.commission;
    cur2.lines += 1;
    commissionByStaff.set(k, cur2);
  }

  // Staff performance — completed/assigned/overdue task counts per staff.
  const perfByStaff = new Map<string, { name: string; completed: number; assigned: number; overdue: number }>();
  for (const t of tasks) {
    if (!t.assignedStaff) continue;
    const k = t.assignedStaffId!;
    const p = perfByStaff.get(k) ?? { name: t.assignedStaff.user.name, completed: 0, assigned: 0, overdue: 0 };
    if (t.status === "completed") p.completed += 1;
    else p.assigned += 1;
    if (t.status !== "completed" && t.dueAt && t.dueAt < new Date()) p.overdue += 1;
    perfByStaff.set(k, p);
  }

  const overdueTasks = tasks
    .filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.dueAt && t.dueAt < new Date())
    .sort((a, b) => (a.dueAt!.getTime() - b.dueAt!.getTime()));

  // Supplier cost report — laundry supplier cost per supplier.
  const supplierCost = new Map<string, { name: string; cost: number; batches: number }>();
  for (const b of batches) {
    if (!b.supplierId) continue;
    const cost = b.items.reduce((s, it) => s + it.collectedQty * (it.laundryItem?.supplierCost ?? 0), 0);
    const c = supplierCost.get(b.supplierId) ?? { name: b.supplier?.name ?? "—", cost: 0, batches: 0 };
    c.cost += cost;
    c.batches += 1;
    supplierCost.set(b.supplierId, c);
  }

  // Laundry discrepancy report — per batch missing/damaged.
  const discrepancies = batches
    .map((b) => ({
      number: b.number,
      missing: b.items.reduce((q, it) => q + Math.max(it.collectedQty - it.returnedQty - it.damagedQty, 0), 0),
      damaged: b.items.reduce((q, it) => q + it.damagedQty, 0),
    }))
    .filter((d) => d.missing > 0 || d.damaged > 0);

  const unpaid = invoices.filter((i) => i.status === "unpaid" || i.status === "partial");
  const unpaidTotal = unpaid.reduce((s, i) => s + (i.total - i.amountPaid), 0);

  const taskDone = tasks.filter((t) => t.status === "completed").length;
  const taskOverdue = tasks.filter((t) => t.status === "overdue").length;
  const taskOpen = tasks.filter((t) => ["pending", "assigned", "in_progress"].includes(t.status)).length;

  const laundryMissing = batches.reduce(
    (s, b) => s + b.items.reduce((q, it) => q + Math.max(it.collectedQty - it.returnedQty - it.damagedQty, 0), 0),
    0,
  );
  const laundryDamaged = batches.reduce((s, b) => s + b.items.reduce((q, it) => q + it.damagedQty, 0), 0);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Reports" subtitle="Revenue, profit and operations across the business." />

      {/* Headline */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Revenue" value={money(overall.revenue, cur)} />
        <Stat label="Cost" value={money(overall.cost, cur)} />
        <Stat label="Profit" value={money(overall.profit, cur)} />
        <Stat label="Margin" value={`${overall.margin}%`} />
      </div>

      <ProfitTable title="Profit by Service" rows={byService} cur={cur} />
      <ProfitTable title="Profit by Client" rows={byClient} cur={cur} />
      <ProfitTable title="Profit by Property" rows={byProperty} cur={cur} />
      <ProfitTable title="Profit by Staff (commission as labour)" rows={byStaff} cur={cur} />
      <ProfitTable title="Revenue by Month" rows={byMonth} cur={cur} />

      {/* Operations */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Tasks</h2>
          <dl className="space-y-1 text-sm">
            <Row label="Completed" value={String(taskDone)} />
            <Row label="Open" value={String(taskOpen)} />
            <Row label="Overdue" value={String(taskOverdue)} />
          </dl>
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Laundry quality</h2>
          <dl className="space-y-1 text-sm">
            <Row label="Missing items" value={String(laundryMissing)} />
            <Row label="Damaged items" value={String(laundryDamaged)} />
          </dl>
        </section>
      </div>

      {/* Commission report */}
      <SimpleTable
        title="Commission Report"
        head={["Staff", "Lines", "Commission"]}
        rows={[...commissionByStaff.values()].sort((a, b) => b.commission - a.commission).map((c) => [c.name, String(c.lines), money(c.commission, cur)])}
      />

      {/* Staff performance */}
      <SimpleTable
        title="Staff Performance"
        head={["Staff", "Completed", "Open", "Overdue"]}
        rows={[...perfByStaff.values()].sort((a, b) => b.completed - a.completed).map((p) => [p.name, String(p.completed), String(p.assigned), String(p.overdue)])}
      />

      {/* Overdue tasks */}
      <SimpleTable
        title="Overdue Tasks"
        head={["Task", "Property", "Staff", "Due"]}
        rows={overdueTasks.map((t) => [t.name, t.workOrder.property.name, t.assignedStaff?.user.name ?? "unassigned", t.dueAt ? t.dueAt.toLocaleDateString() : "—"])}
      />

      {/* Laundry discrepancy report */}
      <SimpleTable
        title="Laundry Discrepancy Report"
        head={["Batch", "Missing", "Damaged"]}
        rows={discrepancies.map((d) => [d.number, String(d.missing), String(d.damaged)])}
      />

      {/* Supplier cost report */}
      <SimpleTable
        title="Supplier Cost Report"
        head={["Supplier", "Batches", "Laundry cost"]}
        rows={[...supplierCost.values()].sort((a, b) => b.cost - a.cost).map((s) => [s.name, String(s.batches), money(s.cost, cur)])}
      />

      {/* Unpaid invoices */}
      <section className="card mb-6">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Unpaid Invoices</h2>
          <span className="text-sm text-gray-500">{money(unpaidTotal, cur)} outstanding</span>
        </div>
        {unpaid.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">All invoices paid.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr><th className="th">Invoice</th><th className="th">Client</th><th className="th">Balance</th><th className="th">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {unpaid.map((i) => (
                <tr key={i.id}>
                  <td className="td">{i.number}</td>
                  <td className="td">{i.client.name}</td>
                  <td className="td">{money(i.total - i.amountPaid, cur)}</td>
                  <td className="td"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function SimpleTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section className="card mb-6">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">No data yet.</p>
      ) : (
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>{head.map((h, i) => <th key={h} className={`th ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, ri) => (
              <tr key={ri}>{r.map((c, ci) => <td key={ci} className={`td ${ci > 0 ? "text-right" : "font-medium"}`}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ProfitTable({
  title,
  rows,
  cur,
}: {
  title: string;
  rows: { key: string; label: string; summary: { revenue: number; cost: number; profit: number; margin: number } }[];
  cur: string;
}) {
  return (
    <section className="card mb-6">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">No data yet.</p>
      ) : (
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="th">Name</th>
              <th className="th text-right">Revenue</th>
              <th className="th text-right">Cost</th>
              <th className="th text-right">Profit</th>
              <th className="th text-right">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="td font-medium">{r.label}</td>
                <td className="td text-right">{money(r.summary.revenue, cur)}</td>
                <td className="td text-right">{money(r.summary.cost, cur)}</td>
                <td className={`td text-right ${r.summary.profit < 0 ? "text-red-600" : ""}`}>{money(r.summary.profit, cur)}</td>
                <td className="td text-right">{r.summary.margin}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
