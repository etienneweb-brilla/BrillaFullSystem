import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseJson, dateOnly } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("properties");
  const { id } = await params;
  const property = await db.property.findUnique({
    where: { id },
    include: {
      client: true,
      contacts: true,
      workOrders: { orderBy: { createdAt: "desc" }, include: { serviceLines: true } },
    },
  });
  if (!property) notFound();

  const fieldDefs = await db.fieldDefinition.findMany({ where: { scope: "property", ownerId: null }, orderBy: { sortOrder: "asc" } });
  const fieldValues = parseJson<Record<string, unknown>>(property.fieldValues, {});
  const instructions = parseJson<Record<string, string>>(property.instructions, {});

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link href="/properties" className="text-sm text-brand-dark hover:underline">← All properties</Link>
      </div>
      <PageHeader title={property.name} subtitle={`${property.client.name} · ${property.address ?? ""}`} />

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Attributes</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {fieldDefs.map((f) => (
              <div key={f.id}>
                <dt className="text-gray-400">{f.label}</dt>
                <dd className="font-medium text-gray-800">{String(fieldValues[f.key] ?? "—")}</dd>
              </div>
            ))}
            {fieldDefs.length === 0 && <p className="text-sm text-gray-400">No attributes defined.</p>}
          </dl>
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Access</h2>
          <dl className="space-y-1 text-sm">
            <Row label="Keybox" value={property.keyboxCode} />
            <Row label="Alarm" value={property.alarmCode} />
            <Row label="Access" value={property.accessInstructions} />
            <Row label="Parking" value={property.parkingInstructions} />
          </dl>
        </section>
      </div>

      <section className="card mb-6 p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Instructions</h2>
        <dl className="space-y-1 text-sm">
          <Row label="Cleaning" value={instructions.cleaning} />
          <Row label="Laundry" value={instructions.laundry} />
          <Row label="General" value={instructions.general} />
        </dl>
      </section>

      <section className="card">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">History Timeline</h2>
        </div>
        {property.workOrders.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No work orders for this property.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {property.workOrders.map((wo) => (
              <li key={wo.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link href={`/workorders/${wo.id}`} className="font-medium text-brand-dark hover:underline">{wo.number}</Link>
                <span className="text-gray-500">{dateOnly(wo.createdAt)} · {wo.serviceLines.length} line(s)</span>
                <StatusBadge status={wo.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-800">{value || "—"}</dd>
    </div>
  );
}
