import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";

export default async function StaffPage() {
  await requireSection("staff");
  const staff = await db.staffProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { include: { roles: { include: { role: true } } } }, _count: { select: { eligibility: true } } },
  });

  return (
    <div>
      <PageHeader title="Staff" action={{ href: "/staff/new", label: "+ New staff member" }} />
      {staff.length === 0 ? (
        <EmptyState message="No staff yet." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Roles</th>
                <th className="th">Type</th>
                <th className="th">Eligible services</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map((sp) => (
                <tr key={sp.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/staff/${sp.id}`} className="font-medium text-brand-dark hover:underline">{sp.user.name}</Link>
                  </td>
                  <td className="td">{sp.user.email}</td>
                  <td className="td">{sp.user.roles.map((r) => r.role.name).join(", ")}</td>
                  <td className="td">{sp.employeeType ?? "—"}</td>
                  <td className="td">{sp._count.eligibility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
