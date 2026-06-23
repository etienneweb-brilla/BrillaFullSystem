"use client";

import { useMemo, useState } from "react";

export default function NewWorkOrderForm({
  clients,
  properties,
  action,
}: {
  clients: { id: string; name: string }[];
  properties: { id: string; name: string; clientId: string }[];
  action: (formData: FormData) => void;
}) {
  const [clientId, setClientId] = useState("");
  const clientProps = useMemo(() => properties.filter((p) => p.clientId === clientId), [properties, clientId]);

  return (
    <form action={action} className="card space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Client *</label>
          <select name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
            <option value="">—</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Property *</label>
          <select name="propertyId" required className="input" disabled={!clientId}>
            <option value="">{clientId ? "—" : "select a client first"}</option>
            {clientProps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Scheduled date/time</label>
          <input name="scheduledAt" type="datetime-local" className="input" />
        </div>
      </div>
      <div>
        <label className="label">Internal notes</label>
        <textarea name="internalNotes" rows={2} className="input" />
      </div>
      <div>
        <label className="label">Client notes</label>
        <textarea name="clientNotes" rows={2} className="input" />
      </div>
      <button className="btn-primary" type="submit">Create work order</button>
      <p className="text-sm text-gray-500">You&apos;ll add service lines on the next screen.</p>
    </form>
  );
}
