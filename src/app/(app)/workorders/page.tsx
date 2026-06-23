import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";

export default async function WorkOrdersPage() {
  await requireSection("workorders");
  const workOrders = await db.workOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: true, property: true, serviceLines: true },
  });

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Link href="/workorders/recurring" className="text-sm text-brand-dark hover:underline">Recurring schedules →</Link>
      </div>
      <PageHeader title="Work Orders" action={{ href: "/workorders/new", label: "+ New work order" }} />
      {workOrders.length === 0 ? (
        <EmptyState message="No work orders yet." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Number</th>
                <th className="th">Client</th>
                <th className="th">Property</th>
                <th className="th">Scheduled</th>
                <th className="th">Lines</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workOrders.map((wo) => (
                <tr key={wo.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/workorders/${wo.id}`} className="font-medium text-brand-dark hover:underline">{wo.number}</Link>
                  </td>
                  <td className="td">{wo.client.name}</td>
                  <td className="td">{wo.property.name}</td>
                  <td className="td">{dateOnly(wo.scheduledAt)}</td>
                  <td className="td">{wo.serviceLines.length}</td>
                  <td className="td"><StatusBadge status={wo.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
