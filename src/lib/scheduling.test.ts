import { describe, it, expect } from "vitest";
import { availabilityIssues, hasOverlap } from "./scheduling";

describe("availabilityIssues", () => {
  const wed = new Date("2026-06-24T10:00:00"); // Wednesday
  const wedEnd = new Date("2026-06-24T12:00:00");

  it("flags a day the staff member does not work", () => {
    const issues = availabilityIssues({ days: [1, 2] /* Mon, Tue */ }, wed, wedEnd);
    expect(issues.some((i) => i.code === "availability")).toBe(true);
  });
  it("passes when the day is allowed", () => {
    const issues = availabilityIssues({ days: [3] /* Wed */, startHour: 8, endHour: 18 }, wed, wedEnd);
    expect(issues).toHaveLength(0);
  });
  it("flags starting before the start hour", () => {
    const issues = availabilityIssues({ startHour: 11 }, wed, wedEnd);
    expect(issues.some((i) => i.message.includes("start hour"))).toBe(true);
  });
  it("flags an explicitly unavailable date", () => {
    const issues = availabilityIssues({ unavailableDates: ["2026-06-24"] }, wed, wedEnd);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("hasOverlap", () => {
  const a = new Date("2026-06-24T10:00:00");
  const b = new Date("2026-06-24T12:00:00");
  it("detects an overlapping window", () => {
    expect(hasOverlap(a, b, [{ start: new Date("2026-06-24T11:00:00"), end: new Date("2026-06-24T13:00:00") }])).toBe(true);
  });
  it("allows back-to-back windows", () => {
    expect(hasOverlap(a, b, [{ start: new Date("2026-06-24T12:00:00"), end: new Date("2026-06-24T13:00:00") }])).toBe(false);
  });
});
