import "server-only";
import { db } from "./db";
import { nextWorkOrderNumber } from "./sequence";
import { parseJson } from "./format";
import {
  computeBasePrice,
  applyRules,
  resolvePrice,
  type PricingType,
  type PricingConfig,
  type PricingRules,
  type PricingInputs,
} from "./pricing";

export interface TemplateLine {
  serviceId: string;
  inputs?: PricingInputs;
  fulfilmentMode?: string;
}

/**
 * Create a Work Order from a template: snapshots each service's ACTIVE version, computes
 * the price via the pricing engine + override priority, and generates tasks. Shared by the
 * recurring-work-order generator. Returns the new work order id.
 */
export async function createWorkOrderFromTemplate(
  clientId: string,
  propertyId: string,
  lines: TemplateLine[],
  scheduledAt: Date | null,
): Promise<string> {
  const property = await db.property.findUnique({ where: { id: propertyId } });
  const number = await nextWorkOrderNumber();
  const wo = await db.workOrder.create({
    data: { number, clientId, propertyId, scheduledAt, status: scheduledAt ? "scheduled" : "draft" },
  });

  const propertyAttrs = parseJson<Record<string, number>>(property?.fieldValues, {});
  const propertyOverrides = parseJson<Record<string, number>>(property?.priceOverrides, {});

  for (const line of lines) {
    const version = await db.serviceVersion.findFirst({
      where: { serviceId: line.serviceId, isActive: true },
      orderBy: { version: "desc" },
      include: { taskTemplateRows: { orderBy: { sortOrder: "asc" } } },
    });
    if (!version) continue;

    const inputs: PricingInputs = { ...line.inputs, attributes: propertyAttrs };
    const config = parseJson<PricingConfig>(version.pricingConfig, {});
    const rules = parseJson<PricingRules>(version.pricingRules, {});
    const base = computeBasePrice(version.pricingType as PricingType, config, inputs);
    const withRules = applyRules(base, rules, inputs);
    const price = resolvePrice(withRules, {
      serviceDefault: version.defaultPrice ?? null,
      property: propertyOverrides[line.serviceId] ?? null,
    });

    await db.serviceLine.create({
      data: {
        workOrderId: wo.id,
        serviceVersionId: version.id,
        inputs: JSON.stringify(inputs),
        price,
        fulfilmentMode: line.fulfilmentMode ?? "internal",
        payrollConfig: version.payrollRuleConfig,
        tasks: {
          create: version.taskTemplateRows.map((t) => ({
            workOrderId: wo.id,
            name: t.name,
            taskType: t.taskType,
            requiredRoleKey: t.requiredRoleKey,
            checklistTemplateId: t.checklistTemplateId,
            photosRequired: t.photosRequired,
            notesRequired: t.notesRequired,
            signatureRequired: t.signatureRequired,
            dueAt: scheduledAt,
          })),
        },
      },
    });
  }
  return wo.id;
}

// Recurrence date math lives in a client-safe module so the form can preview it too.
export { advanceDate, previewOccurrences } from "./recurrence";
