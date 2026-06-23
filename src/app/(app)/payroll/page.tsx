import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui";
import { createPeriod } from "./actions";

export default async function PayrollPage() {
  await requireSection("payroll");
  const periods = await db.payrollPeriod.findMany({
    orderBy: { startDate: "desc" },
    include: { entries: true },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Payroll" subtitle="Review computed pay per period, then lock it. Locked periods never change." />

      <section className="card mb-6 p-6">
        <h2 className="mb-4 font-semibold text-gray-900">New period</h2>
        <form action={createPeriod} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Label</label>
            <input name="label" placeholder="June 2026" className="input" required />
          </div>
          <div>
            <label className="label">Start</label>
            <input name="startDate" type="date" className="input" required />
          </div>
          <div>
            <label className="label">End</label>
            <input name="endDate" type="date" className="input" required />
          </div>
          <button className="btn-primary" type="submit">Create</button>
        </form>
      </section>

      {periods.length === 0 ? (
        <EmptyState message="No payroll periods yet." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Period</th>
                <th className="th">Range</th>
                <th className="th">Entries</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/payroll/${p.id}`} className="font-medium text-brand-dark hover:underline">{p.label}</Link>
                  </td>
                  <td className="td">{dateOnly(p.startDate)} – {dateOnly(p.endDate)}</td>
                  <td className="td">{p.entries.length}</td>
                  <td className="td">
                    {p.lockedAt ? <span className="badge bg-green-100 text-green-700">locked</span> : <span className="badge bg-amber-100 text-amber-700">open</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
