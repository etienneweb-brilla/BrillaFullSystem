import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";
import { createProperty } from "../actions";

export default async function NewPropertyPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  await requireSection("properties");
  const { clientId } = await searchParams;
  const [clients, fieldDefs] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.fieldDefinition.findMany({ where: { scope: "property", ownerId: null }, orderBy: { sortOrder: "asc" } }),
  ]);

  if (clients.length === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="New Property" />
        <EmptyState message="Create a client first — properties belong to a client." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="New Property" />
      <form action={createProperty} className="card space-y-4 p-6">
        <div>
          <label className="label">Client *</label>
          <select name="clientId" required defaultValue={clientId ?? ""} className="input">
            <option value="">—</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Property name *</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Property type</label>
            <input name="propertyType" placeholder="Apartment, Villa…" className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Address</label>
            <input name="address" className="input" />
          </div>
          <div>
            <label className="label">Keybox code</label>
            <input name="keyboxCode" className="input" />
          </div>
          <div>
            <label className="label">Alarm code</label>
            <input name="alarmCode" className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Access instructions</label>
            <input name="accessInstructions" className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Parking instructions</label>
            <input name="parkingInstructions" className="input" />
          </div>
        </div>

        {fieldDefs.length > 0 && (
          <fieldset className="rounded-md border border-gray-200 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-700">Property attributes (admin-defined)</legend>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {fieldDefs.map((f) => (
                <div key={f.id}>
                  <label className="label">{f.label}</label>
                  <input
                    name={`field_${f.key}`}
                    type={f.type === "number" ? "number" : "text"}
                    className="input"
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="rounded-md border border-gray-200 p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Instructions (role-scoped on staff views)</legend>
          <div className="space-y-3">
            <div>
              <label className="label">Cleaning instructions</label>
              <textarea name="instr_cleaning" rows={2} className="input" />
            </div>
            <div>
              <label className="label">Laundry instructions</label>
              <textarea name="instr_laundry" rows={2} className="input" />
            </div>
            <div>
              <label className="label">General notes</label>
              <textarea name="instr_general" rows={2} className="input" />
            </div>
          </div>
        </fieldset>

        <button className="btn-primary" type="submit">Create property</button>
      </form>
    </div>
  );
}
