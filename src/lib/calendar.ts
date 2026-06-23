// Calendar colour palette + small date helpers (Phase 4 part 1).

export type ColorMode = "category" | "status" | "staff";

// A stable, readable palette. We hash a key into one of these classes so colours are
// consistent across renders without storing a colour per entity.
const PALETTE = [
  "bg-teal-100 text-teal-800 border-teal-300",
  "bg-blue-100 text-blue-800 border-blue-300",
  "bg-amber-100 text-amber-800 border-amber-300",
  "bg-purple-100 text-purple-800 border-purple-300",
  "bg-rose-100 text-rose-800 border-rose-300",
  "bg-emerald-100 text-emerald-800 border-emerald-300",
  "bg-indigo-100 text-indigo-800 border-indigo-300",
  "bg-orange-100 text-orange-800 border-orange-300",
  "bg-cyan-100 text-cyan-800 border-cyan-300",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-300",
  assigned: "bg-blue-100 text-blue-800 border-blue-300",
  in_progress: "bg-amber-100 text-amber-800 border-amber-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  overdue: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-gray-100 text-gray-500 border-gray-300",
};

export function hashColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function colorFor(mode: ColorMode, item: { categoryKey?: string | null; status: string; staffKey?: string | null }): string {
  if (mode === "status") return STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700 border-gray-300";
  if (mode === "staff") return item.staffKey ? hashColor(item.staffKey) : "bg-gray-100 text-gray-500 border-gray-300";
  return item.categoryKey ? hashColor(item.categoryKey) : "bg-gray-100 text-gray-500 border-gray-300";
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Sunday-based start of the week containing d. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
