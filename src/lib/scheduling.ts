// Scheduling validation for the Calendar / Dispatch Board (Phase 4 part 1).
// Pure helpers + a DB-backed checker. Reused by calendar reschedule/assign actions.

import { db } from "./db";
import { parseJson } from "./format";

export interface Availability {
  days?: number[]; // weekday numbers 0-6 the staff member works
  startHour?: number; // 0-23
  endHour?: number; // 0-23
  unavailableDates?: string[]; // ISO dates (YYYY-MM-DD) off
}

export interface SchedulingIssue {
  code: "eligibility" | "availability" | "conflict" | "dependency" | "wo_status";
  message: string;
}

/** Pure availability check — exported for unit testing. */
export function availabilityIssues(av: Availability, start: Date, end: Date): SchedulingIssue[] {
  const issues: SchedulingIssue[] = [];
  const day = start.getDay();
  if (av.days && av.days.length > 0 && !av.days.includes(day)) {
    issues.push({ code: "availability", message: "Staff is not scheduled to work that day." });
  }
  const iso = start.toISOString().slice(0, 10);
  if (av.unavailableDates?.includes(iso)) {
    issues.push({ code: "availability", message: "Staff is marked unavailable on that date." });
  }
  if (av.startHour != null && start.getHours() < av.startHour) {
    issues.push({ code: "availability", message: `Starts before the staff member's start hour (${av.startHour}:00).` });
  }
  if (av.endHour != null && end.getHours() > av.endHour) {
    issues.push({ code: "availability", message: `Ends after the staff member's end hour (${av.endHour}:00).` });
  }
  return issues;
}

/** Pure overlap check between a candidate window and existing windows. */
export function hasOverlap(
  start: Date,
  end: Date,
  others: { start: Date; end: Date }[],
): boolean {
  return others.some((o) => start < o.end && end > o.start);
}

interface ValidateArgs {
  taskId: string;
  staffId?: string | null; // proposed assignee (defaults to task's current)
  start?: Date | null; // proposed start (defaults to task's current scheduledStart)
  end?: Date | null;
}

/**
 * Full DB-backed validation for assigning/rescheduling a task. Returns all issues found.
 */
export async function validateScheduling(args: ValidateArgs): Promise<SchedulingIssue[]> {
  const issues: SchedulingIssue[] = [];
  const task = await db.task.findUnique({
    where: { id: args.taskId },
    include: {
      workOrder: true,
      serviceLine: { include: { serviceVersion: true } },
    },
  });
  if (!task) return [{ code: "wo_status", message: "Task not found." }];

  const staffId = args.staffId ?? task.assignedStaffId;
  const start = args.start ?? task.scheduledStart ?? task.dueAt ?? null;
  const end = args.end ?? task.scheduledEnd ?? (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);

  // Work order status must allow changes.
  if (["cancelled", "paid"].includes(task.workOrder.status)) {
    issues.push({ code: "wo_status", message: `Work order is ${task.workOrder.status}; scheduling is locked.` });
  }

  // Dependencies: the task it depends on must be completed.
  if (task.dependsOnTaskId) {
    const dep = await db.task.findUnique({ where: { id: task.dependsOnTaskId } });
    if (dep && dep.status !== "completed") {
      issues.push({ code: "dependency", message: `Depends on "${dep.name}", which is not completed yet.` });
    }
  }

  if (staffId) {
    // Eligibility: the staff member must be enabled for the line's service.
    const serviceId = task.serviceLine?.serviceVersion.serviceId;
    if (serviceId) {
      const eligible = await db.serviceEligibility.findUnique({
        where: { staffId_serviceId: { staffId, serviceId } },
      });
      if (!eligible) issues.push({ code: "eligibility", message: "Staff is not eligible for this service." });
    }

    if (start && end) {
      // Availability from the staff profile.
      const profile = await db.staffProfile.findUnique({ where: { id: staffId } });
      const av = parseJson<Availability>(profile?.availability, {});
      issues.push(...availabilityIssues(av, start, end));

      // Conflicts: other scheduled tasks for this staff member that overlap.
      const others = await db.task.findMany({
        where: {
          id: { not: task.id },
          assignedStaffId: staffId,
          status: { notIn: ["completed", "cancelled"] },
          scheduledStart: { not: null },
        },
        select: { scheduledStart: true, scheduledEnd: true },
      });
      const windows = others
        .filter((o) => o.scheduledStart)
        .map((o) => ({ start: o.scheduledStart!, end: o.scheduledEnd ?? new Date(o.scheduledStart!.getTime() + 3600000) }));
      if (hasOverlap(start, end, windows)) {
        issues.push({ code: "conflict", message: "Staff already has an overlapping task at that time." });
      }
    }
  }

  return issues;
}
