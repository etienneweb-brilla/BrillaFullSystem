import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import { startTask, completeTask, uploadTaskPhoto, reportIssue } from "../../actions";

// Maps a task's required role to the relevant property instruction key (role-scoped view).
const ROLE_INSTRUCTION: Record<string, string> = {
  cleaner: "cleaning",
  laundry: "laundry",
};

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireSection("mytasks");
  const { id } = await params;
  const { error } = await searchParams;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      workOrder: { include: { property: true } },
      attachments: true,
      assignedStaff: true,
    },
  });
  if (!task) notFound();
  // A staff member can only open their own tasks.
  if (!user.staffProfileId || task.assignedStaffId !== user.staffProfileId) redirect("/me");

  const checklist = task.checklistTemplateId
    ? await db.checklistTemplate.findUnique({
        where: { id: task.checklistTemplateId },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      })
    : null;

  const property = task.workOrder.property;
  const instructions = parseJson<Record<string, string>>(property.instructions, {});
  const instrKey = task.requiredRoleKey ? ROLE_INSTRUCTION[task.requiredRoleKey] : undefined;
  const relevantInstruction = instrKey ? instructions[instrKey] : undefined;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4">
        <Link href="/me" className="text-sm text-brand-dark hover:underline">← My tasks</Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{task.name}</h1>
        <StatusBadge status={task.status} />
      </div>

      {/* Property + access info */}
      <section className="card mb-4 p-4 text-sm">
        <p className="font-semibold text-gray-900">{property.name}</p>
        <p className="text-gray-500">{property.address}</p>
        {property.accessInstructions && <p className="mt-2 text-gray-700">Access: {property.accessInstructions}</p>}
        {property.keyboxCode && <p className="text-gray-700">Keybox: {property.keyboxCode}</p>}
        {/* Only the instruction relevant to this task's role is shown (spec 14.3). */}
        {relevantInstruction && (
          <p className="mt-2 rounded bg-amber-50 p-2 text-amber-800">Instructions: {relevantInstruction}</p>
        )}
        {instructions.general && <p className="mt-2 text-gray-600">Notes: {instructions.general}</p>}
      </section>

      {error === "photo" && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          This task requires at least one photo before completing.
        </div>
      )}

      {task.status === "pending" || task.status === "assigned" ? (
        <form action={startTask} className="mb-4">
          <input type="hidden" name="taskId" value={task.id} />
          <button className="btn-big bg-brand text-white hover:bg-brand-dark" type="submit">Start task</button>
        </form>
      ) : null}

      {task.status === "completed" ? (
        <div className="card p-6 text-center text-sm text-green-700">Task completed. Thank you!</div>
      ) : (
        <>
          {/* Photos */}
          <section className="card mb-4 p-4">
            <h2 className="mb-2 font-semibold text-gray-900">
              Photos {task.photosRequired && <span className="text-xs text-red-500">(required)</span>}
            </h2>
            {task.attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {task.attachments.map((a) => (
                  <img key={a.id} src={a.url} alt={a.fileName} className="h-20 w-20 rounded object-cover" />
                ))}
              </div>
            )}
            <form action={uploadTaskPhoto} className="flex items-center gap-2">
              <input type="hidden" name="taskId" value={task.id} />
              <select name="fileType" className="input w-32">
                <option value="before">before</option>
                <option value="after">after</option>
                <option value="general">general</option>
                <option value="damage">damage</option>
              </select>
              <input type="file" name="photo" accept="image/*" capture="environment" className="text-sm" required />
              <button className="btn-secondary" type="submit">Upload</button>
            </form>
          </section>

          {/* Complete form (checklist + notes) */}
          <form action={completeTask} className="card space-y-4 p-4">
            <input type="hidden" name="taskId" value={task.id} />
            {checklist && checklist.items.length > 0 && (
              <div>
                <h2 className="mb-2 font-semibold text-gray-900">Checklist</h2>
                <ul className="space-y-2">
                  {checklist.items.map((item) => (
                    <li key={item.id}>
                      <label className="flex items-center gap-3 text-sm">
                        <input type="checkbox" name={`check_${item.id}`} className="h-5 w-5" />
                        {item.label}
                        {item.required && <span className="text-xs text-red-400">required</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <label className="label">Notes {task.notesRequired && <span className="text-xs text-red-500">(required)</span>}</label>
              <textarea name="notes" rows={3} className="input" />
            </div>
            <button className="btn-big bg-green-600 text-white hover:bg-green-700" type="submit">Complete task</button>
          </form>

          {/* Report issue */}
          <details className="card mt-4 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">Report an issue</summary>
            <form action={reportIssue} className="mt-3 space-y-3">
              <input type="hidden" name="taskId" value={task.id} />
              <div>
                <label className="label">Type</label>
                <select name="type" className="input">
                  <option value="access">Access problem</option>
                  <option value="missing_keys">Missing keys</option>
                  <option value="damage">Damage</option>
                  <option value="complaint">Complaint</option>
                  <option value="general">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Title</label>
                <input name="title" className="input" required />
              </div>
              <div>
                <label className="label">Details</label>
                <textarea name="description" rows={2} className="input" />
              </div>
              <button className="btn-secondary" type="submit">Submit issue</button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
