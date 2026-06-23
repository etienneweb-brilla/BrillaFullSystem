"use client";

import { useState } from "react";
import Link from "next/link";
import { money } from "@/lib/format";
import type { CalItem, StaffOption } from "./CalendarBoard";
import { assignTaskTo, rescheduleTask, setTaskStatus, type ActionResult } from "./actions";

export default function TaskDrawer({
  item,
  staff,
  currency,
  onClose,
  onChanged,
  onResult,
}: {
  item: CalItem;
  staff: StaffOption[];
  currency: string;
  onClose: () => void;
  onChanged: () => void;
  onResult: (r: ActionResult) => void;
}) {
  const [staffId, setStaffId] = useState(item.staffId ?? "");
  const [when, setWhen] = useState(item.scheduledStart ? item.scheduledStart.slice(0, 16) : "");
  const [busy, setBusy] = useState(false);

  async function run(p: Promise<ActionResult>) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    onResult(r);
    if (r.ok) onChanged();
  }

  const eligibleNote = (s: StaffOption) =>
    item.serviceId && !s.eligibleServiceIds.includes(item.serviceId) ? " (not eligible)" : "";

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">{item.taskName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-5 p-4 text-sm">
          {/* Work order */}
          <Section title="Work Order">
            <Row label="Number" value={item.woNumber} />
            <Row label="Client" value={item.clientName} />
            <Row label="Property" value={item.propertyName} />
            <Row label="Status" value={item.woStatus} />
          </Section>

          {/* Service line */}
          <Section title="Service Line">
            <Row label="Service" value={item.serviceName} />
            <Row label="Price" value={money(item.price, currency)} />
            <Row label="Commission" value={money(item.commission, currency)} />
            <Row label="Profit" value={money(item.profit, currency)} />
            <Row label="Assigned" value={item.staffName ?? "unassigned"} />
          </Section>

          {/* Task */}
          <Section title="Task">
            <Row label="Status" value={item.status} />
            <Row label="Priority" value={item.priority} />
            <Row label="Due" value={item.dueAt ? new Date(item.dueAt).toLocaleString() : "—"} />
            {item.notes && <Row label="Notes" value={item.notes} />}
            {item.photoUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item.photoUrls.map((u) => <img key={u} src={u} alt="" className="h-16 w-16 rounded object-cover" />)}
              </div>
            )}
          </Section>

          {/* Property info */}
          <Section title="Property Information">
            <Row label="Access" value={item.access ?? "—"} />
            <Row label="Parking" value={item.parking ?? "—"} />
            <Row label="Alarm" value={item.alarm ?? "—"} />
            {Object.entries(item.serviceInstructions).map(([k, v]) => v ? <Row key={k} label={k} value={v} /> : null)}
          </Section>

          {/* Actions */}
          <Section title="Actions">
            <div className="space-y-3">
              <div>
                <label className="label">Assign / reassign</label>
                <div className="flex gap-2">
                  <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="input">
                    <option value="">unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{eligibleNote(s)}</option>)}
                  </select>
                  <button className="btn-secondary" disabled={busy} onClick={() => run(assignTaskTo(item.taskId, staffId || null))}>Save</button>
                </div>
              </div>
              <div>
                <label className="label">Reschedule</label>
                <div className="flex gap-2">
                  <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="input" />
                  <button className="btn-secondary" disabled={busy || !when} onClick={() => run(rescheduleTask(item.taskId, new Date(when).toISOString()))}>Save</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn-primary py-1.5 text-xs" disabled={busy} onClick={() => run(setTaskStatus(item.taskId, "completed"))}>Complete</button>
                <button className="btn-secondary py-1.5 text-xs" disabled={busy} onClick={() => run(setTaskStatus(item.taskId, "in_progress"))}>Start</button>
                <button className="btn-danger py-1.5 text-xs" disabled={busy} onClick={() => run(setTaskStatus(item.taskId, "cancelled"))}>Cancel</button>
                <Link href={`/workorders/${item.woId}`} className="btn-secondary py-1.5 text-xs">Open work order</Link>
              </div>
            </div>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 capitalize text-gray-400">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
