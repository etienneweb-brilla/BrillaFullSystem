import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";

export default async function PropertiesPage() {
  await requireSection("properties");
  const properties = await db.property.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: true },
  });

  return (
    <div>
      <PageHeader title="Properties" action={{ href: "/properties/new", label: "+ New property" }} />
      {properties.length === 0 ? (
        <EmptyState message="No properties yet." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Client</th>
                <th className="th">Address</th>
                <th className="th">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {properties.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/properties/${p.id}`} className="font-medium text-brand-dark hover:underline">{p.name}</Link>
                  </td>
                  <td className="td">{p.client.name}</td>
                  <td className="td">{p.address ?? "—"}</td>
                  <td className="td">{p.propertyType ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
