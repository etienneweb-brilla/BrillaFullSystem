import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";

export default async function LaundryPage() {
  await requireSection("laundry");
  const batches = await db.laundryBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: { supplier: true, driver: { include: { user: true } }, items: true },
  });

  return (
    <div>
      <PageHeader title="Laundry" subtitle="Collection → processing → return, with manifests and verification." />

      <div className="mb-6 flex gap-2">
        <Link href="/laundry/new" className="btn-primary">+ New batch</Link>
        <Link href="/laundry/items" className="btn-secondary">Manage laundry items</Link>
      </div>

      {batches.length === 0 ? (
        <EmptyState message="No laundry batches yet." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Batch</th>
                <th className="th">Mode</th>
                <th className="th">Supplier / Driver</th>
                <th className="th">Items</th>
                <th className="th">Created</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.map((b) => {
                const totalQty = b.items.reduce((s, i) => s + i.collectedQty, 0);
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="td">
                      <Link href={`/laundry/${b.id}`} className="font-medium text-brand-dark hover:underline">{b.number}</Link>
                    </td>
                    <td className="td">{b.fulfilmentMode}</td>
                    <td className="td">{b.supplier?.name ?? b.driver?.user.name ?? "—"}</td>
                    <td className="td">{b.items.length} lines · {totalQty} pcs</td>
                    <td className="td">{dateOnly(b.createdAt)}</td>
                    <td className="td"><StatusBadge status={b.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
