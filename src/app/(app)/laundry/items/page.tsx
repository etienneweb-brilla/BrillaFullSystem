import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { getFinanceSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { createLaundryItem, toggleLaundryItem } from "../actions";

export default async function LaundryItemsPage() {
  await requireSection("laundry");
  const [items, finance] = await Promise.all([
    db.laundryItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    getFinanceSettings(),
  ]);
  const cur = finance.currency;

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/laundry" className="text-sm text-brand-dark hover:underline">← Laundry</Link>
      </div>
      <PageHeader title="Laundry Items" subtitle="The catalogue. Prices live here; quantities come from each property's linen setup." />

      <div className="mb-6 card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="th">Item</th>
              <th className="th">Category</th>
              <th className="th">Client price</th>
              <th className="th">Supplier cost</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it) => (
              <tr key={it.id} className={it.active ? "" : "opacity-50"}>
                <td className="td font-medium">{it.name}</td>
                <td className="td">{it.category ?? "—"}</td>
                <td className="td">{money(it.clientPrice, cur)}</td>
                <td className="td">{money(it.supplierCost, cur)}</td>
                <td className="td">{it.active ? "active" : "inactive"}</td>
                <td className="td">
                  <form action={toggleLaundryItem}>
                    <input type="hidden" name="id" value={it.id} />
                    <button className="text-xs text-brand-dark hover:underline" type="submit">
                      {it.active ? "deactivate" : "activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td className="td text-gray-400" colSpan={6}>No items yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Add Item</h2>
        <form action={createLaundryItem} className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="col-span-2">
            <label className="label">Name *</label>
            <input name="name" required className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Category</label>
            <input name="category" className="input" />
          </div>
          <div>
            <label className="label">Client price</label>
            <input name="clientPrice" type="number" step="0.01" className="input" />
          </div>
          <div>
            <label className="label">Supplier cost</label>
            <input name="supplierCost" type="number" step="0.01" className="input" />
          </div>
          <div>
            <label className="label">Internal cost</label>
            <input name="internalCost" type="number" step="0.01" className="input" />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit">Add</button>
          </div>
        </form>
      </section>
    </div>
  );
}
