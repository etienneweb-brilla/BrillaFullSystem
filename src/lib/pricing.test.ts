import { describe, it, expect } from "vitest";
import {
  computeBasePrice,
  applyRules,
  resolvePrice,
  applyVat,
  evalFormula,
} from "./pricing";

describe("computeBasePrice", () => {
  it("fixed price", () => {
    expect(computeBasePrice("fixed", { rate: 100 }, {})).toBe(100);
  });
  it("hourly = hours * rate", () => {
    expect(computeBasePrice("hourly", { rate: 25 }, { hours: 3 })).toBe(75);
  });
  it("hourly x manpower = hours * rate * staff", () => {
    expect(computeBasePrice("hourlyManpower", { rate: 25, manpower: 2 }, { hours: 3, manpower: 2 })).toBe(150);
  });
  it("manpower falls back to config default", () => {
    expect(computeBasePrice("hourlyManpower", { rate: 10, manpower: 3 }, { hours: 2 })).toBe(60);
  });
  it("per item", () => {
    expect(computeBasePrice("perItem", { unitPrice: 5 }, { itemQuantity: 12 })).toBe(60);
  });
  it("per quantity", () => {
    expect(computeBasePrice("perQuantity", { unitPrice: 8 }, { quantity: 4 })).toBe(32);
  });
  it("per room", () => {
    expect(computeBasePrice("perRoom", { rate: 30 }, { rooms: 3 })).toBe(90);
  });
  it("per property attribute (e.g. sqm * rate)", () => {
    expect(computeBasePrice("perAttribute", { rate: 2, attributeKey: "sqm" }, { attributes: { sqm: 95 } })).toBe(190);
  });
  it("manualQuote yields 0 (admin enters manually)", () => {
    expect(computeBasePrice("manualQuote", {}, {})).toBe(0);
  });
});

describe("applyRules", () => {
  it("raises to minimum charge", () => {
    expect(applyRules(50, { minCharge: 80 }, {})).toBe(80);
  });
  it("adds weekend and urgent fees when flagged", () => {
    expect(applyRules(100, { weekendFee: 20, urgentFee: 30 }, { weekend: true, urgent: true })).toBe(150);
  });
});

describe("resolvePrice (priority: service default -> property -> client -> manual)", () => {
  it("uses computed when no overrides", () => {
    expect(resolvePrice(120, {})).toBe(120);
  });
  it("service default beats computed", () => {
    expect(resolvePrice(120, { serviceDefault: 100 })).toBe(100);
  });
  it("property beats service default", () => {
    expect(resolvePrice(120, { serviceDefault: 100, property: 90 })).toBe(90);
  });
  it("manual beats everything", () => {
    expect(resolvePrice(120, { serviceDefault: 100, property: 90, client: 80, manual: 70 })).toBe(70);
  });
});

describe("applyVat (global VAT)", () => {
  it("exclusive adds VAT on top", () => {
    expect(applyVat(100, { enabled: true, rate: 5, inclusive: false })).toEqual({ net: 100, vat: 5, gross: 105 });
  });
  it("inclusive splits out VAT", () => {
    const b = applyVat(105, { enabled: true, rate: 5, inclusive: true });
    expect(b.net).toBe(100);
    expect(b.vat).toBe(5);
    expect(b.gross).toBe(105);
  });
  it("disabled VAT passes through", () => {
    expect(applyVat(100, { enabled: false, rate: 5, inclusive: false })).toEqual({ net: 100, vat: 0, gross: 100 });
  });
});

describe("evalFormula", () => {
  it("evaluates allowed variables", () => {
    expect(evalFormula("rate * hours * manpower + 10", { rate: 25 }, { hours: 2, manpower: 2 })).toBe(110);
  });
  it("rejects unknown identifiers", () => {
    expect(evalFormula("process.exit(1)", {}, {})).toBe(0);
  });
});
