import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import { clockIn, clockOut, driverUpdateBatch } from "./actions";

export default async function MyTasksPage() {
  const user = await requireSection("mytasks");
  if (!user.staffProfileId) {
    return <p className="text-sm text-gray-500">No staff profile linked to your account.</p>;
  }

  const [tasks, openClock, batches] = await Promise.all([
    db.task.findMany({
      where: { assignedStaffId: user.staffProfileId, status: { notIn: ["completed", "cancelled"] } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      include: { workOrder: { include: { property: true } } },
    }),
    db.timeEntry.findFirst({ where: { staffId: user.staffProfileId, clockOut: null } }),
    db.laundryBatch.findMany({
      where: { driverStaffId: user.staffProfileId, status: { notIn: ["verified", "completed"] } },
      orderBy: { createdAt: "desc" },
      include: { items: true, supplier: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Hi {user.name.split(" ")[0]}</h1>
      <p className="mb-5 text-sm text-gray-500">Your tasks</p>

      {/* Clock in/out — big buttons */}
      <div className="mb-6">
        {openClock ? (
          <form action={clockOut}>
            <button className="btn-big bg-red-600 text-white hover:bg-red-700" type="submit">
              Clock out (since {dateTime(openClock.clockIn)})
            </button>
          </form>
        ) : (
          <form action={clockIn}>
            <button className="btn-big bg-brand text-white hover:bg-brand-dark" type="submit">
              Clock in
            </button>
          </form>
        )}
      </div>

      {/* Laundry runs for drivers */}
      {batches.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold text-gray-700">Laundry runs</p>
          <ul className="space-y-3">
            {batches.map((b) => {
              const qty = b.items.reduce((s, i) => s + i.collectedQty, 0);
              return (
                <li key={b.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{b.number}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{b.supplier?.name ?? b.fulfilmentMode} · {qty} pcs</p>
                  <div className="mt-3 flex gap-2">
                    <form action={driverUpdateBatch} className="flex-1">
                      <input type="hidden" name="batchId" value={b.id} />
                      <input type="hidden" name="status" value="collected" />
                      <button className="btn-big bg-brand text-white hover:bg-brand-dark" type="submit">Mark collected</button>
                    </form>
                    <form action={driverUpdateBatch} className="flex-1">
                      <input type="hidden" name="batchId" value={b.id} />
                      <input type="hidden" name="status" value="returned" />
                      <button className="btn-big bg-green-600 text-white hover:bg-green-700" type="submit">Mark returned</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">No open tasks. Nice work!</div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link href={`/me/tasks/${t.id}`} className="card block p-4 hover:border-brand">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-gray-900">{t.name}</p>
                  <StatusBadge status={t.status} />
                </div>
                <p className="mt-1 text-sm text-gray-500">{t.workOrder.property.name}</p>
                <p className="mt-1 text-sm text-gray-500">{t.workOrder.property.address}</p>
                {t.dueAt && <p className="mt-1 text-xs text-gray-400">Due {dateTime(t.dueAt)}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
