import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";

export default async function ClientsPage() {
  await requireSection("clients");
  const clients = await db.client.findMany({
    orderBy: { createdAt: "desc" },
    include: { clientType: true, _count: { select: { properties: true, workOrders: true } } },
  });

  return (
    <div>
      <PageHeader title="Clients" action={{ href: "/clients/new", label: "+ New client" }} />
      {clients.length === 0 ? (
        <EmptyState message="No clients yet." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Type</th>
                <th className="th">Contact</th>
                <th className="th">Properties</th>
                <th className="th">Work Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/clients/${c.id}`} className="font-medium text-brand-dark hover:underline">{c.name}</Link>
                  </td>
                  <td className="td">{c.clientType?.name ?? "—"}</td>
                  <td className="td">{c.email ?? c.phone ?? "—"}</td>
                  <td className="td">{c._count.properties}</td>
                  <td className="td">{c._count.workOrders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
