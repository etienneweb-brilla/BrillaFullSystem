import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { money, dateOnly } from "@/lib/format";
import { getFinanceSettings } from "@/lib/settings";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";

export default async function InvoicesPage() {
  await requireSection("invoices");
  const [invoices, finance] = await Promise.all([
    db.invoice.findMany({ orderBy: { createdAt: "desc" }, include: { client: true } }),
    getFinanceSettings(),
  ]);

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Generated from work orders using global VAT settings." />
      {invoices.length === 0 ? (
        <EmptyState message="No invoices yet. Generate one from a work order." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Number</th>
                <th className="th">Client</th>
                <th className="th">Issued</th>
                <th className="th">Total</th>
                <th className="th">Paid</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-brand-dark hover:underline">{inv.number}</Link>
                  </td>
                  <td className="td">{inv.client.name}</td>
                  <td className="td">{dateOnly(inv.issuedAt)}</td>
                  <td className="td">{money(inv.total, finance.currency)}</td>
                  <td className="td">{money(inv.amountPaid, finance.currency)}</td>
                  <td className="td"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
