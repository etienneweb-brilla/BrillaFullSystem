import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { updateIssue } from "../actions";

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("issues");
  const { id } = await params;
  const issue = await db.issue.findUnique({ where: { id } });
  if (!issue) notFound();

  const [staff, property, workOrder] = await Promise.all([
    db.staffProfile.findMany({ where: { active: true }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    issue.propertyId ? db.property.findUnique({ where: { id: issue.propertyId } }) : null,
    issue.workOrderId ? db.workOrder.findUnique({ where: { id: issue.workOrderId } }) : null,
  ]);

  const updateBound = updateIssue.bind(null, issue.id);

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href="/issues" className="text-sm text-brand-dark hover:underline">← All issues</Link>
      </div>
      <PageHeader title={issue.title} subtitle={`${issue.type.replace(/_/g, " ")} · logged ${dateTime(issue.createdAt)}`} />

      <div className="mb-6 flex items-center gap-3">
        <StatusBadge status={issue.status} />
        <span className="text-sm text-gray-500">priority: {issue.priority}</span>
      </div>

      {issue.description && (
        <section className="card mb-6 p-4">
          <p className="text-sm text-gray-700">{issue.description}</p>
        </section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        {property && (
          <div className="card p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">Property</p>
            <Link href={`/properties/${property.id}`} className="font-medium text-brand-dark hover:underline">{property.name}</Link>
          </div>
        )}
        {workOrder && (
          <div className="card p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">Work order</p>
            <Link href={`/workorders/${workOrder.id}`} className="font-medium text-brand-dark hover:underline">{workOrder.number}</Link>
          </div>
        )}
      </div>

      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Manage</h2>
        <form action={updateBound} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={issue.status} className="input">
                <option value="open">open</option>
                <option value="in_progress">in progress</option>
                <option value="resolved">resolved</option>
                <option value="closed">closed</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select name="priority" defaultValue={issue.priority} className="input">
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
                <option value="urgent">urgent</option>
              </select>
            </div>
            <div>
              <label className="label">Assign to</label>
              <select name="assignedToId" defaultValue={issue.assignedToId ?? ""} className="input">
                <option value="">—</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Resolution notes</label>
            <textarea name="resolution" rows={3} defaultValue={issue.resolution ?? ""} className="input" />
          </div>
          <button className="btn-primary" type="submit">Save</button>
        </form>
      </section>
    </div>
  );
}
