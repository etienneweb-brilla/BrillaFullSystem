import { db } from "./db";

// Records changes to sensitive entities (prices, services, work orders, invoices,
// payroll, staff, settings) — spec §35. Audit logging is especially important for
// payroll, pricing, VAT and invoice changes.

interface AuditArgs {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete" | "status_change" | "price_change";
  oldValue?: unknown;
  newValue?: unknown;
}

export async function writeAudit(args: AuditArgs): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: args.actorId ?? null,
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      oldValue: args.oldValue === undefined ? null : JSON.stringify(args.oldValue),
      newValue: args.newValue === undefined ? null : JSON.stringify(args.newValue),
    },
  });
}
