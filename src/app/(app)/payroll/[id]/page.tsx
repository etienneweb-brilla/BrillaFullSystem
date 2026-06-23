import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { money, dateOnly } from "@/lib/format";
import { getFinanceSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { computePeriod, lockPeriod, unlockPeriod, addAdjustment } from "../actions";

export default async function PayrollPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("payroll");
  const { id } = await params;
  const period = await db.payrollPeriod.findUnique({
    where: { id },
    include: { entries: { include: { staff: { include: { user: true } } } } },
  });
  if (!period) notFound();
  const [staff, finance] = await Promise.all([
    db.staffProfile.findMany({ where: { active: true }, include: { user: true } }),
    getFinanceSettings(),
  ]);
  const cur = finance.currency;
  const locked = !!period.lockedAt;

  const grandTotal = period.entries.reduce((s, e) => s + e.total, 0);

  const computeBound = computePeriod.bind(null, period.id);
  const lockBound = lockPeriod.bind(null, period.id);
  const unlockBound = unlockPeriod.bind(null, period.id);
  const adjustBound = addAdjustment.bind(null, period.id);

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/payroll" className="text-sm text-brand-dark hover:underline">← Payroll</Link>
      </div>
      <PageHeader title={period.label} subtitle={`${dateOnly(period.startDate)} – ${dateOnly(period.endDate)}`} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {locked ? (
          <span className="badge bg-green-100 text-green-700">locked {dateOnly(period.lockedAt)}</span>
        ) : (
          <span className="badge bg-amber-100 text-amber-700">open</span>
        )}
        <span className="ml-auto text-sm text-gray-600">Total: <strong>{money(grandTotal, cur)}</strong></span>
      </div>

      {!locked && (
        <div className="mb-6 flex gap-2">
          <form action={computeBound}>
            <button className="btn-secondary" type="submit">Compute from completed work</button>
          </form>
          <form action={lockBound}>
            <button className="btn-primary" type="submit" disabled={period.entries.length === 0}>Lock period</button>
          </form>
        </div>
      )}
      {locked && (
        <div className="mb-6">
          <form action={unlockBound}>
            <button className="btn-secondary" type="submit">Unlock (audited)</button>
          </form>
        </div>
      )}

      <section className="card mb-6 overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Entries</h2>
        </div>
        {period.entries.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No entries. Use “Compute” to generate pay from completed service lines.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Staff</th>
                <th className="th text-right">Base</th>
                <th className="th text-right">Commission</th>
                <th className="th text-right">Total</th>
                <th className="th">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {period.entries.map((e) => (
                <tr key={e.id}>
                  <td className="td font-medium">{e.staff.user.name}</td>
                  <td className="td text-right">{money(e.base, cur)}</td>
                  <td className="td text-right">{money(e.commission, cur)}</td>
                  <td className="td text-right font-medium">{money(e.total, cur)}</td>
                  <td className="td">{e.isAdjustment ? <span className="badge bg-blue-100 text-blue-700">adjustment</span> : "computed"}{e.note ? ` · ${e.note}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Adjustments — the only way to change a locked period */}
      <section className="card p-6">
        <h2 className="mb-1 font-semibold text-gray-900">Add Adjustment</h2>
        <p className="mb-4 text-sm text-gray-500">Corrections after locking are recorded as adjustment entries (audited).</p>
        <form action={adjustBound} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Staff</label>
            <select name="staffId" className="input w-52" required>
              <option value="">—</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount (+/-)</label>
            <input name="amount" type="number" step="0.01" className="input w-32" required />
          </div>
          <div className="flex-1">
            <label className="label">Note</label>
            <input name="note" className="input" />
          </div>
          <button className="btn-secondary" type="submit">Add adjustment</button>
        </form>
      </section>
    </div>
  );
}
