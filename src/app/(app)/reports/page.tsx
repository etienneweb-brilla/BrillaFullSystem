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
    db.task.findMany(),
    db.laundryBatch.findMany({ include: { items: true } }),
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
