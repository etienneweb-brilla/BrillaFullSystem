import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { money, dateOnly } from "@/lib/format";
import { getFinanceSettings } from "@/lib/settings";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("clients");
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      clientType: true,
      properties: true,
      workOrders: { include: { property: true }, orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) notFound();
  const finance = await getFinanceSettings();

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link href="/clients" className="text-sm text-brand-dark hover:underline">← All clients</Link>
      </div>
      <PageHeader title={client.name} subtitle={client.clientType?.name} />

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <Info label="Email" value={client.email} />
        <Info label="Phone" value={client.phone} />
        <Info label="VAT number" value={client.vatNumber} />
        <Info label="Payment terms" value={client.paymentTerms} />
      </div>

      <Section title="Properties" action={{ href: `/properties/new?clientId=${client.id}`, label: "+ Add property" }}>
        {client.properties.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No properties.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {client.properties.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link href={`/properties/${p.id}`} className="font-medium text-brand-dark hover:underline">{p.name}</Link>
                <span className="text-gray-400">{p.address}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Work Orders">
        {client.workOrders.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No work orders.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {client.workOrders.map((wo) => (
              <li key={wo.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link href={`/workorders/${wo.id}`} className="font-medium text-brand-dark hover:underline">{wo.number}</Link>
                <span className="text-gray-500">{wo.property.name}</span>
                <StatusBadge status={wo.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Invoices">
        {client.invoices.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No invoices.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {client.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link href={`/invoices/${inv.id}`} className="font-medium text-brand-dark hover:underline">{inv.number}</Link>
                <span>{dateOnly(inv.issuedAt)}</span>
                <span>{money(inv.total, finance.currency)}</span>
                <StatusBadge status={inv.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="card p-3">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="card mb-6">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {action && <Link href={action.href} className="text-sm text-brand-dark hover:underline">{action.label}</Link>}
      </div>
      {children}
    </section>
  );
}
