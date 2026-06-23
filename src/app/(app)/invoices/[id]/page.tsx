import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { money, dateOnly, parseJson } from "@/lib/format";
import { getCompanySettings, getFinanceSettings } from "@/lib/settings";
import { PageHeader, StatusBadge } from "@/components/ui";
import { recordPayment } from "../actions";
import PrintButton from "./PrintButton";

interface InvLine {
  description: string;
  amount: number;
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("invoices");
  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { client: true, workOrder: { include: { property: true } }, payments: { orderBy: { paidAt: "desc" } } },
  });
  if (!invoice) notFound();
  const [company, finance] = await Promise.all([getCompanySettings(), getFinanceSettings()]);
  const lines = parseJson<InvLine[]>(invoice.lines, []);
  const balance = invoice.total - invoice.amountPaid;
  const cur = finance.currency;

  const recordBound = recordPayment.bind(null, invoice.id);

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/invoices" className="text-sm text-brand-dark hover:underline">← All invoices</Link>
        <PrintButton />
      </div>
      <PageHeader title={`Invoice ${invoice.number}`} />

      {/* Printable area */}
      <div id="invoice-print" className="card mb-6 p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-brand-dark">{company.name}</h2>
            <p className="text-sm text-gray-500">{company.address}</p>
            <p className="text-sm text-gray-500">{company.email} {company.phone}</p>
            {finance.vatNumber && <p className="text-sm text-gray-500">VAT: {finance.vatNumber}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">INVOICE</p>
            <p className="text-sm text-gray-500">{invoice.number}</p>
            <p className="text-sm text-gray-500">{dateOnly(invoice.issuedAt)}</p>
            <div className="mt-1"><StatusBadge status={invoice.status} /></div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-gray-400">Bill to</p>
          <p className="font-medium">{invoice.client.name}</p>
          {invoice.workOrder && <p className="text-sm text-gray-500">{invoice.workOrder.property.name} · WO {invoice.workOrder.number}</p>}
        </div>

        <table className="mb-4 w-full">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="th">Description</th>
              <th className="th text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="td">{l.description}</td>
                <td className="td text-right">{money(l.amount, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-64 space-y-1 text-sm">
          <Row label="Subtotal" value={money(invoice.subtotal, cur)} />
          {invoice.discount > 0 && <Row label="Discount" value={`- ${money(invoice.discount, cur)}`} />}
          <Row label={`VAT (${invoice.vatRate}%)`} value={money(invoice.vatAmount, cur)} />
          <Row label="Total" value={money(invoice.total, cur)} bold />
          <Row label="Paid" value={money(invoice.amountPaid, cur)} />
          <Row label="Balance due" value={money(balance, cur)} bold />
        </div>
        <p className="mt-6 text-xs text-gray-400">Payment terms: {finance.paymentTerms}</p>
      </div>

      {/* Payments (not printed) */}
      <section className="card p-6 print:hidden">
        <h2 className="mb-4 font-semibold text-gray-900">Payments</h2>
        {invoice.payments.length > 0 && (
          <ul className="mb-4 divide-y divide-gray-100 text-sm">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{dateOnly(p.paidAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}</span>
                <span>{money(p.amount, cur)}</span>
              </li>
            ))}
          </ul>
        )}
        {invoice.status !== "paid" ? (
          <form action={recordBound} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label">Amount</label>
              <input name="amount" type="number" step="0.01" defaultValue={balance.toFixed(2)} className="input w-32" />
            </div>
            <div>
              <label className="label">Method</label>
              <select name="method" className="input">
                <option value="cash">cash</option>
                <option value="bank">bank transfer</option>
                <option value="card">card</option>
                <option value="other">other</option>
              </select>
            </div>
            <div>
              <label className="label">Reference</label>
              <input name="reference" className="input" />
            </div>
            <button className="btn-primary" type="submit">Record payment</button>
          </form>
        ) : (
          <p className="text-sm text-green-700">This invoice is fully paid.</p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
