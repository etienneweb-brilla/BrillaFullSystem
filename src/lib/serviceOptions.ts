import { db } from "./db";

// Loads the configurable option lists the Service Builder form needs.
export async function loadServiceFormOptions() {
  const [categories, roles, checklists] = await Promise.all([
    db.serviceCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.checklistTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    roles: roles.map((r) => ({ key: r.key, name: r.name })),
    checklists: checklists.map((c) => ({ id: c.id, name: c.name })),
  };
}
