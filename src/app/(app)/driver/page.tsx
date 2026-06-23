import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import { setBatchStage, uploadBatchProof, addBatchNote } from "./actions";

export const dynamic = "force-dynamic";

export default async function DriverPage() {
  const user = await requireSection("mytasks");
  if (!user.staffProfileId) return <p className="text-sm text-gray-500">No staff profile linked.</p>;

  const batches = await db.laundryBatch.findMany({
    where: { driverStaffId: user.staffProfileId, status: { notIn: ["completed", "verified"] } },
    orderBy: { createdAt: "desc" },
    include: { supplier: true, items: { include: { property: true } } },
  });

  // Group: to collect (created) vs to deliver (returned-from-supplier stages)
  const toCollect = batches.filter((b) => b.status === "created");
  const toDeliver = batches.filter((b) => ["sent", "processing", "collected"].includes(b.status));

  const today = new Date();
  const summary = {
    collections: toCollect.length,
    deliveries: toDeliver.length,
    batches: batches.length,
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Driver — {dateOnly(today)}</h1>
      <p className="mb-4 text-sm text-gray-500">Your laundry runs</p>

      <div className="mb-6 grid grid-cols-3 gap-2">
        <Stat label="Collections" value={summary.collections} />
        <Stat label="Deliveries" value={summary.deliveries} />
        <Stat label="Batches" value={summary.batches} />
      </div>

      <Group title="To collect" batches={toCollect} stage="collected" />
      <Group title="To deliver" batches={toDeliver} stage="returned" />

      {batches.length === 0 && <div className="card p-8 text-center text-sm text-gray-500">No active runs.</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

type BatchWithItems = {
  id: string;
  number: string;
  status: string;
  notes: string | null;
  supplier: { name: string } | null;
  items: { id: string; itemName: string; collectedQty: number; property: { name: string; address: string | null; accessInstructions: string | null; parkingInstructions: string | null } | null }[];
};

function Group({ title, batches, stage }: { title: string; batches: BatchWithItems[]; stage: "collected" | "returned" }) {
  if (batches.length === 0) return null;
  return (
    <div className="mb-6">
      <p className="mb-2 text-sm font-semibold text-gray-700">{title}</p>
      <ul className="space-y-3">
        {batches.map((b) => {
          // Unique properties for pickup/drop-off display.
          const props = Array.from(new Map(b.items.filter((i) => i.property).map((i) => [i.property!.name, i.property!])).values());
          const totalQty = b.items.reduce((s, i) => s + i.collectedQty, 0);
          return (
            <li key={b.id} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{b.number}</p>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-1 text-sm text-gray-500">{b.supplier?.name ?? "internal"} · {totalQty} pcs</p>

              {props.map((p) => (
                <div key={p.name} className="mt-2 rounded bg-gray-50 p-2 text-sm">
                  <p className="font-medium text-gray-800">{p.name}</p>
                  {p.address && <p className="text-gray-500">{p.address}</p>}
                  {p.accessInstructions && <p className="text-xs text-amber-700">Access: {p.accessInstructions}</p>}
                  {p.parkingInstructions && <p className="text-xs text-gray-500">Parking: {p.parkingInstructions}</p>}
                </div>
              ))}

              {b.notes && <p className="mt-2 whitespace-pre-line text-xs text-gray-500">Notes: {b.notes}</p>}

              <form action={setBatchStage} className="mt-3">
                <input type="hidden" name="batchId" value={b.id} />
                <input type="hidden" name="status" value={stage} />
                <button className="btn-big bg-brand text-white hover:bg-brand-dark" type="submit">
                  {stage === "collected" ? "Mark collected" : "Mark delivered"}
                </button>
              </form>

              <form action={uploadBatchProof} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="batchId" value={b.id} />
                <input type="file" name="photo" accept="image/*" capture="environment" className="text-sm" required />
                <button className="btn-secondary" type="submit">Upload proof</button>
              </form>

              <form action={addBatchNote} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="batchId" value={b.id} />
                <input name="note" placeholder="Add a note…" className="input" />
                <button className="btn-secondary" type="submit">Add</button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
