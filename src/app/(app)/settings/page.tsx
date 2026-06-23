import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCompanySettings, getFinanceSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import {
  saveCompany,
  saveFinance,
  addCategory,
  deleteCategory,
  addClientType,
  deleteClientType,
  addPropertyField,
  deletePropertyField,
} from "./actions";

export default async function SettingsPage() {
  await requireSection("settings");
  const [company, finance, categories, clientTypes, propFields] = await Promise.all([
    getCompanySettings(),
    getFinanceSettings(),
    db.serviceCategory.findMany({ orderBy: { name: "asc" } }),
    db.clientType.findMany({ orderBy: { name: "asc" } }),
    db.fieldDefinition.findMany({ where: { scope: "property", ownerId: null }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" subtitle="Company, finance/VAT, and configurable lists. VAT is global — never set per service." />

      {/* Company */}
      <section className="card mb-6 p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Company</h2>
        <form action={saveCompany} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Company name</label>
            <input name="name" defaultValue={company.name} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" defaultValue={company.email} className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" defaultValue={company.phone} className="input" />
          </div>
          <div>
            <label className="label">Logo URL</label>
            <input name="logoUrl" defaultValue={company.logoUrl} className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Address</label>
            <input name="address" defaultValue={company.address} className="input" />
          </div>
          <div className="md:col-span-2">
            <button className="btn-primary" type="submit">Save company</button>
          </div>
        </form>
      </section>

      {/* Finance / VAT */}
      <section className="card mb-6 p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Finance &amp; VAT (global)</h2>
        <form action={saveFinance} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Currency</label>
            <input name="currency" defaultValue={finance.currency} className="input" />
          </div>
          <div>
            <label className="label">Payment terms</label>
            <input name="paymentTerms" defaultValue={finance.paymentTerms} className="input" />
          </div>
          <div>
            <label className="label">VAT rate (%)</label>
            <input name="vatRate" type="number" step="0.01" defaultValue={finance.vatRate} className="input" />
          </div>
          <div>
            <label className="label">VAT number</label>
            <input name="vatNumber" defaultValue={finance.vatNumber} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="vatEnabled" defaultChecked={finance.vatEnabled} /> VAT enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="inclusive" defaultChecked={finance.inclusive} /> Prices include VAT
          </label>
          <div className="md:col-span-2">
            <button className="btn-primary" type="submit">Save finance</button>
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ConfigList
          title="Service Categories"
          items={categories.map((c) => ({ id: c.id, label: c.name }))}
          addAction={addCategory}
          deleteAction={deleteCategory}
          addFields={[{ name: "name", placeholder: "e.g. Pool Cleaning" }]}
        />
        <ConfigList
          title="Client Types"
          items={clientTypes.map((c) => ({ id: c.id, label: c.name }))}
          addAction={addClientType}
          deleteAction={deleteClientType}
          addFields={[{ name: "name", placeholder: "e.g. Hotel" }]}
        />
      </div>

      {/* Property fields */}
      <section className="card mt-6 p-6">
        <h2 className="mb-1 font-semibold text-gray-900">Property Fields (dynamic)</h2>
        <p className="mb-4 text-sm text-gray-500">
          Define the attributes admins can record per property (bedrooms, pools, sqm…). Nothing is hardcoded.
        </p>
        <ul className="mb-4 divide-y divide-gray-100">
          {propFields.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-medium">{f.label}</span>{" "}
                <span className="text-gray-400">({f.key} · {f.type})</span>
              </span>
              <form action={deletePropertyField}>
                <input type="hidden" name="id" value={f.id} />
                <button className="text-xs text-red-600 hover:underline" type="submit">Remove</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addPropertyField} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Key</label>
            <input name="key" placeholder="pools" className="input" />
          </div>
          <div>
            <label className="label">Label</label>
            <input name="label" placeholder="Pools" className="input" />
          </div>
          <div>
            <label className="label">Type</label>
            <select name="type" className="input">
              <option value="number">number</option>
              <option value="text">text</option>
              <option value="checkbox">checkbox</option>
              <option value="dropdown">dropdown</option>
            </select>
          </div>
          <button className="btn-secondary" type="submit">Add field</button>
        </form>
      </section>
    </div>
  );
}

function ConfigList({
  title,
  items,
  addAction,
  deleteAction,
  addFields,
}: {
  title: string;
  items: { id: string; label: string }[];
  addAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  addFields: { name: string; placeholder: string }[];
}) {
  return (
    <section className="card p-6">
      <h2 className="mb-4 font-semibold text-gray-900">{title}</h2>
      <ul className="mb-4 divide-y divide-gray-100">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between py-2 text-sm">
            <span>{it.label}</span>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={it.id} />
              <button className="text-xs text-red-600 hover:underline" type="submit">Remove</button>
            </form>
          </li>
        ))}
        {items.length === 0 && <li className="py-2 text-sm text-gray-400">None yet.</li>}
      </ul>
      <form action={addAction} className="flex items-end gap-2">
        {addFields.map((f) => (
          <input key={f.name} name={f.name} placeholder={f.placeholder} className="input" />
        ))}
        <button className="btn-secondary" type="submit">Add</button>
      </form>
    </section>
  );
}
