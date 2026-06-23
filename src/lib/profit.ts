// Profit/aggregation engine (spec §27, §32). Pure functions over service-line-like
// rows so reports stay consistent and testable. Reuses round2 from pricing.

import { round2 } from "./pricing";

export interface ServiceLineLike {
  price: number;
  supplierCost: number;
  materialCost: number;
  driverCost: number;
  labourCost?: number; // commission/wage attributed to the line (optional)
}

export interface ProfitSummary {
  revenue: number;
  cost: number;
  profit: number;
  margin: number; // percent of revenue
}

export function summarize(lines: ServiceLineLike[]): ProfitSummary {
  const revenue = lines.reduce((s, l) => s + l.price, 0);
  const cost = lines.reduce(
    (s, l) => s + l.supplierCost + l.materialCost + l.driverCost + (l.labourCost ?? 0),
    0,
  );
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return {
    revenue: round2(revenue),
    cost: round2(cost),
    profit: round2(profit),
    margin: round2(margin),
  };
}

/** Group rows by a key and summarise each group; returns sorted-by-revenue rows. */
export function groupSummary<T extends ServiceLineLike>(
  rows: T[],
  keyOf: (row: T) => string,
  labelOf: (row: T) => string,
): { key: string; label: string; summary: ProfitSummary }[] {
  const groups = new Map<string, { label: string; rows: T[] }>();
  for (const row of rows) {
    const k = keyOf(row);
    if (!groups.has(k)) groups.set(k, { label: labelOf(row), rows: [] });
    groups.get(k)!.rows.push(row);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label, summary: summarize(g.rows) }))
    .sort((a, b) => b.summary.revenue - a.summary.revenue);
}

/** YYYY-MM key for monthly grouping. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
