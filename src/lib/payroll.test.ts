import { describe, it, expect } from "vitest";
import { computeServiceLinePay, sumPay } from "./payroll";

describe("computeServiceLinePay (commission reads the SERVICE LINE, not the work order)", () => {
  it("commission = percent of the service line price", () => {
    const r = computeServiceLinePay({ payType: "commission", commissionPercent: 10 }, { serviceLinePrice: 200 });
    expect(r.commission).toBe(20);
    expect(r.total).toBe(20);
  });

  it("a different service line price yields a different commission — never the WO total", () => {
    // Two lines in one work order: cleaning 200, pest 500. The cleaner earns only on cleaning.
    const cleaner = computeServiceLinePay({ payType: "commission", commissionPercent: 10 }, { serviceLinePrice: 200 });
    expect(cleaner.commission).toBe(20); // 10% of 200, NOT 10% of 700
  });

  it("hourly pay uses hours and rate", () => {
    const r = computeServiceLinePay({ payType: "hourly", baseHourlyRate: 20 }, { serviceLinePrice: 999, hoursWorked: 3 });
    expect(r.base).toBe(60);
    expect(r.commission).toBe(0);
  });

  it("hybrid pays hourly base plus line commission", () => {
    const r = computeServiceLinePay(
      { payType: "hybrid", baseHourlyRate: 20, commissionPercent: 10 },
      { serviceLinePrice: 200, hoursWorked: 2 },
    );
    expect(r.base).toBe(40);
    expect(r.commission).toBe(20);
    expect(r.total).toBe(60);
  });

  it("raises to minimum per job", () => {
    const r = computeServiceLinePay({ payType: "commission", commissionPercent: 5, minPerJob: 30 }, { serviceLinePrice: 100 });
    expect(r.total).toBe(30); // 5% of 100 = 5, raised to 30
  });

  it("per service line flat amount", () => {
    const r = computeServiceLinePay({ payType: "perServiceLine", perServiceLineAmount: 45 }, { serviceLinePrice: 999 });
    expect(r.base).toBe(45);
  });
});

describe("sumPay", () => {
  it("sums components across lines", () => {
    const total = sumPay([
      { base: 40, commission: 20, total: 60, basis: "" },
      { base: 0, commission: 50, total: 50, basis: "" },
    ]);
    expect(total.total).toBe(110);
    expect(total.commission).toBe(70);
  });
});
