import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { loadServiceFormOptions } from "@/lib/serviceOptions";
import { parseJson } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import ServiceBuilderForm, { type ServiceInitial } from "../ServiceBuilderForm";
import { updateService, cloneService } from "../actions";

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("services");
  const { id } = await params;
  const service = await db.service.findUnique({
    where: { id },
    include: {
      category: true,
      versions: { orderBy: { version: "desc" }, include: { taskTemplateRows: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!service) notFound();

  const latest = service.versions[0];
  const options = await loadServiceFormOptions();

  const initial: ServiceInitial = {
    name: service.name,
    code: service.code ?? "",
    categoryId: service.categoryId ?? "",
    description: service.description ?? "",
    isPublic: service.isPublic,
    active: service.active,
    defaultDuration: latest?.defaultDuration ?? "",
    pricingType: latest?.pricingType ?? "fixed",
    pricingConfig: parseJson(latest?.pricingConfig, {}),
    pricingRules: parseJson(latest?.pricingRules, {}),
    defaultPrice: latest?.defaultPrice ?? "",
    formFields: parseJson(latest?.formFields, []),
    taskTemplates: (latest?.taskTemplateRows ?? []).map((t) => ({
      name: t.name,
      taskType: t.taskType ?? "",
      requiredRoleKey: t.requiredRoleKey ?? "",
      photosRequired: t.photosRequired,
    })),
    allowedRoleKeys: parseJson(latest?.allowedRoleKeys, []),
    checklistTemplateId: latest?.checklistTemplateId ?? "",
    payrollRuleConfig: parseJson(latest?.payrollRuleConfig, {}),
    automationRules: parseJson(latest?.automationRules, []),
  };

  const updateBound = updateService.bind(null, service.id);

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link href="/services" className="text-sm text-brand-dark hover:underline">← All services</Link>
      </div>
      <PageHeader
        title={service.name}
        subtitle={`Currently v${latest?.version ?? 1}. Saving creates a new version; old work orders keep their version.`}
      />

      <div className="mb-6 flex items-center gap-3">
        <form action={cloneService}>
          <input type="hidden" name="id" value={service.id} />
          <button className="btn-secondary" type="submit">Clone this service</button>
        </form>
        <span className="text-sm text-gray-500">
          {service.versions.length} version{service.versions.length === 1 ? "" : "s"} ·{" "}
          {service.versions.map((v) => `v${v.version}`).join(", ")}
        </span>
      </div>

      <ServiceBuilderForm initial={initial} action={updateBound} {...options} />
    </div>
  );
}
