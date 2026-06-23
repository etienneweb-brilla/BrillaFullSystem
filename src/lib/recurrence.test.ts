import { describe, it, expect } from "vitest";
import { advanceDate, previewOccurrences } from "./recurrence";

describe("advanceDate", () => {
  const d = new Date("2026-06-01T09:00:00"); // Monday
  it("weekly adds 7 days", () => {
    expect(advanceDate(d, "weekly", 0).getDate()).toBe(8);
  });
  it("biweekly adds 14 days", () => {
    expect(advanceDate(d, "biweekly", 0).getDate()).toBe(15);
  });
  it("everyXDays uses the interval", () => {
    expect(advanceDate(d, "everyXDays", 3).getDate()).toBe(4);
  });
  it("daysOfWeek jumps to the next selected weekday", () => {
    // From Monday(1), next selected among [Wed=3, Fri=5] is Wednesday (3rd).
    expect(advanceDate(d, "daysOfWeek", 0, [3, 5]).getDay()).toBe(3);
  });
});

describe("previewOccurrences", () => {
  it("returns the requested count for weekly", () => {
    const out = previewOccurrences(new Date("2026-06-01"), "weekly", 0, [], 10);
    expect(out).toHaveLength(10);
    expect(out[1].getDate()).toBe(8);
  });
  it("stops at the end date", () => {
    const out = previewOccurrences(new Date("2026-06-01"), "weekly", 0, [], 10, new Date("2026-06-20"));
    expect(out.length).toBe(3); // Jun 1, 8, 15 (22 is past end)
  });
  it("daysOfWeek only yields selected weekdays", () => {
    const out = previewOccurrences(new Date("2026-06-01"), "daysOfWeek", 0, [1, 4] /* Mon, Thu */, 4);
    expect(out.every((d) => [1, 4].includes(d.getDay()))).toBe(true);
  });
});
