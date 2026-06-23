import { requireSection } from "@/lib/rbac";
import { loadServiceFormOptions } from "@/lib/serviceOptions";
import { PageHeader } from "@/components/ui";
import ServiceBuilderForm, { type ServiceInitial } from "../ServiceBuilderForm";
import { createService } from "../actions";

const EMPTY: ServiceInitial = {
  name: "",
  code: "",
  categoryId: "",
  description: "",
  isPublic: false,
  active: true,
  defaultDuration: "",
  pricingType: "fixed",
  pricingConfig: {},
  pricingRules: {},
  defaultPrice: "",
  formFields: [],
  taskTemplates: [],
  allowedRoleKeys: [],
  checklistTemplateId: "",
  payrollRuleConfig: {},
};

export default async function NewServicePage() {
  await requireSection("services");
  const options = await loadServiceFormOptions();

  return (
    <div className="max-w-4xl">
      <PageHeader title="New Service" subtitle="Build a configurable service." />
      <ServiceBuilderForm initial={EMPTY} action={createService} {...options} />
    </div>
  );
}
