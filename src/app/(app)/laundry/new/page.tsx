import Link from "next/link";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader, EmptyState, FormError } from "@/components/ui";
import NewBatchForm from "../NewBatchForm";
import { createBatch } from "../actions";

export default async function NewBatchPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireSection("laundry");
  const { error } = await searchParams;
  const [properties, items, suppliers, drivers] = await Promise.all([
    db.property.findMany({ orderBy: { name: "asc" } }),
    db.laundryItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    db.staffProfile.findMany({
      where: { active: true, user: { roles: { some: { role: { key: "driver" } } } } },
      include: { user: true },
    }),
  ]);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="New Laundry Batch" />
        <EmptyState message="Add some laundry items first (Laundry → Manage laundry items)." />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/laundry" className="text-sm text-brand-dark hover:underline">← Laundry</Link>
      </div>
      <PageHeader title="New Laundry Batch" />
      {error === "empty" && <FormError error="Add at least one item line with a quantity." />}
      <NewBatchForm
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        items={items.map((i) => ({ id: i.id, name: i.name }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        drivers={drivers.map((d) => ({ id: d.id, name: d.user.name }))}
        action={createBatch}
      />
    </div>
  );
}
