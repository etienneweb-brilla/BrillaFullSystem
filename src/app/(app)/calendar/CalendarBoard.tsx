"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { colorFor, type ColorMode, startOfDay, addDays, startOfWeek, sameDay, WEEKDAYS } from "@/lib/calendar";
import { money } from "@/lib/format";
import TaskDrawer from "./TaskDrawer";
import { rescheduleTask, assignTaskTo, bulkAssign, bulkReschedule, bulkStatus } from "./actions";

export interface CalItem {
  taskId: string;
  taskName: string;
  status: string;
  rawStatus: string;
  priority: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  dueAt: string | null;
  woId: string;
  woNumber: string;
  woStatus: string;
  clientName: string;
  propertyName: string;
  propertyId: string;
  serviceLineId: string | null;
  serviceId: string | null;
  serviceName: string;
  categoryName: string | null;
  categoryKey: string | null;
  staffId: string | null;
  staffName: string | null;
  price: number;
  commission: number;
  profit: number;
  notes: string | null;
  photoUrls: string[];
  checklistTemplateId: string | null;
  access: string | null;
  parking: string | null;
  alarm: string | null;
  serviceInstructions: Record<string, string>;
  requiredRoleKey: string | null;
}

export interface StaffOption {
  id: string;
  name: string;
  eligibleServiceIds: string[];
}

type View = "day" | "week" | "month" | "staff" | "service" | "unassigned";

interface Summary {
  tasksToday: number;
  completedToday: number;
  pendingToday: number;
  overdue: number;
  unassigned: number;
  staffWorking: number;
  revenueToday: number;
  revenueWeek: number;
  currency: string;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  normal: "bg-gray-300",
  low: "bg-gray-200",
};

export default function CalendarBoard({
  items,
  staff,
  services,
  categories,
  clients,
  properties,
  summary,
}: {
  items: CalItem[];
  staff: StaffOption[];
  services: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  properties: { id: string; name: string }[];
  summary: Summary;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(startOfDay(new Date()));
  const [colorMode, setColorMode] = useState<ColorMode>("category");
  const [drawer, setDrawer] = useState<CalItem | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [fStaff, setFStaff] = useState("");
  const [fService, setFService] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fClient, setFClient] = useState("");
  const [fProperty, setFProperty] = useState("");
  const [fAssigned, setFAssigned] = useState<"" | "assigned" | "unassigned" | "overdue">("");

  const cur = summary.currency;

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (fStaff && i.staffId !== fStaff) return false;
      if (fService && i.serviceId !== fService) return false;
      if (fCategory && i.categoryKey !== fCategory && i.categoryName !== categories.find((c) => c.id === fCategory)?.name) return false;
      if (fStatus && i.status !== fStatus) return false;
      if (fClient && !i.clientName) return false;
      if (fClient && i.clientName !== clients.find((c) => c.id === fClient)?.name) return false;
      if (fProperty && i.propertyId !== fProperty) return false;
      if (fAssigned === "assigned" && !i.staffId) return false;
      if (fAssigned === "unassigned" && i.staffId) return false;
      if (fAssigned === "overdue" && i.status !== "overdue") return false;
      return true;
    });
  }, [items, fStaff, fService, fCategory, fStatus, fClient, fProperty, fAssigned, categories, clients]);

  async function runAction(p: Promise<{ ok: boolean; errors: string[] }>) {
    const r = await p;
    if (r.ok) {
      setBanner({ ok: true, msg: "Saved." });
      router.refresh();
    } else {
      setBanner({ ok: false, msg: r.errors.join(" ") || "Could not save." });
    }
    setTimeout(() => setBanner(null), 4000);
  }

  // Drag and drop
  function onDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("text/task", taskId);
  }
  async function onDropDay(e: React.DragEvent, day: Date) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/task");
    if (!taskId) return;
    const existing = items.find((i) => i.taskId === taskId);
    const base = existing?.scheduledStart ? new Date(existing.scheduledStart) : new Date();
    const start = new Date(day);
    start.setHours(base.getHours() || 9, base.getMinutes() || 0, 0, 0);
    await runAction(rescheduleTask(taskId, start.toISOString()));
  }
  async function onDropStaff(e: React.DragEvent, staffId: string | null) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/task");
    if (!taskId) return;
    await runAction(assignTaskTo(taskId, staffId));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Calendar / Dispatch</h1>
        <div className="text-sm text-gray-500">{filtered.length} task(s)</div>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <SummaryCard label="Today" value={summary.tasksToday} />
        <SummaryCard label="Completed" value={summary.completedToday} />
        <SummaryCard label="Pending" value={summary.pendingToday} />
        <SummaryCard label="Overdue" value={summary.overdue} tone={summary.overdue ? "red" : undefined} />
        <SummaryCard label="Unassigned" value={summary.unassigned} tone={summary.unassigned ? "amber" : undefined} />
        <SummaryCard label="Working now" value={summary.staffWorking} />
        <SummaryCard label="Rev. today" value={money(summary.revenueToday, cur)} small />
        <SummaryCard label="Rev. week" value={money(summary.revenueWeek, cur)} small />
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-gray-300 bg-white p-0.5 text-sm">
          {(["day", "week", "month", "staff", "service", "unassigned"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded px-3 py-1 capitalize ${view === v ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              {v}
            </button>
          ))}
        </div>
        {(view === "day" || view === "week" || view === "month" || view === "staff" || view === "service") && (
          <div className="flex items-center gap-1">
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setAnchor(addDays(anchor, view === "month" ? -30 : view === "week" ? -7 : -1))}>←</button>
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setAnchor(startOfDay(new Date()))}>Today</button>
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setAnchor(addDays(anchor, view === "month" ? 30 : view === "week" ? 7 : 1))}>→</button>
            <span className="ml-1 text-sm font-medium text-gray-700">{anchor.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-gray-500">Colour</label>
          <select value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)} className="input w-32 py-1 text-sm">
            <option value="category">by category</option>
            <option value="status">by status</option>
            <option value="staff">by staff</option>
          </select>
          <button className={`btn-secondary py-1 text-xs ${selectMode ? "ring-2 ring-brand" : ""}`} onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}>
            {selectMode ? "Selecting…" : "Multi-select"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        <FilterSelect value={fStaff} onChange={setFStaff} label="All staff" options={staff.map((s) => ({ v: s.id, l: s.name }))} />
        <FilterSelect value={fService} onChange={setFService} label="All services" options={services.map((s) => ({ v: s.id, l: s.name }))} />
        <FilterSelect value={fCategory} onChange={setFCategory} label="All categories" options={categories.map((c) => ({ v: c.id, l: c.name }))} />
        <FilterSelect value={fStatus} onChange={setFStatus} label="All statuses" options={["pending", "assigned", "in_progress", "completed", "overdue"].map((s) => ({ v: s, l: s }))} />
        <FilterSelect value={fClient} onChange={setFClient} label="All clients" options={clients.map((c) => ({ v: c.id, l: c.name }))} />
        <FilterSelect value={fProperty} onChange={setFProperty} label="All properties" options={properties.map((p) => ({ v: p.id, l: p.name }))} />
        <FilterSelect value={fAssigned} onChange={(v) => setFAssigned(v as "")} label="Any assignment" options={[{ v: "assigned", l: "assigned" }, { v: "unassigned", l: "unassigned" }, { v: "overdue", l: "overdue" }]} />
      </div>

      {banner && (
        <div className={`mb-3 rounded-md px-4 py-2 text-sm ${banner.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{banner.msg}</div>
      )}

      {selectMode && selected.size > 0 && (
        <BulkBar
          count={selected.size}
          staff={staff}
          onAssign={(sid) => runAction(bulkAssign([...selected], sid))}
          onReschedule={(iso) => runAction(bulkReschedule([...selected], iso))}
          onStatus={(st) => runAction(bulkStatus([...selected], st))}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Views */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        {view === "day" && <DayOrListView days={[anchor]} items={filtered} {...{ colorMode, selectMode, selected, toggleSelect, onDragStart, onDropDay, setDrawer }} />}
        {view === "week" && <WeekView anchor={anchor} items={filtered} {...{ colorMode, selectMode, selected, toggleSelect, onDragStart, onDropDay, setDrawer }} />}
        {view === "month" && <MonthView anchor={anchor} items={filtered} {...{ colorMode, selectMode, selected, toggleSelect, onDragStart, onDropDay, setDrawer }} />}
        {view === "staff" && <LaneView lanes={[{ id: null, name: "Unassigned" }, ...staff.map((s) => ({ id: s.id as string | null, name: s.name }))]} laneOf={(i) => i.staffId} items={filtered} droppable onDropLane={onDropStaff} {...{ colorMode, selectMode, selected, toggleSelect, onDragStart, setDrawer }} />}
        {view === "service" && <LaneView lanes={services.map((s) => ({ id: s.id as string | null, name: s.name }))} laneOf={(i) => i.serviceId} items={filtered} {...{ colorMode, selectMode, selected, toggleSelect, onDragStart, setDrawer }} />}
        {view === "unassigned" && <DayOrListView days={null} items={filtered.filter((i) => !i.staffId)} {...{ colorMode, selectMode, selected, toggleSelect, onDragStart, onDropDay, setDrawer }} />}
      </div>

      {drawer && (
        <TaskDrawer
          item={drawer}
          staff={staff}
          currency={cur}
          onClose={() => setDrawer(null)}
          onChanged={() => { setDrawer(null); router.refresh(); }}
          onResult={(r) => { setBanner(r.ok ? { ok: true, msg: "Saved." } : { ok: false, msg: r.errors.join(" ") }); setTimeout(() => setBanner(null), 4000); }}
        />
      )}
    </div>
  );
}

// ---------- Sub-views ----------

interface ChipProps {
  colorMode: ColorMode;
  selectMode: boolean;
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  setDrawer: (i: CalItem) => void;
}

function Chip({ item, p }: { item: CalItem; p: ChipProps }) {
  const cls = colorFor(p.colorMode, item);
  const time = item.scheduledStart ? new Date(item.scheduledStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <div
      draggable={!p.selectMode}
      onDragStart={(e) => p.onDragStart(e, item.taskId)}
      onClick={() => (p.selectMode ? p.toggleSelect(item.taskId) : p.setDrawer(item))}
      className={`cursor-pointer rounded border px-2 py-1 text-xs ${cls} ${p.selected.has(item.taskId) ? "ring-2 ring-brand" : ""}`}
      title={`${item.woNumber} · ${item.serviceName}`}
    >
      <div className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[item.priority] ?? "bg-gray-300"}`} />
        <span className="font-medium">{time}</span>
        <span className="truncate">{item.taskName}</span>
      </div>
      <div className="truncate opacity-80">{item.propertyName}{item.staffName ? ` · ${item.staffName}` : " · unassigned"}</div>
    </div>
  );
}

function DayOrListView({ days, items, ...p }: { days: Date[] | null; items: CalItem[] } & ChipProps & { onDropDay: (e: React.DragEvent, d: Date) => void }) {
  if (days) {
    const day = days[0];
    const dayItems = items.filter((i) => i.scheduledStart && sameDay(new Date(i.scheduledStart), day));
    return (
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => p.onDropDay(e, day)} className="min-h-[300px] space-y-2">
        {dayItems.length === 0 ? <p className="p-6 text-center text-sm text-gray-400">No tasks scheduled. Drag a task here.</p> : dayItems.map((i) => <Chip key={i.taskId} item={i} p={p} />)}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Nothing here.</p> : items.map((i) => <Chip key={i.taskId} item={i} p={p} />)}
    </div>
  );
}

function WeekView({ anchor, items, ...p }: { anchor: Date; items: CalItem[] } & ChipProps & { onDropDay: (e: React.DragEvent, d: Date) => void }) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const dayItems = items.filter((i) => i.scheduledStart && sameDay(new Date(i.scheduledStart), day));
        return (
          <div key={day.toISOString()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => p.onDropDay(e, day)} className="min-h-[140px] rounded border border-gray-100 bg-gray-50 p-1">
            <div className="mb-1 text-xs font-semibold text-gray-500">{WEEKDAYS[day.getDay()]} {day.getDate()}</div>
            <div className="space-y-1">{dayItems.map((i) => <Chip key={i.taskId} item={i} p={p} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ anchor, items, ...p }: { anchor: Date; items: CalItem[] } & ChipProps & { onDropDay: (e: React.DragEvent, d: Date) => void }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((d) => <div key={d} className="text-center text-xs font-semibold text-gray-400">{d}</div>)}
      {days.map((day) => {
        const dayItems = items.filter((i) => i.scheduledStart && sameDay(new Date(i.scheduledStart), day));
        const dim = day.getMonth() !== anchor.getMonth();
        return (
          <div key={day.toISOString()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => p.onDropDay(e, day)} className={`min-h-[80px] rounded border border-gray-100 p-1 ${dim ? "bg-gray-50 opacity-60" : "bg-white"}`}>
            <div className="text-[10px] text-gray-400">{day.getDate()}</div>
            <div className="space-y-0.5">{dayItems.slice(0, 4).map((i) => <Chip key={i.taskId} item={i} p={p} />)}</div>
            {dayItems.length > 4 && <div className="text-[10px] text-gray-400">+{dayItems.length - 4} more</div>}
          </div>
        );
      })}
    </div>
  );
}

function LaneView({ lanes, laneOf, items, droppable, onDropLane, ...p }: {
  lanes: { id: string | null; name: string }[];
  laneOf: (i: CalItem) => string | null;
  items: CalItem[];
  droppable?: boolean;
  onDropLane?: (e: React.DragEvent, laneId: string | null) => void;
} & ChipProps) {
  return (
    <div className="space-y-2">
      {lanes.map((lane) => {
        const laneItems = items.filter((i) => laneOf(i) === lane.id);
        return (
          <div key={lane.id ?? "none"} onDragOver={droppable ? (e) => e.preventDefault() : undefined} onDrop={droppable && onDropLane ? (e) => onDropLane(e, lane.id) : undefined} className="rounded border border-gray-100 bg-gray-50 p-2">
            <div className="mb-1 text-sm font-semibold text-gray-600">{lane.name} <span className="text-xs font-normal text-gray-400">({laneItems.length})</span></div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">{laneItems.map((i) => <Chip key={i.taskId} item={i} p={p} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Small UI ----------

function SummaryCard({ label, value, tone, small }: { label: string; value: string | number; tone?: "red" | "amber"; small?: boolean }) {
  const toneCls = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`font-bold ${small ? "text-sm" : "text-lg"} ${toneCls}`}>{value}</p>
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input w-auto py-1 text-sm">
      <option value="">{label}</option>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function BulkBar({ count, staff, onAssign, onReschedule, onStatus, onClear }: {
  count: number;
  staff: StaffOption[];
  onAssign: (staffId: string | null) => void;
  onReschedule: (iso: string) => void;
  onStatus: (status: string) => void;
  onClear: () => void;
}) {
  const [date, setDate] = useState("");
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-brand/10 px-3 py-2 text-sm">
      <span className="font-medium text-brand-dark">{count} selected</span>
      <select onChange={(e) => e.target.value && onAssign(e.target.value)} className="input w-40 py-1 text-sm" defaultValue="">
        <option value="" disabled>Assign to…</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="input w-48 py-1 text-sm" />
      <button className="btn-secondary py-1 text-xs" disabled={!date} onClick={() => onReschedule(new Date(date).toISOString())}>Reschedule</button>
      <select onChange={(e) => e.target.value && onStatus(e.target.value)} className="input w-36 py-1 text-sm" defaultValue="">
        <option value="" disabled>Set status…</option>
        {["assigned", "in_progress", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button className="ml-auto text-xs text-gray-500 hover:underline" onClick={onClear}>clear</button>
    </div>
  );
}
