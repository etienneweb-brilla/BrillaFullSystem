import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { createIssue } from "./actions";

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-gray-100 text-gray-700",
  low: "bg-gray-100 text-gray-500",
};

export default async function IssuesPage() {
  await requireSection("issues");
  const [issues, properties, workOrders] = await Promise.all([
    db.issue.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    db.property.findMany({ orderBy: { name: "asc" } }),
    db.workOrder.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <div>
      <PageHeader title="Issues" subtitle="Complaints, missing/damaged items, access problems, revisits." />

      <div className="mb-6 card overflow-hidden">
        {issues.length === 0 ? (
          <EmptyState message="No issues logged." />
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Title</th>
                <th className="th">Type</th>
                <th className="th">Priority</th>
                <th className="th">Created</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {issues.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/issues/${i.id}`} className="font-medium text-brand-dark hover:underline">{i.title}</Link>
                  </td>
                  <td className="td">{i.type.replace(/_/g, " ")}</td>
                  <td className="td"><span className={`badge ${PRIORITY_CLASS[i.priority] ?? ""}`}>{i.priority}</span></td>
                  <td className="td">{dateOnly(i.createdAt)}</td>
                  <td className="td"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Log an Issue</h2>
        <form action={createIssue} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Title *</label>
            <input name="title" required className="input" />
          </div>
          <div>
            <label className="label">Type</label>
            <select name="type" className="input">
              <option value="complaint">Client complaint</option>
              <option value="missing_keys">Missing keys</option>
              <option value="missing_laundry">Missing laundry</option>
              <option value="damaged_linen">Damaged linen</option>
              <option value="access">Property access problem</option>
              <option value="equipment">Equipment issue</option>
              <option value="revisit">Revisit needed</option>
              <option value="general">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" className="input">
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
          </div>
          <div>
            <label className="label">Related property</label>
            <select name="propertyId" className="input">
              <option value="">—</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Related work order</label>
            <select name="workOrderId" className="input">
              <option value="">—</option>
              {workOrders.map((w) => <option key={w.id} value={w.id}>{w.number}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea name="description" rows={3} className="input" />
          </div>
          <div className="md:col-span-2">
            <button className="btn-primary" type="submit">Log issue</button>
          </div>
        </form>
      </section>
    </div>
  );
}
