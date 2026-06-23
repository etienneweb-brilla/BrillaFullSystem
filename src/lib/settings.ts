import { db } from "./db";
import type { VatSettings } from "./pricing";

// Global settings accessors. VAT is GLOBAL (spec rule #5) — never per service.

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
}

export interface FinanceSettings {
  currency: string; // e.g. "AED"
  vatEnabled: boolean;
  vatRate: number; // percent
  vatNumber: string;
  inclusive: boolean; // prices include VAT?
  paymentTerms: string;
}

const COMPANY_DEFAULT: CompanySettings = {
  name: "Brilla Services",
  address: "",
  phone: "",
  email: "",
  logoUrl: "",
};

const FINANCE_DEFAULT: FinanceSettings = {
  currency: "AED",
  vatEnabled: true,
  vatRate: 5,
  vatNumber: "",
  inclusive: false,
  paymentTerms: "Due on receipt",
};

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return { ...fallback, ...JSON.parse(row.value) } as T;
  } catch {
    return fallback;
  }
}

export async function getCompanySettings(): Promise<CompanySettings> {
  return readSetting("company", COMPANY_DEFAULT);
}

export async function getFinanceSettings(): Promise<FinanceSettings> {
  return readSetting("finance", FINANCE_DEFAULT);
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  await db.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

/** VAT settings shaped for the pricing engine. */
export async function getVatSettings(): Promise<VatSettings> {
  const f = await getFinanceSettings();
  return { enabled: f.vatEnabled, rate: f.vatRate, inclusive: f.inclusive };
}

export const SETTINGS_DEFAULTS = { COMPANY_DEFAULT, FINANCE_DEFAULT };
