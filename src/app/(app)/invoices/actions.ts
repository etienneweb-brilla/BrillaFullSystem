"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextInvoiceNumber } from "@/lib/sequence";
import { getVatSettings } from "@/lib/settings";
import { applyVat, round2 } from "@/lib/pricing";

/** Generate an invoice from a Work Order using GLOBAL VAT settings (spec §29 / rule #5). */
export async function generateInvoice(formData: FormData) {
  const user = await requireSection("invoices");
  const workOrderId = String(formData.get("workOrderId") ?? "");
  const wo = await db.workOrder.findUnique({
    where: { id: workOrderId },
    include: { serviceLines: { include: { serviceVersion: { include: { service: true } } } }, client: true },
  });
  if (!wo || wo.serviceLines.length === 0) redirect(`/workorders/${workOrderId}`);

  const vat = await getVatSettings();
  const lines = wo.serviceLines.map((l) => ({
    description: l.serviceVersion.service.name,
    amount: round2(l.price),
  }));
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const breakdown = applyVat(subtotal, vat);

  const number = await nextInvoiceNumber();
  const invoice = await db.invoice.create({
    data: {
      number,
      workOrderId,
      clientId: wo.clientId,
      lines: JSON.stringify(lines),
      subtotal: vat.inclusive ? breakdown.net : subtotal,
      vatRate: vat.enabled ? vat.rate : 0,
      vatAmount: breakdown.vat,
      total: breakdown.gross,
      status: "unpaid",
    },
  });
  await db.workOrder.update({ where: { id: workOrderId }, data: { status: "invoiced" } });
  await writeAudit({ actorId: user.id, entityType: "invoice", entityId: invoice.id, action: "create", newValue: { number, total: breakdown.gross } });
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

/** Record a payment (manual — no online provider needed in Phase 1). */
export async function recordPayment(invoiceId: string, formData: FormData) {
  const user = await requireSection("invoices");
  const amount = parseFloat(String(formData.get("amount") ?? "0")) || 0;
  const method = String(formData.get("method") ?? "cash");
  if (amount <= 0) return;

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) return;

  await db.payment.create({ data: { invoiceId, amount, method, reference: String(formData.get("reference") ?? "") || null } });
  const paid = round2(invoice.amountPaid + amount);
  const status = paid >= invoice.total ? "paid" : paid > 0 ? "partial" : "unpaid";
  await db.invoice.update({ where: { id: invoiceId }, data: { amountPaid: paid, status } });

  if (status === "paid" && invoice.workOrderId) {
    await db.workOrder.update({ where: { id: invoice.workOrderId }, data: { status: "paid" } });
  }
  await writeAudit({ actorId: user.id, entityType: "invoice", entityId: invoiceId, action: "update", newValue: { amountPaid: paid, status } });
  revalidatePath(`/invoices/${invoiceId}`);
}
