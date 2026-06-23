import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader, FormError } from "@/components/ui";
import { createStaff } from "../actions";

export default async function NewStaffPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireSection("staff");
  const { error } = await searchParams;
  const roles = await db.role.findMany({ where: { isStaffRole: true }, orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl">
      <PageHeader title="New Staff Member" subtitle="Creates a login account, profile, and payroll rule." />
      <form action={createStaff} className="card space-y-4 p-6">
        {error === "email_taken" && <FormError error="That email is already in use." />}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Name *</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Email (login) *</label>
            <input name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label">Temporary password *</label>
            <input name="password" required className="input" />
          </div>
          <div>
            <label className="label">Role *</label>
            <select name="roleKey" required className="input">
              <option value="">—</option>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">Employee type</label>
            <select name="employeeType" className="input">
              <option value="full-time">full-time</option>
              <option value="part-time">part-time</option>
              <option value="contractor">contractor</option>
              <option value="outsourced">outsourced</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="transportAvailable" /> Has own transport
        </label>

        <fieldset className="rounded-md border border-gray-200 p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Pay rule</legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="label">Pay type</label>
              <select name="payType" className="input">
                <option value="hourly">hourly</option>
                <option value="commission">commission</option>
                <option value="hybrid">hybrid</option>
                <option value="perServiceLine">per service line</option>
                <option value="perTask">per task</option>
                <option value="salary">salary</option>
              </select>
            </div>
            <div>
              <label className="label">Base hourly rate</label>
              <input name="baseHourlyRate" type="number" step="0.01" className="input" />
            </div>
            <div>
              <label className="label">Commission %</label>
              <input name="commissionPercent" type="number" step="0.01" className="input" />
            </div>
          </div>
        </fieldset>

        <button className="btn-primary" type="submit">Create staff member</button>
      </form>
    </div>
  );
}
