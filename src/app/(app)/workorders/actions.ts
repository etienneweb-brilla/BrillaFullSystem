"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextWorkOrderNumber } from "@/lib/sequence";
import { parseJson } from "@/lib/format";
import {
  computeBasePrice,
  applyRules,
  resolvePrice,
  type PricingType,
  type PricingConfig,
  type PricingRules,
  type PricingInputs,
} from "@/lib/pricing";
import { planAutomations, parseRules } from "@/lib/automation";

export async function createWorkOrder(formData: FormData) {
  const user = await requireSection("workorders");
  const clientId = String(formData.get("clientId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!clientId || !propertyId) return;
  const scheduledRaw = String(formData.get("scheduledAt") ?? "");

  const number = await nextWorkOrderNumber();
  const wo = await db.workOrder.create({
    data: {
      number,
      clientId,
      propertyId,
      scheduledAt: scheduledRaw ? new Date(scheduledRaw) : null,
      status: scheduledRaw ? "scheduled" : "draft",
      internalNotes: String(formData.get("internalNotes") ?? "") || null,
      clientNotes: String(formData.get("clientNotes") ?? "") || null,
    },
  });
  await writeAudit({ actorId: user.id, entityType: "workorder", entityId: wo.id, action: "create", newValue: { number } });
  revalidatePath("/workorders");
  redirect(`/workorders/${wo.id}`);
}

/**
 * Add a service line to a work order. Snapshots the service's ACTIVE version,
 * computes the price from inputs + the price-priority chain, then generates tasks
 * from the version's task templates.
 */
export async function addServiceLine(workOrderId: string, formData: FormData) {
  const user = await requireSection("workorders");
  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return;

  const wo = await db.workOrder.findUnique({ where: { id: workOrderId }, include: { property: true } });
  if (!wo) return;

  const version = await db.serviceVersion.findFirst({
    where: { serviceId, isActive: true },
    orderBy: { version: "desc" },
    include: { taskTemplateRows: { orderBy: { sortOrder: "asc" } }, service: true },
  });
  if (!version) return;

  // Gather pricing inputs from the form + property attributes.
  const attributes = parseJson<Record<string, number>>(wo.property.fieldValues, {});
  const inputs: PricingInputs = {
    hours: numOrUndef(formData.get("hours")),
    manpower: numOrUndef(formData.get("manpower")),
    quantity: numOrUndef(formData.get("quantity")),
    itemQuantity: numOrUndef(formData.get("itemQuantity")),
    rooms: numOrUndef(formData.get("rooms")),
    attributes,
    weekend: formData.get("weekend") === "on",
    urgent: formData.get("urgent") === "on",
  };

  const config = parseJson<PricingConfig>(version.pricingConfig, {});
  const rules = parseJson<PricingRules>(version.pricingRules, {});
  const base = computeBasePrice(version.pricingType as PricingType, config, inputs);
  const withRules = applyRules(base, rules, inputs);

  // Price priority: service default -> property override -> client override -> manual.
  const propertyOverrides = parseJson<Record<string, number>>(wo.property.priceOverrides, {});
  const manual = numOrUndef(formData.get("manualPrice"));
  const price = resolvePrice(withRules, {
    serviceDefault: version.defaultPrice ?? null,
    property: propertyOverrides[serviceId] ?? null,
    client: null,
    manual: manual ?? null,
  });

  const line = await db.serviceLine.create({
    data: {
      workOrderId,
      serviceVersionId: version.id,
      inputs: JSON.stringify(inputs),
      price,
      manualPrice: manual ?? null,
      fulfilmentMode: String(formData.get("fulfilmentMode") ?? "internal"),
      payrollConfig: version.payrollRuleConfig,
      tasks: {
        create: version.taskTemplateRows.map((t) => ({
          workOrderId,
          name: t.name,
          taskType: t.taskType,
          requiredRoleKey: t.requiredRoleKey,
          checklistTemplateId: t.checklistTemplateId,
          photosRequired: t.photosRequired,
          notesRequired: t.notesRequired,
          signatureRequired: t.signatureRequired,
          dueAt: wo.scheduledAt,
        })),
      },
    },
  });
  await writeAudit({ actorId: user.id, entityType: "serviceline", entityId: line.id, action: "create", newValue: { serviceId, price } });

  // Run automation rules for this service version (spec §5.8).
  const planned = planAutomations(parseRules(version.automationRules), {
    event: "service_line_added",
    fields: inputs as Record<string, unknown>,
  });
  for (const a of planned) {
    if (a.type === "create_task" || a.type === "create_followup") {
      await db.task.create({
        data: {
          workOrderId,
          serviceLineId: line.id,
          name: a.taskName ?? "Automated task",
          requiredRoleKey: a.requiredRoleKey ?? null,
          status: "pending",
          dueAt: a.dueInDays ? new Date(Date.now() + a.dueInDays * 86400000) : wo.scheduledAt,
        },
      });
    } else if (a.type === "create_issue") {
      await db.issue.create({
        data: { type: "general", title: a.issueTitle ?? "Automated issue", workOrderId, createdById: user.id },
      });
    }
  }
  revalidatePath(`/workorders/${workOrderId}`);
}

/** Assign a staff member to a service line — BLOCKS if they aren't eligible. */
export async function assignServiceLine(workOrderId: string, formData: FormData) {
  const user = await requireSection("workorders");
  const lineId = String(formData.get("lineId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  if (!lineId) return;

  if (staffId) {
    const line = await db.serviceLine.findUnique({
      where: { id: lineId },
      include: { serviceVersion: { include: { service: true } } },
    });
    if (!line) return;
    const serviceId = line.serviceVersion.serviceId;
    const eligible = await db.serviceEligibility.findUnique({
      where: { staffId_serviceId: { staffId, serviceId } },
    });
    if (!eligible) {
      // Eligibility rule (spec 5.9): block invalid assignment.
      redirect(`/workorders/${workOrderId}?error=not_eligible`);
    }
  }

  await db.serviceLine.update({
    where: { id: lineId },
    data: { assignedStaffId: staffId || null, status: staffId ? "assigned" : "pending" },
  });
  // Also assign the line's tasks to that staff member.
  await db.task.updateMany({
    where: { serviceLineId: lineId },
    data: { assignedStaffId: staffId || null, status: staffId ? "assigned" : "pending" },
  });
  await writeAudit({ actorId: user.id, entityType: "serviceline", entityId: lineId, action: "update", newValue: { assignedStaffId: staffId } });
  revalidatePath(`/workorders/${workOrderId}`);
}

export async function setWorkOrderStatus(workOrderId: string, formData: FormData) {
  const user = await requireSection("workorders");
  const status = String(formData.get("status") ?? "");
  if (!status) return;
  const old = await db.workOrder.findUnique({ where: { id: workOrderId } });
  await db.workOrder.update({ where: { id: workOrderId }, data: { status } });
  await writeAudit({
    actorId: user.id,
    entityType: "workorder",
    entityId: workOrderId,
    action: "status_change",
    oldValue: { status: old?.status },
    newValue: { status },
  });
  revalidatePath(`/workorders/${workOrderId}`);
}

export async function setServiceLineStatus(workOrderId: string, formData: FormData) {
  await requireSection("workorders");
  const lineId = String(formData.get("lineId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!lineId || !status) return;
  await db.serviceLine.update({ where: { id: lineId }, data: { status } });
  revalidatePath(`/workorders/${workOrderId}`);
}

export async function deleteServiceLine(workOrderId: string, formData: FormData) {
  await requireSection("workorders");
  const lineId = String(formData.get("lineId") ?? "");
  await db.serviceLine.delete({ where: { id: lineId } }).catch(() => {});
  revalidatePath(`/workorders/${workOrderId}`);
}

function numOrUndef(v: FormDataEntryValue | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
