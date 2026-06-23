import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import PrintButton from "../../invoices/[id]/PrintButton";
import { setBatchStatus, assignBatch, recordReturns } from "../actions";

const BATCH_FLOW = ["created", "collected", "sent", "processing", "returned", "verified", "completed"];

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("laundry");
  const { id } = await params;
  const batch = await db.laundryBatch.findUnique({
    where: { id },
    include: {
      supplier: true,
      driver: { include: { user: true } },
      workOrder: true,
      items: { include: { property: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!batch) notFound();

  const [suppliers, drivers] = await Promise.all([
    db.supplier.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    db.staffProfile.findMany({
      where: { active: true, user: { roles: { some: { role: { key: "driver" } } } } },
      include: { user: true },
    }),
  ]);

  const totalCollected = batch.items.reduce((s, i) => s + i.collectedQty, 0);
  const totalReturned = batch.items.reduce((s, i) => s + i.returnedQty, 0);
  const totalDamaged = batch.items.reduce((s, i) => s + i.damagedQty, 0);
  const totalMissing = batch.items.reduce((s, i) => s + Math.max(i.collectedQty - i.returnedQty - i.damagedQty, 0), 0);

  const setStatusBound = setBatchStatus.bind(null, batch.id);
  const assignBound = assignBatch.bind(null, batch.id);
  const returnsBound = recordReturns.bind(null, batch.id);

  const verificationStage = ["sent", "processing", "returned", "verified", "completed"].includes(batch.status);

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/laundry" className="text-sm text-brand-dark hover:underline">← Laundry</Link>
        <PrintButton />
      </div>
      <PageHeader title={`Batch ${batch.number}`} subtitle={`${batch.fulfilmentMode} · created ${dateTime(batch.createdAt)}`} />

      {/* Lifecycle */}
      <section className="card mb-6 p-4 print:hidden">
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge status={batch.status} />
          <span className="text-sm text-gray-500">
            {totalCollected} collected · {totalReturned} returned · {totalDamaged} damaged · {totalMissing} missing
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {BATCH_FLOW.map((s) => (
            <form key={s} action={setStatusBound}>
              <input type="hidden" name="status" value={s} />
              <button
                type="submit"
                className={batch.status === s ? "btn-primary py-1.5 text-xs" : "btn-secondary py-1.5 text-xs"}
              >
                {s}
              </button>
            </form>
          ))}
        </div>
      </section>

      {/* Assignment */}
      <section className="card mb-6 p-4 print:hidden">
        <h2 className="mb-3 font-semibold text-gray-900">Assignment</h2>
        <form action={assignBound} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Mode</label>
            <select name="fulfilmentMode" defaultValue={batch.fulfilmentMode} className="input w-36">
              <option value="outsourced">outsourced</option>
              <option value="internal">internal</option>
              <option value="mixed">mixed</option>
            </select>
          </div>
          <div>
            <label className="label">Supplier</label>
            <select name="supplierId" defaultValue={batch.supplierId ?? ""} className="input w-48">
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Driver</label>
            <select name="driverStaffId" defaultValue={batch.driverStaffId ?? ""} className="input w-48">
              <option value="">—</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.user.name}</option>)}
            </select>
          </div>
          <button className="btn-secondary" type="submit">Save</button>
        </form>
      </section>

      {/* Manifest (printable) */}
      <section id="invoice-print" className="card mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-dark">Laundry Manifest</h2>
            <p className="text-sm text-gray-500">
              Batch {batch.number} · {batch.supplier?.name ?? batch.fulfilmentMode}
              {batch.driver && ` · driver ${batch.driver.user.name}`}
            </p>
          </div>
          <StatusBadge status={batch.status} />
        </div>
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="th">Property</th>
              <th className="th">Item</th>
              <th className="th text-right">Collected</th>
              <th className="th text-right">Returned</th>
              <th className="th text-right">Damaged</th>
              <th className="th text-right">Missing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batch.items.map((it) => {
              const missing = Math.max(it.collectedQty - it.returnedQty - it.damagedQty, 0);
              return (
                <tr key={it.id} className={missing > 0 || it.damagedQty > 0 ? "bg-red-50" : ""}>
                  <td className="td">{it.property?.name ?? "—"}</td>
                  <td className="td">{it.itemName}</td>
                  <td className="td text-right">{it.collectedQty}</td>
                  <td className="td text-right">{it.returnedQty}</td>
                  <td className="td text-right">{it.damagedQty}</td>
                  <td className="td text-right font-medium">{missing > 0 ? missing : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Return verification (spec 15.7) */}
      {verificationStage && batch.status !== "completed" && (
        <section className="card p-6 print:hidden">
          <h2 className="mb-1 font-semibold text-gray-900">Return Verification</h2>
          <p className="mb-4 text-sm text-gray-500">
            Count returned and damaged items. Any shortfall is flagged and automatically raises an issue.
          </p>
          <form action={returnsBound} className="space-y-3">
            {batch.items.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-2">
                <span className="w-56 text-sm">
                  {it.itemName} <span className="text-gray-400">({it.property?.name ?? "—"})</span>
                </span>
                <span className="text-xs text-gray-500">collected {it.collectedQty}</span>
                <label className="text-xs text-gray-600">
                  returned
                  <input name={`returned_${it.id}`} type="number" min={0} defaultValue={it.returnedQty} className="input ml-1 w-20" />
                </label>
                <label className="text-xs text-gray-600">
                  damaged
                  <input name={`damaged_${it.id}`} type="number" min={0} defaultValue={it.damagedQty} className="input ml-1 w-20" />
                </label>
              </div>
            ))}
            <button className="btn-primary" type="submit">Verify returns</button>
          </form>
        </section>
      )}
    </div>
  );
}
