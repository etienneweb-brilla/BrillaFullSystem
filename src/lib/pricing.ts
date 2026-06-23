// Pricing engine — supports every approved pricing type (spec 5.4) and the
// price-priority resolution (spec 5.5). Pure functions, unit-tested.

export const PRICING_TYPES = [
  "fixed", // one price for the line
  "hourly", // hours * rate
  "hourlyManpower", // hours * rate * manpower
  "perItem", // itemQty * itemPrice
  "perQuantity", // quantity * unitPrice
  "perRoom", // rooms/areas * rate
  "perAttribute", // property attribute value * rate (e.g. sqm * rate)
  "formula", // admin formula using allowed variables
  "manualQuote", // no auto price; admin enters manually
] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

export interface PricingConfig {
  rate?: number; // hourly rate / per-room rate / per-attribute rate
  unitPrice?: number; // per item / per quantity unit price
  manpower?: number; // default manpower
  attributeKey?: string; // which property field to read for perAttribute
  formula?: string; // e.g. "rate * hours + 10"
}

export interface PricingRules {
  minCharge?: number;
  minHours?: number;
  deposit?: number;
  urgentFee?: number;
  weekendFee?: number;
  travelFee?: number;
  cancellationFee?: number;
  discountAllowed?: boolean;
}

export interface PricingInputs {
  hours?: number;
  manpower?: number;
  quantity?: number;
  itemQuantity?: number;
  rooms?: number;
  // property attribute values, keyed by FieldDefinition.key
  attributes?: Record<string, number>;
  // flags that trigger rule-based fees
  urgent?: boolean;
  weekend?: boolean;
  travel?: boolean;
}

// Price-priority sources (spec 5.5): service default -> property -> client -> manual.
export interface PriceOverrides {
  serviceDefault?: number | null;
  property?: number | null;
  client?: number | null;
  manual?: number | null;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : fallback;
};

/**
 * Compute the base price for a service line from its pricing type/config/inputs.
 * Returns the computed amount BEFORE pricing rules and BEFORE override priority.
 */
export function computeBasePrice(
  type: PricingType,
  config: PricingConfig,
  inputs: PricingInputs,
): number {
  switch (type) {
    case "fixed":
      return num(config.rate ?? config.unitPrice);
    case "hourly": {
      const hours = Math.max(num(inputs.hours), 0);
      return hours * num(config.rate);
    }
    case "hourlyManpower": {
      const hours = Math.max(num(inputs.hours), 0);
      const manpower = Math.max(num(inputs.manpower ?? config.manpower, 1), 1);
      return hours * num(config.rate) * manpower;
    }
    case "perItem":
      return Math.max(num(inputs.itemQuantity), 0) * num(config.unitPrice);
    case "perQuantity":
      return Math.max(num(inputs.quantity), 0) * num(config.unitPrice);
    case "perRoom":
      return Math.max(num(inputs.rooms), 0) * num(config.rate);
    case "perAttribute": {
      const key = config.attributeKey ?? "";
      const value = num(inputs.attributes?.[key]);
      return value * num(config.rate);
    }
    case "formula":
      return evalFormula(config.formula ?? "0", config, inputs);
    case "manualQuote":
      return 0; // admin enters manually
    default:
      return 0;
  }
}

/** Apply pricing rules (minimums + fees) to a base price. */
export function applyRules(base: number, rules: PricingRules, inputs: PricingInputs): number {
  let price = base;
  if (rules.minCharge && price < rules.minCharge) price = rules.minCharge;
  if (inputs.urgent && rules.urgentFee) price += rules.urgentFee;
  if (inputs.weekend && rules.weekendFee) price += rules.weekendFee;
  if (inputs.travel && rules.travelFee) price += rules.travelFee;
  return round2(price);
}

/**
 * Resolve the final price using the override priority (spec 5.5):
 *   1. service default  2. property override  3. client override  4. manual override
 * Later (higher-priority) non-null values win. `computed` is used when no override applies
 * (e.g. for hourly/per-quantity services whose price comes from inputs, not a fixed default).
 */
export function resolvePrice(computed: number, overrides: PriceOverrides): number {
  let price = computed;
  if (overrides.serviceDefault != null) price = overrides.serviceDefault;
  if (overrides.property != null) price = overrides.property;
  if (overrides.client != null) price = overrides.client;
  if (overrides.manual != null) price = overrides.manual;
  return round2(price);
}

export interface VatSettings {
  enabled: boolean;
  rate: number; // e.g. 5 for 5%
  inclusive: boolean; // true = prices already include VAT
}

export interface VatBreakdown {
  net: number; // amount excluding VAT
  vat: number; // VAT amount
  gross: number; // amount including VAT
}

/** Split a price into net/vat/gross using GLOBAL VAT settings (spec rule #5). */
export function applyVat(amount: number, vat: VatSettings): VatBreakdown {
  if (!vat.enabled || !vat.rate) {
    return { net: round2(amount), vat: 0, gross: round2(amount) };
  }
  const r = vat.rate / 100;
  if (vat.inclusive) {
    const net = amount / (1 + r);
    return { net: round2(net), vat: round2(amount - net), gross: round2(amount) };
  }
  const v = amount * r;
  return { net: round2(amount), vat: round2(v), gross: round2(amount + v) };
}

// Very small, safe arithmetic formula evaluator. Supports + - * / ( ) and the
// variables: rate, unitPrice, manpower, hours, quantity, itemQuantity, rooms.
// No access to JS globals — only the whitelisted variable names and numbers.
export function evalFormula(
  formula: string,
  config: PricingConfig,
  inputs: PricingInputs,
  // Admin-defined reusable variables (Phase 4 part 6) — e.g. bedrooms, poolSize.
  extraVars?: Record<string, number>,
): number {
  const vars: Record<string, number> = {
    rate: num(config.rate),
    unitPrice: num(config.unitPrice),
    manpower: num(inputs.manpower ?? config.manpower, 1),
    hours: num(inputs.hours),
    quantity: num(inputs.quantity),
    itemQuantity: num(inputs.itemQuantity),
    rooms: num(inputs.rooms),
    // property attributes are available by their key as well
    ...Object.fromEntries(Object.entries(inputs.attributes ?? {}).map(([k, v]) => [k, num(v)])),
    ...Object.fromEntries(Object.entries(extraVars ?? {}).map(([k, v]) => [k, num(v)])),
  };
  // Only allow numbers, the variable names, whitespace and arithmetic operators.
  const allowed = /^[\s\d.+\-*/()a-zA-Z_]+$/;
  if (!allowed.test(formula)) return 0;
  const tokens = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
  for (const t of tokens) {
    if (!(t in vars)) return 0; // unknown identifier -> reject
  }
  try {
    const fn = new Function(...Object.keys(vars), `"use strict"; return (${formula});`);
    const result = fn(...Object.values(vars));
    return Number.isFinite(result) ? round2(result) : 0;
  } catch {
    return 0;
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Configurable pricing inputs (Phase 4 part 5). Each variable carries its own
// default/min/max/required and whether it can be edited on the work order.
export interface PricingVariableDef {
  key: string;
  label: string;
  default?: number;
  min?: number;
  max?: number;
  editableInWorkOrder?: boolean;
  required?: boolean;
}

/**
 * Validate work-order pricing inputs against the service's variable definitions.
 * Returns an array of human-readable errors (empty = valid).
 */
export function validatePricingInputs(
  defs: PricingVariableDef[],
  values: Record<string, number | undefined>,
): string[] {
  const errors: string[] = [];
  for (const d of defs) {
    const raw = values[d.key];
    const provided = raw !== undefined && raw !== null && Number.isFinite(raw);
    if (!provided) {
      if (d.required) errors.push(`${d.label} is required.`);
      continue;
    }
    const v = raw as number;
    if (d.min != null && v < d.min) errors.push(`${d.label} must be at least ${d.min}.`);
    if (d.max != null && v > d.max) errors.push(`${d.label} must be at most ${d.max}.`);
  }
  return errors;
}
