import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getFinanceSettings } from "@/lib/settings";
import { money, dateTime, parseJson } from "@/lib/format";
import { computeServiceLinePay, type PayrollRuleConfig } from "@/lib/payroll";
import { PageHeader, StatusBadge } from "@/components/ui";
import AddServiceLineForm from "../AddServiceLineForm";
import {
  addServiceLine,
  assignServiceLine,
  setWorkOrderStatus,
  setServiceLineStatus,
  deleteServiceLine,
} from "../actions";
import { generateInvoice } from "../../invoices/actions";

const WO_STATUSES = ["draft", "scheduled", "in_progress", "partially_completed", "completed", "cancelled", "invoiced", "paid"];
const LINE_STATUSES = ["pending", "assigned", "in_progress", "completed", "on_hold", "cancelled"];

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSection("workorders");
  const { id } = await params;
  const { error } = await searchParams;

  const wo = await db.workOrder.findUnique({
    where: { id },
    include: {
      client: true,
      property: true,
      invoices: true,
      serviceLines: {
        include: {
          serviceVersion: { include: { service: true } },
          assignedStaff: { include: { user: true } },
          tasks: { include: { assignedStaff: { include: { user: true } } } },
        },
      },
    },
  });
  if (!wo) notFound();

  const [services, staff, finance] = await Promise.all([
    db.service.findMany({
      where: { active: true, versions: { some: { isActive: true } } },
      include: { versions: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1 } },
    }),
    db.staffProfile.findMany({ where: { active: true }, include: { user: true, eligibility: true } }),
    getFinanceSettings(),
  ]);

  const serviceOptions = services
    .filter((s) => s.versions[0])
    .map((s) => ({ id: s.id, name: s.name, pricingType: s.versions[0].pricingType }));

  // Totals + profit (spec §27)
  const revenue = wo.serviceLines.reduce((sum, l) => sum + l.price, 0);
  const costs = wo.serviceLines.reduce((sum, l) => sum + l.supplierCost + l.materialCost + l.driverCost, 0);

  const addLineBound = addServiceLine.bind(null, wo.id);
  const assignBound = assignServiceLine.bind(null, wo.id);
  const setLineStatusBound = setServiceLineStatus.bind(null, wo.id);
  const deleteLineBound = deleteServiceLine.bind(null, wo.id);
  const setWoStatusBound = setWorkOrderStatus.bind(null, wo.id);

  return (
    <div className="max-w-5xl">
      <div className="mb-4">
        <Link href="/workorders" className="text-sm text-brand-dark hover:underline">← All work orders</Link>
      </div>
      <PageHeader title={wo.number} subtitle={`${wo.client.name} · ${wo.property.name} · ${dateTime(wo.scheduledAt)}`} />

      {error === "not_eligible" && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          That staff member is not eligible for the selected service. Enable the service on their staff profile first.
        </div>
      )}

      {/* Status + totals */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <form action={setWoStatusBound} className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <select name="status" defaultValue={wo.status} className="input w-44">
            {WO_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <button className="btn-secondary py-1.5 text-xs" type="submit">Update</button>
        </form>
        <div className="flex gap-6 text-sm">
          <Metric label="Revenue" value={money(revenue, finance.currency)} />
          <Metric label="Costs" value={money(costs, finance.currency)} />
          <Metric label="Profit" value={money(revenue - costs, finance.currency)} />
        </div>
      </div>

      {/* Service lines */}
      <section className="card mb-6">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Service Lines</h2>
        </div>
        {wo.serviceLines.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No service lines yet. Add one below.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {wo.serviceLines.map((line) => {
              const payCfg = parseJson<PartialPayConfig>(line.payrollConfig, {});
              const pay = computeServiceLinePay(
                {
                  payType: (payCfg.payType as PayrollRuleConfig["payType"]) ?? "commission",
                  commissionPercent: payCfg.commissionPercent ?? 0,
                  baseHourlyRate: payCfg.baseHourlyRate ?? 0,
                },
                { serviceLinePrice: line.price },
              );
              return (
                <li key={line.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {line.serviceVersion.service.name}{" "}
                        <span className="text-xs text-gray-400">v{line.serviceVersion.version} · {line.fulfilmentMode}</span>
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {money(line.price, finance.currency)} · commission to staff: {money(pay.commission, finance.currency)}{" "}
                        <span className="text-gray-400">({pay.basis})</span>
                      </p>
                    </div>
                    <StatusBadge status={line.status} />
                  </div>

                  {/* Assign + status controls */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={assignBound} className="flex items-center gap-2">
                      <input type="hidden" name="lineId" value={line.id} />
                      <select name="staffId" defaultValue={line.assignedStaffId ?? ""} className="input w-56">
                        <option value="">— unassigned —</option>
                        {staff.map((sp) => {
                          const eligible = sp.eligibility.some((e) => e.serviceId === line.serviceVersion.serviceId);
                          return (
                            <option key={sp.id} value={sp.id}>
                              {sp.user.name}{eligible ? "" : " (not eligible)"}
                            </option>
                          );
                        })}
                      </select>
                      <button className="btn-secondary py-1.5 text-xs" type="submit">Assign</button>
                    </form>
                    <form action={setLineStatusBound} className="flex items-center gap-2">
                      <input type="hidden" name="lineId" value={line.id} />
                      <select name="status" defaultValue={line.status} className="input w-40">
                        {LINE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                      </select>
                      <button className="btn-secondary py-1.5 text-xs" type="submit">Set</button>
                    </form>
                    <form action={deleteLineBound}>
                      <input type="hidden" name="lineId" value={line.id} />
                      <button className="text-xs text-red-600 hover:underline" type="submit">remove</button>
                    </form>
                  </div>

                  {/* Tasks */}
                  {line.tasks.length > 0 && (
                    <ul className="mt-3 space-y-1 rounded-md bg-gray-50 p-3 text-sm">
                      {line.tasks.map((t) => (
                        <li key={t.id} className="flex items-center justify-between">
                          <span>
                            {t.name}
                            {t.requiredRoleKey && <span className="ml-2 text-xs text-gray-400">[{t.requiredRoleKey}]</span>}
                            {t.assignedStaff && <span className="ml-2 text-xs text-gray-500">→ {t.assignedStaff.user.name}</span>}
                          </span>
                          <StatusBadge status={t.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Add service line */}
      <section className="card mb-6 p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Add Service Line</h2>
        <AddServiceLineForm services={serviceOptions} action={addLineBound} />
      </section>

      {/* Invoice */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Invoicing</h2>
          {wo.invoices.length === 0 ? (
            <form action={generateInvoice}>
              <input type="hidden" name="workOrderId" value={wo.id} />
              <button className="btn-primary" type="submit" disabled={wo.serviceLines.length === 0}>
                Generate invoice
              </button>
            </form>
          ) : (
            <div className="flex gap-3 text-sm">
              {wo.invoices.map((inv) => (
                <Link key={inv.id} href={`/invoices/${inv.id}`} className="text-brand-dark hover:underline">
                  {inv.number} ({inv.status})
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type PartialPayConfig = {
  payType?: string;
  commissionPercent?: number;
  baseHourlyRate?: number;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="font-semibold text-gray-800">{value}</p>
    </div>
  );
}
