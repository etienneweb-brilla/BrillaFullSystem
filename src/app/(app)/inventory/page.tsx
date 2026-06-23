import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { getFinanceSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { addCategory, createItem, adjustStock, logUsage } from "./actions";

export default async function InventoryPage() {
  await requireSection("inventory");
  const [items, categories, lines, finance] = await Promise.all([
    db.inventoryItem.findMany({ orderBy: { name: "asc" }, include: { category: true } }),
    db.inventoryCategory.findMany({ orderBy: { name: "asc" } }),
    db.serviceLine.findMany({
      where: { status: { notIn: ["completed", "cancelled"] } },
      include: { workOrder: true, serviceVersion: { include: { service: true } } },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    getFinanceSettings(),
  ]);
  const cur = finance.currency;
  const lowCount = items.filter((i) => i.stockLevel <= i.lowStockThreshold).length;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Inventory" subtitle={lowCount > 0 ? `${lowCount} item(s) at or below low-stock threshold.` : "Stock levels and usage."} />

      <section className="card mb-6 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="th">Item</th>
              <th className="th">Category</th>
              <th className="th text-right">Stock</th>
              <th className="th text-right">Cost</th>
              <th className="th">Restock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it) => {
              const low = it.stockLevel <= it.lowStockThreshold;
              return (
                <tr key={it.id} className={low ? "bg-red-50" : ""}>
                  <td className="td font-medium">
                    {it.name}
                    {low && <span className="badge ml-2 bg-red-100 text-red-700">low</span>}
                  </td>
                  <td className="td">{it.category?.name ?? "—"}</td>
                  <td className="td text-right">{it.stockLevel} {it.unit}</td>
                  <td className="td text-right">{money(it.cost, cur)}</td>
                  <td className="td">
                    <form action={adjustStock} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={it.id} />
                      <input name="delta" type="number" step="0.01" placeholder="+/-" className="input w-20 py-1" />
                      <button className="text-xs text-brand-dark hover:underline" type="submit">apply</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td className="td text-gray-400" colSpan={5}>No items yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Add item */}
        <section className="card p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Add Item</h2>
          <form action={createItem} className="space-y-3">
            <input name="name" placeholder="Item name" className="input" required />
            <div className="grid grid-cols-2 gap-2">
              <select name="categoryId" className="input">
                <option value="">category…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input name="unit" placeholder="unit" defaultValue="unit" className="input" />
              <input name="stockLevel" type="number" step="0.01" placeholder="stock" className="input" />
              <input name="lowStockThreshold" type="number" step="0.01" placeholder="low threshold" className="input" />
              <input name="cost" type="number" step="0.01" placeholder="unit cost" className="input" />
            </div>
            <button className="btn-primary" type="submit">Add item</button>
          </form>
          <form action={addCategory} className="mt-4 flex items-end gap-2 border-t border-gray-100 pt-4">
            <input name="name" placeholder="New category" className="input" />
            <button className="btn-secondary" type="submit">Add category</button>
          </form>
        </section>

        {/* Log usage */}
        <section className="card p-6">
          <h2 className="mb-1 font-semibold text-gray-900">Log Usage</h2>
          <p className="mb-4 text-sm text-gray-500">Decrements stock. Linking a service line adds the cost to its profit calculation.</p>
          <form action={logUsage} className="space-y-3">
            <select name="itemId" className="input" required>
              <option value="">item…</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.stockLevel} {i.unit})</option>)}
            </select>
            <input name="qty" type="number" step="0.01" placeholder="quantity used" className="input" required />
            <select name="serviceLineId" className="input">
              <option value="">link to service line (optional)…</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>{l.workOrder.number} · {l.serviceVersion.service.name}</option>
              ))}
            </select>
            <input name="note" placeholder="note" className="input" />
            <button className="btn-primary" type="submit">Log usage</button>
          </form>
        </section>
      </div>
    </div>
  );
}
