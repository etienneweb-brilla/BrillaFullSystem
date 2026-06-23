import { db } from "./db";

// Generates human-friendly sequential reference numbers for work orders, invoices
// and quotes, e.g. WO-2026-0001. Uses a count-based approach (adequate for Phase 1).

export async function nextWorkOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.workOrder.count();
  return `WO-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.invoice.count();
  return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.quote.count();
  return `Q-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextLaundryBatchNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.laundryBatch.count();
  return `LB-${year}-${String(count + 1).padStart(4, "0")}`;
}
