import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader, StatusBadge } from "@/components/ui";
import { createSupplier, updateSupplierStatus } from "./actions";

export default async function SuppliersPage() {
  await requireSection("suppliers");
  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: { laundryBatches: { select: { id: true } } },
  });

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Outsourced partners (laundry now, any service later)." />

      <div className="mb-6 card overflow-hidden">
        {suppliers.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No suppliers yet.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Service</th>
                <th className="th">Contact</th>
                <th className="th">Batches</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="td font-medium text-gray-900">{s.name}</td>
                  <td className="td">{s.serviceType ?? "—"}</td>
                  <td className="td">{s.contactPerson ? `${s.contactPerson} · ` : ""}{s.email ?? s.phone ?? "—"}</td>
                  <td className="td">{s.laundryBatches.length}</td>
                  <td className="td"><StatusBadge status={s.status === "active" ? "completed" : "cancelled"} /></td>
                  <td className="td">
                    <form action={updateSupplierStatus}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="status" value={s.status === "active" ? "inactive" : "active"} />
                      <button className="text-xs text-brand-dark hover:underline" type="submit">
                        {s.status === "active" ? "deactivate" : "activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Add Supplier</h2>
        <form action={createSupplier} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Name *</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Service type</label>
            <input name="serviceType" placeholder="Laundry" className="input" />
          </div>
          <div>
            <label className="label">Contact person</label>
            <input name="contactPerson" className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" className="input" />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input">
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea name="notes" rows={2} className="input" />
          </div>
          <div className="md:col-span-2">
            <button className="btn-primary" type="submit">Add supplier</button>
          </div>
        </form>
      </section>
    </div>
  );
}
