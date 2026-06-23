import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import RecurringForm from "./RecurringForm";
import { createRecurring, toggleRecurring, generateDue } from "./actions";

export default async function RecurringPage({ searchParams }: { searchParams: Promise<{ generated?: string }> }) {
  await requireSection("recurring");
  const { generated } = await searchParams;
  const [schedules, clients, properties, services] = await Promise.all([
    db.recurringWorkOrder.findMany({ orderBy: { nextRunAt: "asc" } }),
    db.client.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.property.findMany({ orderBy: { name: "asc" } }),
    db.service.findMany({ where: { active: true, versions: { some: { isActive: true } } }, orderBy: { name: "asc" } }),
  ]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const propName = new Map(properties.map((p) => [p.id, p.name]));
  const dueCount = schedules.filter((s) => s.active && s.nextRunAt <= new Date()).length;

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/workorders" className="text-sm text-brand-dark hover:underline">← Work orders</Link>
      </div>
      <PageHeader title="Recurring Work Orders" subtitle="Schedules that auto-create work orders." />

      {generated !== undefined && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          Generated {generated} work order(s).
        </div>
      )}

      <div className="mb-6 card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Schedules</h2>
          <form action={generateDue}>
            <button className="btn-primary py-1.5 text-xs" type="submit" disabled={dueCount === 0}>
              Generate due now{dueCount > 0 ? ` (${dueCount})` : ""}
            </button>
          </form>
        </div>
        {schedules.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No schedules yet.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Label</th>
                <th className="th">Property</th>
                <th className="th">Frequency</th>
                <th className="th">Next run</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((s) => (
                <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                  <td className="td font-medium">{s.label}</td>
                  <td className="td">{propName.get(s.propertyId) ?? "—"}<span className="block text-xs text-gray-400">{clientName.get(s.clientId)}</span></td>
                  <td className="td">{s.frequency}{s.frequency === "everyXDays" ? ` (${s.intervalDays}d)` : ""}</td>
                  <td className="td">{dateOnly(s.nextRunAt)}{s.active && s.nextRunAt <= new Date() && <span className="badge ml-2 bg-amber-100 text-amber-700">due</span>}</td>
                  <td className="td">
                    <form action={toggleRecurring}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-xs text-brand-dark hover:underline" type="submit">{s.active ? "pause" : "resume"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="mb-3 font-semibold text-gray-900">New schedule</h2>
      <RecurringForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        properties={properties.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        action={createRecurring}
      />
    </div>
  );
}
