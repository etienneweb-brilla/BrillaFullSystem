"use client";

import { useState } from "react";

interface Line {
  propertyId: string;
  laundryItemId: string;
  itemName: string;
  collectedQty: number;
}

export default function NewBatchForm({
  properties,
  items,
  suppliers,
  drivers,
  action,
}: {
  properties: { id: string; name: string }[];
  items: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  drivers: { id: string; name: string }[];
  action: (formData: FormData) => void;
}) {
  const [mode, setMode] = useState("outsourced");
  const [lines, setLines] = useState<Line[]>([{ propertyId: "", laundryItemId: "", itemName: "", collectedQty: 1 }]);

  const update = (i: number, next: Line) => setLines(lines.map((l, j) => (j === i ? next : l)));
  const setItem = (i: number, itemId: string) => {
    const item = items.find((it) => it.id === itemId);
    update(i, { ...lines[i], laundryItemId: itemId, itemName: item?.name ?? "" });
  };

  function submit(formData: FormData) {
    formData.set("lines", JSON.stringify(lines.filter((l) => l.itemName && l.collectedQty > 0)));
    action(formData);
  }

  return (
    <form action={submit} className="space-y-6">
      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Batch details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Fulfilment mode</label>
            <select name="fulfilmentMode" value={mode} onChange={(e) => setMode(e.target.value)} className="input">
              <option value="outsourced">outsourced</option>
              <option value="internal">internal</option>
              <option value="mixed">mixed</option>
            </select>
          </div>
          {mode !== "internal" && (
            <div>
              <label className="label">Supplier</label>
              <select name="supplierId" className="input">
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Driver (collection)</label>
            <select name="driverStaffId" className="input">
              <option value="">—</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="label">Notes</label>
            <input name="notes" className="input" />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Items collected (counted)</h2>
          <button
            type="button"
            className="btn-secondary py-1.5 text-xs"
            onClick={() => setLines([...lines, { propertyId: "", laundryItemId: "", itemName: "", collectedQty: 1 }])}
          >
            + Add line
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select value={l.propertyId} onChange={(e) => update(i, { ...l, propertyId: e.target.value })} className="input w-52">
                <option value="">property…</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={l.laundryItemId} onChange={(e) => setItem(i, e.target.value)} className="input w-48">
                <option value="">item…</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
              <input
                type="number"
                min={1}
                value={l.collectedQty}
                onChange={(e) => update(i, { ...l, collectedQty: parseInt(e.target.value, 10) || 0 })}
                className="input w-24"
              />
              <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <button type="submit" className="btn-primary">Create batch</button>
    </form>
  );
}
