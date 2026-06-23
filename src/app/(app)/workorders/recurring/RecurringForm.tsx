"use client";

import { useMemo, useState } from "react";

export default function RecurringForm({
  clients,
  properties,
  services,
  action,
}: {
  clients: { id: string; name: string }[];
  properties: { id: string; name: string; clientId: string }[];
  services: { id: string; name: string }[];
  action: (formData: FormData) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [freq, setFreq] = useState("weekly");
  const clientProps = useMemo(() => properties.filter((p) => p.clientId === clientId), [properties, clientId]);

  return (
    <form action={action} className="card space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Label *</label>
          <input name="label" placeholder="Weekly clean — Marina 1203" className="input" required />
        </div>
        <div>
          <label className="label">Client *</label>
          <select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className="input" required>
            <option value="">—</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Property *</label>
          <select name="propertyId" className="input" required disabled={!clientId}>
            <option value="">{clientId ? "—" : "select client first"}</option>
            {clientProps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">First run date *</label>
          <input name="nextRunAt" type="date" className="input" required />
        </div>
        <div>
          <label className="label">Frequency</label>
          <select name="frequency" value={freq} onChange={(e) => setFreq(e.target.value)} className="input">
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="biweekly">every 2 weeks</option>
            <option value="monthly">monthly</option>
            <option value="everyXDays">every X days</option>
          </select>
        </div>
        {freq === "everyXDays" && (
          <div>
            <label className="label">Interval (days)</label>
            <input name="intervalDays" type="number" min={1} className="input" />
          </div>
        )}
      </div>

      <div>
        <label className="label">Services (one work order will contain all selected)</label>
        <div className="flex flex-wrap gap-3">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="serviceIds" value={s.id} /> {s.name}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:w-1/2">
        <div>
          <label className="label">Default hours (optional)</label>
          <input name="hours" type="number" step="0.5" className="input" />
        </div>
        <div>
          <label className="label">Default manpower (optional)</label>
          <input name="manpower" type="number" className="input" />
        </div>
      </div>

      <button className="btn-primary" type="submit">Create schedule</button>
    </form>
  );
}
