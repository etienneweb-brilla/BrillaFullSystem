import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseJson, dateOnly } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { saveLinenSetup } from "../actions";

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
  const laundryItems = await db.laundryItem.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const fieldValues = parseJson<Record<string, unknown>>(property.fieldValues, {});
  const instructions = parseJson<Record<string, string>>(property.instructions, {});
  const linen = parseJson<Record<string, Record<string, number>>>(property.linenSetup, { single: {}, double: {} });
  const saveLinenBound = saveLinenSetup.bind(null, property.id);

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

      {/* Property-specific linen setup (Part 7) */}
      <section className="card mb-6 p-4">
        <h2 className="mb-1 font-semibold text-gray-900">Linen Setup (property-specific)</h2>
        <p className="mb-3 text-sm text-gray-500">
          Define what a single and a double bed contain at THIS property. Quantities are property-specific — no global template.
        </p>
        {laundryItems.length === 0 ? (
          <p className="text-sm text-gray-400">Add laundry items first (Laundry → Manage laundry items).</p>
        ) : (
          <form action={saveLinenBound}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Item</th>
                  <th className="th text-center">Single bed</th>
                  <th className="th text-center">Double bed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {laundryItems.map((it) => (
                  <tr key={it.id}>
                    <td className="td">{it.name}</td>
                    <td className="td text-center">
                      <input name={`linen_single_${it.id}`} type="number" min={0} defaultValue={linen.single?.[it.id] ?? 0} className="input w-20" />
                    </td>
                    <td className="td text-center">
                      <input name={`linen_double_${it.id}`} type="number" min={0} defaultValue={linen.double?.[it.id] ?? 0} className="input w-20" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-primary mt-3" type="submit">Save linen setup</button>
          </form>
        )}
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
