import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui";
import { approveTask, rejectTask } from "./actions";

export default async function QcPage() {
  await requireSection("qc");
  const pending = await db.task.findMany({
    where: { status: "completed", qualityStatus: "pending_review" },
    orderBy: { completedAt: "asc" },
    include: {
      workOrder: { include: { property: true } },
      assignedStaff: { include: { user: true } },
      attachments: true,
    },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Quality Control" subtitle="Review completed work. Rejecting a task creates a revisit." />

      {pending.length === 0 ? (
        <EmptyState message="Nothing awaiting review." />
      ) : (
        <ul className="space-y-4">
          {pending.map((t) => (
            <li key={t.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">
                    {t.workOrder.property.name}
                    {t.assignedStaff && ` · ${t.assignedStaff.user.name}`} · {dateTime(t.completedAt)}
                  </p>
                </div>
                <Link href={`/workorders/${t.workOrderId}`} className="text-sm text-brand-dark hover:underline">work order →</Link>
              </div>

              {t.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.attachments.map((a) => (
                    <img key={a.id} src={a.url} alt={a.fileType} className="h-20 w-20 rounded object-cover" />
                  ))}
                </div>
              )}
              {t.notes && <p className="mt-2 text-sm text-gray-600">Notes: {t.notes}</p>}

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <form action={approveTask} className="flex items-end gap-2">
                  <input type="hidden" name="taskId" value={t.id} />
                  <input name="reviewNotes" placeholder="review note (optional)" className="input w-56 py-1.5" />
                  <button className="btn-primary py-1.5 text-xs" type="submit">Approve</button>
                </form>
                <form action={rejectTask}>
                  <input type="hidden" name="taskId" value={t.id} />
                  <button className="btn-danger py-1.5 text-xs" type="submit">Reject → revisit</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
