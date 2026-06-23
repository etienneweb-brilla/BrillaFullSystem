import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";
import NewWorkOrderForm from "../NewWorkOrderForm";
import { createWorkOrder } from "../actions";

export default async function NewWorkOrderPage() {
  await requireSection("workorders");
  const [clients, properties] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.property.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (clients.length === 0 || properties.length === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="New Work Order" />
        <EmptyState message="Create at least one client and property before adding a work order." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="New Work Order" />
      <NewWorkOrderForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        properties={properties.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))}
        action={createWorkOrder}
      />
    </div>
  );
}
