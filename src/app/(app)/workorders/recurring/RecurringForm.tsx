"use client";

import { useMemo, useState } from "react";
import { previewOccurrences } from "@/lib/recurrence";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [interval, setInterval] = useState(3);
  const [dows, setDows] = useState<number[]>([]);
  const clientProps = useMemo(() => properties.filter((p) => p.clientId === clientId), [properties, clientId]);

  const preview = useMemo(() => {
    if (!start) return [];
    return previewOccurrences(new Date(start), freq, interval, dows, 10, end ? new Date(end) : null);
  }, [start, freq, interval, dows, end]);

  const toggleDow = (n: number) => setDows((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

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
          <label className="label">Start date *</label>
          <input name="nextRunAt" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="label">End date (optional)</label>
          <input name="endDate" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Frequency</label>
          <select name="frequency" value={freq} onChange={(e) => setFreq(e.target.value)} className="input">
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="biweekly">every 2 weeks</option>
            <option value="monthly">monthly</option>
            <option value="everyXDays">every X days</option>
            <option value="daysOfWeek">specific days of week</option>
          </select>
        </div>
        {freq === "everyXDays" && (
          <div>
            <label className="label">Interval (days)</label>
            <input name="intervalDays" type="number" min={1} value={interval} onChange={(e) => setInterval(parseInt(e.target.value, 10) || 1)} className="input" />
          </div>
        )}
        {freq === "daysOfWeek" && (
          <div className="md:col-span-2">
            <label className="label">Days of week</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d, i) => (
                <label key={d} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm ${dows.includes(i) ? "border-brand bg-brand/10 text-brand-dark" : "border-gray-300 text-gray-600"}`}>
                  <input type="checkbox" name="daysOfWeek" value={i} checked={dows.includes(i)} onChange={() => toggleDow(i)} className="hidden" />
                  {d}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Preview — next {preview.length} work order(s)</p>
          <div className="flex flex-wrap gap-2 text-xs text-gray-700">
            {preview.map((d, i) => (
              <span key={i} className="rounded bg-white px-2 py-1 ring-1 ring-gray-200">
                {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
            ))}
          </div>
        </div>
      )}

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
