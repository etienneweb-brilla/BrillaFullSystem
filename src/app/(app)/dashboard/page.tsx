import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getFinanceSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

export default async function DashboardPage() {
  await requireSection("dashboard");
  const finance = await getFinanceSettings();

  const [workOrders, openTasks, overdueTasks, unpaidInvoices, recentWO, openIssues] = await Promise.all([
    db.workOrder.count(),
    db.task.count({ where: { status: { in: ["pending", "assigned", "in_progress"] } } }),
    db.task.count({ where: { status: "overdue" } }),
    db.invoice.findMany({ where: { status: { in: ["unpaid", "partial"] } } }),
    db.workOrder.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { client: true, property: true, serviceLines: true },
    }),
    db.issue.count({ where: { status: { in: ["open", "in_progress"] } } }),
  ]);

  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);

  const stats = [
    { label: "Work Orders", value: workOrders, href: "/workorders" },
    { label: "Open Tasks", value: openTasks, href: "/workorders" },
    { label: "Overdue Tasks", value: overdueTasks, href: "/workorders" },
    { label: "Unpaid Invoices", value: money(unpaidTotal, finance.currency), href: "/invoices" },
    { label: "Open Issues", value: openIssues, href: "/workorders" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 hover:border-brand">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Recent Work Orders</h2>
        </div>
        {recentWO.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No work orders yet.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Number</th>
                <th className="th">Client</th>
                <th className="th">Property</th>
                <th className="th">Lines</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentWO.map((wo) => (
                <tr key={wo.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/workorders/${wo.id}`} className="font-medium text-brand-dark hover:underline">
                      {wo.number}
                    </Link>
                  </td>
                  <td className="td">{wo.client.name}</td>
                  <td className="td">{wo.property.name}</td>
                  <td className="td">{wo.serviceLines.length}</td>
                  <td className="td">
                    <StatusBadge status={wo.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
