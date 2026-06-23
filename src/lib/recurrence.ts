// Pure recurrence date math (Phase 4 part 2). No DB / server-only imports, so it can be
// used in both client (live preview) and server (generation) code. Unit-tested.

export function advanceDate(from: Date, frequency: string, intervalDays: number, daysOfWeek: number[] = []): Date {
  const d = new Date(from);
  switch (frequency) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "everyXDays": d.setDate(d.getDate() + Math.max(intervalDays, 1)); break;
    case "daysOfWeek": {
      if (daysOfWeek.length === 0) { d.setDate(d.getDate() + 7); break; }
      do { d.setDate(d.getDate() + 1); } while (!daysOfWeek.includes(d.getDay()));
      break;
    }
    default: d.setDate(d.getDate() + 7);
  }
  return d;
}

/** Next `count` occurrence dates from `start`, honouring an optional end date. */
export function previewOccurrences(
  start: Date,
  frequency: string,
  intervalDays: number,
  daysOfWeek: number[],
  count: number,
  endDate?: Date | null,
): Date[] {
  const out: Date[] = [];
  const cursor = new Date(start);
  if (frequency === "daysOfWeek" && daysOfWeek.length > 0 && !daysOfWeek.includes(cursor.getDay())) {
    do { cursor.setDate(cursor.getDate() + 1); } while (!daysOfWeek.includes(cursor.getDay()));
  }
  let c = cursor;
  while (out.length < count) {
    if (endDate && c > endDate) break;
    out.push(new Date(c));
    c = advanceDate(c, frequency, intervalDays, daysOfWeek);
  }
  return out;
}
