"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { validateScheduling, type SchedulingIssue } from "@/lib/scheduling";

export interface ActionResult {
  ok: boolean;
  errors: string[];
}

function toResult(issues: SchedulingIssue[]): ActionResult {
  return { ok: issues.length === 0, errors: issues.map((i) => i.message) };
}

const HOUR = 60 * 60 * 1000;

/** Reschedule a task to a new start (keeps its duration, default 1h). */
export async function rescheduleTask(taskId: string, startISO: string): Promise<ActionResult> {
  const user = await requireSection("calendar");
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return { ok: false, errors: ["Invalid date."] };
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, errors: ["Task not found."] };
  const duration = task.scheduledStart && task.scheduledEnd
    ? task.scheduledEnd.getTime() - task.scheduledStart.getTime()
    : HOUR;
  const end = new Date(start.getTime() + duration);

  const issues = await validateScheduling({ taskId, start, end });
  // Block only on hard conflicts; allow reschedule even if availability is soft? Spec wants
  // validation with meaningful errors — we block on any issue and report it.
  if (issues.length > 0) return toResult(issues);

  await db.task.update({ where: { id: taskId }, data: { scheduledStart: start, scheduledEnd: end, dueAt: start } });
  await writeAudit({ actorId: user.id, entityType: "task", entityId: taskId, action: "update", newValue: { scheduledStart: startISO } });
  revalidatePath("/calendar");
  return { ok: true, errors: [] };
}

/** Assign/reassign a task to a staff member, with eligibility/availability/conflict checks. */
export async function assignTaskTo(taskId: string, staffId: string | null): Promise<ActionResult> {
  const user = await requireSection("calendar");
  const issues = await validateScheduling({ taskId, staffId });
  if (staffId && issues.length > 0) return toResult(issues);

  await db.task.update({
    where: { id: taskId },
    data: { assignedStaffId: staffId, status: staffId ? "assigned" : "pending" },
  });
  await writeAudit({ actorId: user.id, entityType: "task", entityId: taskId, action: "update", newValue: { assignedStaffId: staffId } });
  revalidatePath("/calendar");
  return { ok: true, errors: [] };
}

export async function setTaskStatus(taskId: string, status: string): Promise<ActionResult> {
  const user = await requireSection("calendar");
  const data: Record<string, unknown> = { status };
  if (status === "completed") data.completedAt = new Date();
  if (status === "in_progress") data.startedAt = new Date();
  await db.task.update({ where: { id: taskId }, data });
  await writeAudit({ actorId: user.id, entityType: "task", entityId: taskId, action: "status_change", newValue: { status } });
  revalidatePath("/calendar");
  return { ok: true, errors: [] };
}

export async function setTaskPriority(taskId: string, priority: string): Promise<ActionResult> {
  await requireSection("calendar");
  await db.task.update({ where: { id: taskId }, data: { priority } });
  revalidatePath("/calendar");
  return { ok: true, errors: [] };
}

// --- Bulk operations ---

export async function bulkReschedule(taskIds: string[], startISO: string): Promise<ActionResult> {
  const errors: string[] = [];
  for (const id of taskIds) {
    const r = await rescheduleTask(id, startISO);
    if (!r.ok) errors.push(`Task skipped: ${r.errors.join(", ")}`);
  }
  return { ok: errors.length === 0, errors };
}

export async function bulkAssign(taskIds: string[], staffId: string | null): Promise<ActionResult> {
  const errors: string[] = [];
  for (const id of taskIds) {
    const r = await assignTaskTo(id, staffId);
    if (!r.ok) errors.push(`Task skipped: ${r.errors.join(", ")}`);
  }
  return { ok: errors.length === 0, errors };
}

export async function bulkStatus(taskIds: string[], status: string): Promise<ActionResult> {
  for (const id of taskIds) await setTaskStatus(id, status);
  return { ok: true, errors: [] };
}
