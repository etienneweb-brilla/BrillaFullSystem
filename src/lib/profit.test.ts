import { describe, it, expect } from "vitest";
import { summarize, groupSummary, monthKey } from "./profit";

const line = (price: number, supplier = 0, material = 0, driver = 0, labour = 0) => ({
  price,
  supplierCost: supplier,
  materialCost: material,
  driverCost: driver,
  labourCost: labour,
});

describe("summarize", () => {
  it("computes revenue, cost, profit and margin", () => {
    const s = summarize([line(200, 50, 10, 0, 20), line(100, 0, 0, 0, 10)]);
    expect(s.revenue).toBe(300);
    expect(s.cost).toBe(90); // 50+10+20 + 10
    expect(s.profit).toBe(210);
    expect(s.margin).toBe(70); // 210/300
  });
  it("margin is 0 when no revenue", () => {
    expect(summarize([]).margin).toBe(0);
  });
});

describe("groupSummary", () => {
  it("groups by key and sorts by revenue desc", () => {
    const rows = [
      { ...line(100), svc: "a", name: "Cleaning" },
      { ...line(400), svc: "b", name: "Pest" },
      { ...line(50), svc: "a", name: "Cleaning" },
    ];
    const g = groupSummary(rows, (r) => r.svc, (r) => r.name);
    expect(g[0].label).toBe("Pest");
    expect(g[0].summary.revenue).toBe(400);
    expect(g[1].summary.revenue).toBe(150);
  });
});

describe("monthKey", () => {
  it("formats YYYY-MM", () => {
    expect(monthKey(new Date("2026-06-23"))).toBe("2026-06");
  });
});
