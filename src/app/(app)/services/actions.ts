"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { PRICING_TYPES, type PricingType } from "@/lib/pricing";

// Shape of the data the Service Builder form submits (as a single JSON payload).
export interface ServiceFormPayload {
  name: string;
  code?: string;
  categoryId?: string;
  description?: string;
  isPublic: boolean;
  active: boolean;
  defaultDuration?: number;
  pricingType: PricingType;
  pricingConfig: Record<string, unknown>;
  pricingRules: Record<string, unknown>;
  defaultPrice?: number | null;
  formFields: { key: string; label: string; type: string; required?: boolean }[];
  taskTemplates: { name: string; taskType?: string; requiredRoleKey?: string; photosRequired?: boolean }[];
  allowedRoleKeys: string[];
  checklistTemplateId?: string | null;
  payrollRuleConfig: Record<string, unknown>;
  automationRules?: unknown[];
}

function parsePayload(formData: FormData): ServiceFormPayload {
  const raw = String(formData.get("payload") ?? "{}");
  const p = JSON.parse(raw) as ServiceFormPayload;
  if (!PRICING_TYPES.includes(p.pricingType)) p.pricingType = "fixed";
  return p;
}

function versionData(p: ServiceFormPayload, version: number) {
  return {
    version,
    isActive: true,
    defaultDuration: p.defaultDuration ?? null,
    pricingType: p.pricingType,
    pricingConfig: JSON.stringify(p.pricingConfig ?? {}),
    pricingRules: JSON.stringify(p.pricingRules ?? {}),
    defaultPrice: p.defaultPrice ?? null,
    formFields: JSON.stringify(p.formFields ?? []),
    payrollRuleConfig: JSON.stringify(p.payrollRuleConfig ?? {}),
    automationRules: JSON.stringify(p.automationRules ?? []),
    allowedRoleKeys: JSON.stringify(p.allowedRoleKeys ?? []),
    checklistTemplateId: p.checklistTemplateId ?? null,
    taskTemplateRows: {
      create: (p.taskTemplates ?? []).map((t, i) => ({
        name: t.name,
        taskType: t.taskType ?? null,
        requiredRoleKey: t.requiredRoleKey ?? null,
        checklistTemplateId: p.checklistTemplateId ?? null,
        photosRequired: !!t.photosRequired,
        sortOrder: i,
      })),
    },
  };
}

export async function createService(formData: FormData) {
  const user = await requireSection("services");
  const p = parsePayload(formData);

  const service = await db.service.create({
    data: {
      name: p.name,
      code: p.code || null,
      categoryId: p.categoryId || null,
      description: p.description || null,
      isPublic: p.isPublic,
      active: p.active,
      versions: { create: versionData(p, 1) },
    },
  });
  await writeAudit({ actorId: user.id, entityType: "service", entityId: service.id, action: "create", newValue: { name: p.name } });
  revalidatePath("/services");
  redirect(`/services/${service.id}`);
}

/** Editing a service creates a NEW VERSION; the old version is kept for history. */
export async function updateService(serviceId: string, formData: FormData) {
  const user = await requireSection("services");
  const p = parsePayload(formData);

  const existing = await db.service.findUnique({
    where: { id: serviceId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!existing) redirect("/services");
  const nextVersion = (existing.versions[0]?.version ?? 0) + 1;

  await db.$transaction([
    // Deactivate all prior versions (only the newest is active for new work orders).
    db.serviceVersion.updateMany({ where: { serviceId }, data: { isActive: false } }),
    db.service.update({
      where: { id: serviceId },
      data: {
        name: p.name,
        code: p.code || null,
        categoryId: p.categoryId || null,
        description: p.description || null,
        isPublic: p.isPublic,
        active: p.active,
        versions: { create: versionData(p, nextVersion) },
      },
    }),
  ]);
  await writeAudit({
    actorId: user.id,
    entityType: "service",
    entityId: serviceId,
    action: "update",
    newValue: { version: nextVersion, name: p.name },
  });
  revalidatePath(`/services/${serviceId}`);
  redirect(`/services/${serviceId}`);
}

/** Clone a service (and its latest version) into a brand-new service. */
export async function cloneService(formData: FormData) {
  const user = await requireSection("services");
  const serviceId = String(formData.get("id"));
  const src = await db.service.findUnique({
    where: { id: serviceId },
    include: { versions: { orderBy: { version: "desc" }, take: 1, include: { taskTemplateRows: true } } },
  });
  if (!src) redirect("/services");
  const v = src.versions[0];

  const clone = await db.service.create({
    data: {
      name: `${src.name} (Copy)`,
      code: src.code ? `${src.code}-COPY` : null,
      categoryId: src.categoryId,
      description: src.description,
      isPublic: src.isPublic,
      active: src.active,
      versions: v
        ? {
            create: {
              version: 1,
              isActive: true,
              defaultDuration: v.defaultDuration,
              pricingType: v.pricingType,
              pricingConfig: v.pricingConfig,
              pricingRules: v.pricingRules,
              defaultPrice: v.defaultPrice,
              formFields: v.formFields,
              payrollRuleConfig: v.payrollRuleConfig,
              automationRules: v.automationRules,
              allowedRoleKeys: v.allowedRoleKeys,
              checklistTemplateId: v.checklistTemplateId,
              taskTemplateRows: {
                create: v.taskTemplateRows.map((t) => ({
                  name: t.name,
                  taskType: t.taskType,
                  requiredRoleKey: t.requiredRoleKey,
                  checklistTemplateId: t.checklistTemplateId,
                  photosRequired: t.photosRequired,
                  notesRequired: t.notesRequired,
                  signatureRequired: t.signatureRequired,
                  sortOrder: t.sortOrder,
                })),
              },
            },
          }
        : undefined,
    },
  });
  await writeAudit({ actorId: user.id, entityType: "service", entityId: clone.id, action: "create", newValue: { clonedFrom: serviceId } });
  revalidatePath("/services");
  redirect(`/services/${clone.id}`);
}
