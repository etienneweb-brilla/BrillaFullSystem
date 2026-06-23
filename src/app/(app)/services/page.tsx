import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";

export default async function ServicesPage() {
  await requireSection("services");
  const services = await db.service.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: true, versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  return (
    <div>
      <PageHeader
        title="Service Builder"
        subtitle="Configurable services — pricing, forms, tasks, eligibility. Nothing is hardcoded."
        action={{ href: "/services/new", label: "+ New service" }}
      />
      {services.length === 0 ? (
        <EmptyState message="No services yet. Create your first configurable service." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Category</th>
                <th className="th">Pricing</th>
                <th className="th">Version</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/services/${s.id}`} className="font-medium text-brand-dark hover:underline">
                      {s.name}
                    </Link>
                    {s.code && <span className="ml-2 text-xs text-gray-400">{s.code}</span>}
                  </td>
                  <td className="td">{s.category?.name ?? "—"}</td>
                  <td className="td">{s.versions[0]?.pricingType ?? "—"}</td>
                  <td className="td">v{s.versions[0]?.version ?? 1}</td>
                  <td className="td">
                    <StatusBadge status={s.active ? "completed" : "cancelled"} />
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
