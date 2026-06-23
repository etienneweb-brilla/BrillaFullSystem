import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { toggleEligibility, updatePayroll } from "../actions";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("staff");
  const { id } = await params;
  const staff = await db.staffProfile.findUnique({
    where: { id },
    include: {
      user: { include: { roles: { include: { role: true } } } },
      eligibility: true,
      payrollRule: true,
    },
  });
  if (!staff) notFound();

  const services = await db.service.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const eligibleIds = new Set(staff.eligibility.map((e) => e.serviceId));

  const toggleBound = toggleEligibility.bind(null, staff.id);
  const payrollBound = updatePayroll.bind(null, staff.id);
  const pr = staff.payrollRule;

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/staff" className="text-sm text-brand-dark hover:underline">← All staff</Link>
      </div>
      <PageHeader title={staff.user.name} subtitle={`${staff.user.email} · ${staff.user.roles.map((r) => r.role.name).join(", ")}`} />

      {/* Service eligibility */}
      <section className="card mb-6 p-6">
        <h2 className="mb-1 font-semibold text-gray-900">Service Eligibility</h2>
        <p className="mb-4 text-sm text-gray-500">
          Only eligible staff can be assigned to a service line. The scheduler blocks invalid assignments.
        </p>
        <div className="space-y-2">
          {services.map((s) => (
            <form key={s.id} action={toggleBound} className="flex items-center justify-between">
              <span className="text-sm">{s.name}</span>
              <input type="hidden" name="serviceId" value={s.id} />
              <button
                type="submit"
                className={eligibleIds.has(s.id) ? "btn-primary py-1.5 text-xs" : "btn-secondary py-1.5 text-xs"}
              >
                {eligibleIds.has(s.id) ? "Eligible ✓ (click to remove)" : "Not eligible (click to enable)"}
              </button>
            </form>
          ))}
          {services.length === 0 && <p className="text-sm text-gray-400">No services defined yet.</p>}
        </div>
      </section>

      {/* Payroll */}
      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Payroll &amp; Commission</h2>
        <form action={payrollBound} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Pay type</label>
            <select name="payType" defaultValue={pr?.payType ?? "hourly"} className="input">
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
            <input name="baseHourlyRate" type="number" step="0.01" defaultValue={pr?.baseHourlyRate ?? 0} className="input" />
          </div>
          <div>
            <label className="label">Overtime rate</label>
            <input name="overtimeRate" type="number" step="0.01" defaultValue={pr?.overtimeRate ?? 0} className="input" />
          </div>
          <div>
            <label className="label">Commission %</label>
            <input name="commissionPercent" type="number" step="0.01" defaultValue={pr?.commissionPercent ?? 0} className="input" />
          </div>
          <div>
            <label className="label">Commission fixed</label>
            <input name="commissionFixed" type="number" step="0.01" defaultValue={pr?.commissionFixed ?? 0} className="input" />
          </div>
          <div>
            <label className="label">Min per job</label>
            <input name="minPerJob" type="number" step="0.01" defaultValue={pr?.minPerJob ?? 0} className="input" />
          </div>
          <div className="md:col-span-3">
            <button className="btn-primary" type="submit">Save payroll rule</button>
          </div>
        </form>
      </section>
    </div>
  );
}
