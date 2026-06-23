import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { createClient } from "../actions";

export default async function NewClientPage() {
  await requireSection("clients");
  const clientTypes = await db.clientType.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl">
      <PageHeader title="New Client" />
      <form action={createClient} className="card space-y-4 p-6">
        <div>
          <label className="label">Name *</label>
          <input name="name" required className="input" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">Client type</label>
            <select name="clientTypeId" className="input">
              <option value="">—</option>
              {clientTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payment terms</label>
            <input name="paymentTerms" className="input" defaultValue="Due on receipt" />
          </div>
          <div>
            <label className="label">VAT number</label>
            <input name="vatNumber" className="input" />
          </div>
          <div>
            <label className="label">Billing address</label>
            <input name="billingAddress" className="input" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="input" />
        </div>
        <button className="btn-primary" type="submit">Create client</button>
      </form>
    </div>
  );
}
