"use client";

import { useState } from "react";
import { PRICING_TYPES } from "@/lib/pricing";

interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}
interface TaskTemplate {
  name: string;
  taskType?: string;
  requiredRoleKey?: string;
  photosRequired?: boolean;
}
interface AutomationRule {
  event: string;
  action: string;
  taskName?: string;
  requiredRoleKey?: string;
  followupDays?: number;
  issueTitle?: string;
}

export interface ServiceInitial {
  name: string;
  code: string;
  categoryId: string;
  description: string;
  isPublic: boolean;
  active: boolean;
  defaultDuration: number | "";
  pricingType: string;
  pricingConfig: Record<string, number | string>;
  pricingRules: Record<string, number>;
  defaultPrice: number | "";
  formFields: FormField[];
  taskTemplates: TaskTemplate[];
  allowedRoleKeys: string[];
  checklistTemplateId: string;
  payrollRuleConfig: Record<string, number | string>;
  automationRules: AutomationRule[];
}

const PRICING_LABELS: Record<string, string> = {
  fixed: "Fixed price",
  hourly: "Hourly (hours × rate)",
  hourlyManpower: "Hourly × manpower (hours × rate × staff)",
  perItem: "Per item (qty × item price)",
  perQuantity: "Per quantity (qty × unit price)",
  perRoom: "Per room/area (rooms × rate)",
  perAttribute: "Per property attribute (value × rate)",
  formula: "Custom formula",
  manualQuote: "Manual quote only",
};

const FIELD_TYPES = ["text", "number", "currency", "dropdown", "multiselect", "checkbox", "date", "time", "address", "notes", "photo", "signature", "quantity"];

export default function ServiceBuilderForm({
  initial,
  categories,
  roles,
  checklists,
  action,
}: {
  initial: ServiceInitial;
  categories: { id: string; name: string }[];
  roles: { key: string; name: string }[];
  checklists: { id: string; name: string }[];
  action: (formData: FormData) => void;
}) {
  const [s, setS] = useState<ServiceInitial>(initial);

  const set = <K extends keyof ServiceInitial>(key: K, value: ServiceInitial[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));
  const setCfg = (key: string, value: string) =>
    setS((prev) => ({ ...prev, pricingConfig: { ...prev.pricingConfig, [key]: value } }));
  const setRule = (key: string, value: string) =>
    setS((prev) => ({ ...prev, pricingRules: { ...prev.pricingRules, [key]: parseFloat(value) || 0 } }));

  function submit(formData: FormData) {
    const payload = {
      name: s.name,
      code: s.code,
      categoryId: s.categoryId || undefined,
      description: s.description,
      isPublic: s.isPublic,
      active: s.active,
      defaultDuration: s.defaultDuration === "" ? undefined : Number(s.defaultDuration),
      pricingType: s.pricingType,
      pricingConfig: numericize(s.pricingConfig),
      pricingRules: s.pricingRules,
      defaultPrice: s.defaultPrice === "" ? null : Number(s.defaultPrice),
      formFields: s.formFields.filter((f) => f.key && f.label),
      taskTemplates: s.taskTemplates.filter((t) => t.name),
      allowedRoleKeys: s.allowedRoleKeys,
      checklistTemplateId: s.checklistTemplateId || null,
      payrollRuleConfig: s.payrollRuleConfig,
      automationRules: s.automationRules.filter((r) => r.event && r.action),
    };
    formData.set("payload", JSON.stringify(payload));
    action(formData);
  }

  const toggleRole = (key: string) =>
    set(
      "allowedRoleKeys",
      s.allowedRoleKeys.includes(key) ? s.allowedRoleKeys.filter((k) => k !== key) : [...s.allowedRoleKeys, key],
    );

  return (
    <form action={submit} className="space-y-6">
      {/* Details */}
      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Service Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={s.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div>
            <label className="label">Code</label>
            <input className="input" value={s.code} onChange={(e) => set("code", e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={s.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Default duration (minutes)</label>
            <input className="input" type="number" value={s.defaultDuration}
              onChange={(e) => set("defaultDuration", e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={s.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={s.active} onChange={(e) => set("active", e.target.checked)} /> Active
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={s.isPublic} onChange={(e) => set("isPublic", e.target.checked)} /> Public (client-requestable)
          </label>
        </div>
      </section>

      {/* Pricing */}
      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Pricing Builder</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Pricing type</label>
            <select className="input" value={s.pricingType} onChange={(e) => set("pricingType", e.target.value)}>
              {PRICING_TYPES.map((t) => (
                <option key={t} value={t}>{PRICING_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Service default price (priority #1, optional)</label>
            <input className="input" type="number" step="0.01" value={s.defaultPrice}
              onChange={(e) => set("defaultPrice", e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          {["hourly", "hourlyManpower", "perRoom", "perAttribute"].includes(s.pricingType) && (
            <div>
              <label className="label">Rate</label>
              <input className="input" type="number" step="0.01" value={String(s.pricingConfig.rate ?? "")}
                onChange={(e) => setCfg("rate", e.target.value)} />
            </div>
          )}
          {["perItem", "perQuantity"].includes(s.pricingType) && (
            <div>
              <label className="label">Unit price</label>
              <input className="input" type="number" step="0.01" value={String(s.pricingConfig.unitPrice ?? "")}
                onChange={(e) => setCfg("unitPrice", e.target.value)} />
            </div>
          )}
          {s.pricingType === "hourlyManpower" && (
            <div>
              <label className="label">Default manpower (staff)</label>
              <input className="input" type="number" value={String(s.pricingConfig.manpower ?? "")}
                onChange={(e) => setCfg("manpower", e.target.value)} />
            </div>
          )}
          {s.pricingType === "perAttribute" && (
            <div>
              <label className="label">Property attribute key (e.g. sqm)</label>
              <input className="input" value={String(s.pricingConfig.attributeKey ?? "")}
                onChange={(e) => setCfg("attributeKey", e.target.value)} />
            </div>
          )}
          {s.pricingType === "formula" && (
            <div className="md:col-span-2">
              <label className="label">Formula (vars: rate, unitPrice, hours, manpower, quantity, itemQuantity, rooms)</label>
              <input className="input" placeholder="rate * hours * manpower + 10" value={String(s.pricingConfig.formula ?? "")}
                onChange={(e) => setCfg("formula", e.target.value)} />
            </div>
          )}
        </div>

        <h3 className="mb-2 mt-6 text-sm font-semibold text-gray-700">Pricing Rules</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["minCharge", "minHours", "deposit", "urgentFee", "weekendFee", "travelFee", "cancellationFee"] as const).map((r) => (
            <div key={r}>
              <label className="label capitalize">{r.replace(/([A-Z])/g, " $1")}</label>
              <input className="input" type="number" step="0.01" defaultValue={s.pricingRules[r] ?? ""}
                onChange={(e) => setRule(r, e.target.value)} />
            </div>
          ))}
        </div>
      </section>

      {/* Form fields */}
      <Repeater
        title="Service Form Fields"
        items={s.formFields}
        onChange={(v) => set("formFields", v as FormField[])}
        empty={{ key: "", label: "", type: "text", required: false }}
        render={(item, update) => (
          <>
            <input className="input" placeholder="key" value={item.key} onChange={(e) => update({ ...item, key: e.target.value })} />
            <input className="input" placeholder="label" value={item.label} onChange={(e) => update({ ...item, label: e.target.value })} />
            <select className="input" value={item.type} onChange={(e) => update({ ...item, type: e.target.value })}>
              {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input type="checkbox" checked={!!item.required} onChange={(e) => update({ ...item, required: e.target.checked })} /> required
            </label>
          </>
        )}
      />

      {/* Task templates */}
      <Repeater
        title="Task Templates (generated when this service is added to a work order)"
        items={s.taskTemplates}
        onChange={(v) => set("taskTemplates", v as TaskTemplate[])}
        empty={{ name: "", taskType: "", requiredRoleKey: "", photosRequired: false }}
        render={(item, update) => (
          <>
            <input className="input" placeholder="task name" value={item.name} onChange={(e) => update({ ...item, name: e.target.value })} />
            <input className="input" placeholder="type" value={item.taskType ?? ""} onChange={(e) => update({ ...item, taskType: e.target.value })} />
            <select className="input" value={item.requiredRoleKey ?? ""} onChange={(e) => update({ ...item, requiredRoleKey: e.target.value })}>
              <option value="">any role</option>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input type="checkbox" checked={!!item.photosRequired} onChange={(e) => update({ ...item, photosRequired: e.target.checked })} /> photos
            </label>
          </>
        )}
      />

      {/* Eligibility + checklist + payroll */}
      <section className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Eligibility, Checklist &amp; Payroll</h2>
        <div className="mb-4">
          <label className="label">Allowed roles (staff eligibility)</label>
          <div className="flex flex-wrap gap-3">
            {roles.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={s.allowedRoleKeys.includes(r.key)} onChange={() => toggleRole(r.key)} /> {r.name}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Default checklist</label>
            <select className="input" value={s.checklistTemplateId} onChange={(e) => set("checklistTemplateId", e.target.value)}>
              <option value="">—</option>
              {checklists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Pay type</label>
            <select className="input" value={String(s.payrollRuleConfig.payType ?? "")}
              onChange={(e) => setS((p) => ({ ...p, payrollRuleConfig: { ...p.payrollRuleConfig, payType: e.target.value } }))}>
              <option value="">use staff default</option>
              <option value="commission">commission</option>
              <option value="hourly">hourly</option>
              <option value="hybrid">hybrid</option>
              <option value="perServiceLine">per service line</option>
              <option value="perTask">per task</option>
            </select>
          </div>
          <div>
            <label className="label">Commission %</label>
            <input className="input" type="number" step="0.01" value={String(s.payrollRuleConfig.commissionPercent ?? "")}
              onChange={(e) => setS((p) => ({ ...p, payrollRuleConfig: { ...p.payrollRuleConfig, commissionPercent: parseFloat(e.target.value) || 0 } }))} />
          </div>
        </div>
      </section>

      {/* Automation rules */}
      <Repeater
        title="Automation Rules (IF event THEN action)"
        items={s.automationRules}
        onChange={(v) => set("automationRules", v as AutomationRule[])}
        empty={{ event: "service_line_added", action: "create_task", taskName: "" }}
        render={(item, update) => (
          <>
            <span className="text-xs text-gray-500">IF</span>
            <select className="input" value={item.event} onChange={(e) => update({ ...item, event: e.target.value })}>
              <option value="service_line_added">service line added</option>
              <option value="task_completed">task completed</option>
            </select>
            <span className="text-xs text-gray-500">THEN</span>
            <select className="input" value={item.action} onChange={(e) => update({ ...item, action: e.target.value })}>
              <option value="create_task">create task</option>
              <option value="create_followup">create follow-up</option>
              <option value="create_issue">create issue</option>
            </select>
            {(item.action === "create_task" || item.action === "create_followup") && (
              <input className="input" placeholder="task name" value={item.taskName ?? ""} onChange={(e) => update({ ...item, taskName: e.target.value })} />
            )}
            {item.action === "create_followup" && (
              <input className="input w-24" type="number" placeholder="days" value={item.followupDays ?? ""} onChange={(e) => update({ ...item, followupDays: parseInt(e.target.value, 10) || 0 })} />
            )}
            {item.action === "create_issue" && (
              <input className="input" placeholder="issue title" value={item.issueTitle ?? ""} onChange={(e) => update({ ...item, issueTitle: e.target.value })} />
            )}
          </>
        )}
      />

      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary">Save service</button>
      </div>
    </form>
  );
}

function numericize(cfg: Record<string, number | string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (k === "attributeKey" || k === "formula") out[k] = v;
    else out[k] = v === "" ? undefined : Number(v);
  }
  return out;
}

function Repeater<T>({
  title,
  items,
  onChange,
  empty,
  render,
}: {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  render: (item: T, update: (next: T) => void) => React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => onChange([...items, { ...empty }])}>
          + Add
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {render(item, (next) => onChange(items.map((it, j) => (j === i ? next : it))))}
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              remove
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">None yet.</p>}
      </div>
    </section>
  );
}
