import { redirect } from "next/navigation";
import type { SessionUser } from "./auth";
import { requireUser } from "./auth";

// Section keys gate access to areas of the app. Roles carry a permissions JSON
// (configurable in Settings) mapping these keys to booleans.
export const SECTIONS = [
  "dashboard",
  "workorders",
  "services",
  "clients",
  "properties",
  "staff",
  "payroll",
  "invoices",
  "reports",
  "settings",
  "laundry", // laundry batches, items, manifests, return verification
  "suppliers", // supplier management
  "issues", // issue management
  "mytasks", // staff personal task dashboard
] as const;
export type Section = (typeof SECTIONS)[number];

export function isAdmin(user: SessionUser): boolean {
  return user.roleKeys.includes("admin") || user.permissions.admin === true;
}

export function can(user: SessionUser, section: Section): boolean {
  if (isAdmin(user)) return true;
  return user.permissions[section] === true;
}

/** Require the user to have access to a section, else redirect appropriately. */
export async function requireSection(section: Section): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, section)) {
    // Staff without admin sections land on their personal task dashboard.
    redirect(can(user, "mytasks") ? "/me" : "/login");
  }
  return user;
}

/** Where a user should land after login, based on their permissions. */
export function homePathFor(user: SessionUser): string {
  if (can(user, "dashboard")) return "/dashboard";
  if (can(user, "mytasks")) return "/me";
  return "/login";
}
