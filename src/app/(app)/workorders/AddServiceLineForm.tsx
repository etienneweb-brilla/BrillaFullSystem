"use client";

import { useState } from "react";

export interface PricingVarOption {
  key: string;
  label: string;
  default?: number;
  min?: number;
  max?: number;
  required?: boolean;
}

export interface ServiceOption {
  id: string;
  name: string;
  pricingType: string;
  pricingVariables?: PricingVarOption[];
}

export default function AddServiceLineForm({
  services,
  action,
}: {
  services: ServiceOption[];
  action: (formData: FormData) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const selected = services.find((s) => s.id === serviceId);
  const pt = selected?.pricingType;
  const configuredVars = selected?.pricingVariables ?? [];
  const hasConfigured = configuredVars.length > 0;

  const showHours = pt === "hourly" || pt === "hourlyManpower" || pt === "formula";
  const showManpower = pt === "hourlyManpower" || pt === "formula";
  const showQuantity = pt === "perQuantity" || pt === "formula";
  const showItemQty = pt === "perItem" || pt === "formula";
  const showRooms = pt === "perRoom" || pt === "formula";
  const showManual = pt === "manualQuote";

  if (services.length === 0) {
    return <p className="text-sm text-gray-500">No active services. Create one in the Service Builder first.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="label">Service</label>
          <select name="serviceId" required value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input">
            <option value="">— select a service —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.pricingType})</option>)}
          </select>
        </div>
        {/* Configured pricing inputs take precedence (Part 5): default/min/max enforced. */}
        {hasConfigured
          ? configuredVars.map((v) => (
              <div key={v.key}>
                <label className="label">
                  {v.label}
                  {v.required && <span className="text-red-500"> *</span>}
                  {(v.min != null || v.max != null) && (
                    <span className="ml-1 text-xs text-gray-400">
                      ({v.min != null ? `min ${v.min}` : ""}{v.min != null && v.max != null ? ", " : ""}{v.max != null ? `max ${v.max}` : ""})
                    </span>
                  )}
                </label>
                <input
                  name={v.key}
                  type="number"
                  step="any"
                  min={v.min}
                  max={v.max}
                  defaultValue={v.default ?? ""}
                  required={v.required}
                  className="input"
                />
              </div>
            ))
          : (
            <>
              {showHours && <NumberField name="hours" label="Hours" />}
              {showManpower && <NumberField name="manpower" label="Manpower (staff)" />}
              {showQuantity && <NumberField name="quantity" label="Quantity" />}
              {showItemQty && <NumberField name="itemQuantity" label="Item quantity" />}
              {showRooms && <NumberField name="rooms" label="Rooms / areas" />}
              {showManual && <NumberField name="manualPrice" label="Manual price" step="0.01" />}
            </>
          )}
        <div>
          <label className="label">Fulfilment</label>
          <select name="fulfilmentMode" className="input">
            <option value="internal">internal</option>
            <option value="outsourced">outsourced</option>
            <option value="mixed">mixed</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="weekend" /> weekend fee
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="urgent" /> urgent fee
        </label>
        {!showManual && (
          <div className="flex items-end gap-2">
            <div>
              <label className="label">Manual price override (optional)</label>
              <input name="manualPrice" type="number" step="0.01" className="input w-40" />
            </div>
          </div>
        )}
        <button type="submit" className="btn-primary ml-auto">Add service line</button>
      </div>
    </form>
  );
}

function NumberField({ name, label, step }: { name: string; label: string; step?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type="number" step={step ?? "1"} className="input" />
    </div>
  );
}
