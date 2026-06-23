// Payroll / commission engine (spec §12). The KEY rule: commission is computed from
// the assigned SERVICE LINE (or task), never the Work Order total (spec 8.3 / rule #7).

import { round2 } from "./pricing";

export type PayType =
  | "hourly"
  | "salary"
  | "commission"
  | "perTask"
  | "perServiceLine"
  | "hybrid";

export interface PayrollRuleConfig {
  payType: PayType;
  baseHourlyRate?: number;
  overtimeRate?: number;
  minPerJob?: number;
  commissionPercent?: number; // % of the service line price
  commissionFixed?: number; // fixed amount per line
  perServiceLineAmount?: number;
  perTaskAmount?: number;
}

export interface ServiceLinePay {
  /** The commissionable amount = THIS service line's price (not the work order). */
  serviceLinePrice: number;
  hoursWorked?: number;
  taskCount?: number;
}

export interface PayResult {
  base: number; // wage component (hourly/salary share/perTask)
  commission: number; // commission component
  total: number;
  basis: string; // human-readable explanation
}

/**
 * Compute the pay a staff member earns for ONE assigned service line.
 * Always reads `input.serviceLinePrice` for commission — proving rule #7.
 */
export function computeServiceLinePay(rule: PayrollRuleConfig, input: ServiceLinePay): PayResult {
  const linePrice = Math.max(input.serviceLinePrice, 0);
  const hours = Math.max(input.hoursWorked ?? 0, 0);
  const tasks = Math.max(input.taskCount ?? 0, 0);

  let base = 0;
  let commission = 0;
  let basis = "";

  switch (rule.payType) {
    case "hourly":
      base = hours * (rule.baseHourlyRate ?? 0);
      basis = `${hours}h × ${rule.baseHourlyRate ?? 0}/h`;
      break;
    case "salary":
      base = 0; // salary is handled at the period level, not per line
      basis = "salary (period-level)";
      break;
    case "commission":
      commission = linePrice * ((rule.commissionPercent ?? 0) / 100) + (rule.commissionFixed ?? 0);
      basis = `${rule.commissionPercent ?? 0}% of line ${linePrice}` +
        (rule.commissionFixed ? ` + ${rule.commissionFixed}` : "");
      break;
    case "perTask":
      base = tasks * (rule.perTaskAmount ?? 0);
      basis = `${tasks} task(s) × ${rule.perTaskAmount ?? 0}`;
      break;
    case "perServiceLine":
      base = rule.perServiceLineAmount ?? 0;
      basis = `flat ${rule.perServiceLineAmount ?? 0} per line`;
      break;
    case "hybrid":
      base = hours * (rule.baseHourlyRate ?? 0);
      commission = linePrice * ((rule.commissionPercent ?? 0) / 100);
      basis = `${hours}h × ${rule.baseHourlyRate ?? 0}/h + ${rule.commissionPercent ?? 0}% of line`;
      break;
  }

  let total = base + commission;
  if (rule.minPerJob && total < rule.minPerJob) {
    total = rule.minPerJob;
    basis += ` (raised to min ${rule.minPerJob})`;
  }

  return {
    base: round2(base),
    commission: round2(commission),
    total: round2(total),
    basis,
  };
}

/** Sum pay across multiple assigned service lines. */
export function sumPay(results: PayResult[]): PayResult {
  return results.reduce<PayResult>(
    (acc, r) => ({
      base: round2(acc.base + r.base),
      commission: round2(acc.commission + r.commission),
      total: round2(acc.total + r.total),
      basis: "sum of assigned lines",
    }),
    { base: 0, commission: 0, total: 0, basis: "sum of assigned lines" },
  );
}
