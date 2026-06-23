"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
import { writeAudit } from "@/lib/audit";
import { planAutomations, parseRules } from "@/lib/automation";

async function myProfileId(): Promise<string | null> {
  const user = await requireUser();
  return user.staffProfileId;
}

export async function clockIn() {
  const staffId = await myProfileId();
  if (!staffId) return;
  const open = await db.timeEntry.findFirst({ where: { staffId, clockOut: null } });
  if (open) return; // already clocked in
  await db.timeEntry.create({ data: { staffId, clockIn: new Date() } });
  revalidatePath("/me");
}

export async function clockOut() {
  const staffId = await myProfileId();
  if (!staffId) return;
  const open = await db.timeEntry.findFirst({ where: { staffId, clockOut: null }, orderBy: { clockIn: "desc" } });
  if (!open) return;
  await db.timeEntry.update({ where: { id: open.id }, data: { clockOut: new Date() } });
  revalidatePath("/me");
}

export async function startTask(formData: FormData) {
  const staffId = await myProfileId();
  const taskId = String(formData.get("taskId") ?? "");
  if (!staffId || !taskId) return;
  const task = await db.task.findFirst({ where: { id: taskId, assignedStaffId: staffId } });
  if (!task) return;
  await db.task.update({ where: { id: taskId }, data: { status: "in_progress", startedAt: new Date() } });
  // Move the parent service line to in_progress too.
  if (task.serviceLineId) {
    await db.serviceLine.update({ where: { id: task.serviceLineId }, data: { status: "in_progress" } });
  }
  revalidatePath(`/me/tasks/${taskId}`);
  revalidatePath("/me");
}

export async function uploadTaskPhoto(formData: FormData) {
  const staffId = await myProfileId();
  const taskId = String(formData.get("taskId") ?? "");
  if (!staffId || !taskId) return;
  const file = formData.get("photo");
  if (!(file instanceof File)) return;
  const saved = await saveUpload(file);
  if (!saved) return;
  await db.attachment.create({
    data: {
      entityType: "task",
      entityId: taskId,
      taskId,
      url: saved.url,
      fileName: saved.fileName,
      fileType: String(formData.get("fileType") ?? "general"),
      uploadedById: (await requireUser()).id,
    },
  });
  revalidatePath(`/me/tasks/${taskId}`);
}

export async function completeTask(formData: FormData) {
  const staffId = await myProfileId();
  const taskId = String(formData.get("taskId") ?? "");
  if (!staffId || !taskId) return;
  const task = await db.task.findFirst({
    where: { id: taskId, assignedStaffId: staffId },
    include: { attachments: true, serviceLine: { include: { tasks: true, serviceVersion: true } } },
  });
  if (!task) return;

  // Enforce completion requirements.
  if (task.photosRequired && task.attachments.length === 0) {
    revalidatePath(`/me/tasks/${taskId}?error=photo`);
    return;
  }

  const notes = String(formData.get("notes") ?? "");
  if (task.notesRequired && !notes.trim()) {
    return;
  }

  // Collect checklist results (checkbox inputs named check_<itemId>).
  const results: { itemId: string; done: boolean }[] = [];
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("check_")) results.push({ itemId: k.slice(6), done: v === "on" });
  }

  // Tasks that capture photos/signatures go into the QC review queue (spec §19).
  const needsReview = task.photosRequired || task.signatureRequired;
  await db.task.update({
    where: { id: taskId },
    data: {
      status: "completed",
      completedAt: new Date(),
      notes: notes || null,
      checklistResults: JSON.stringify(results),
      qualityStatus: needsReview ? "pending_review" : null,
    },
  });

  // If all tasks on the service line are complete, complete the line.
  if (task.serviceLineId && task.serviceLine) {
    const remaining = task.serviceLine.tasks.filter((t) => t.id !== taskId && t.status !== "completed");
    if (remaining.length === 0) {
      await db.serviceLine.update({ where: { id: task.serviceLineId }, data: { status: "completed" } });
    }
  }
  // Run task_completed automations from the service version (spec §5.8).
  if (task.serviceLine?.serviceVersion) {
    const planned = planAutomations(parseRules(task.serviceLine.serviceVersion.automationRules), { event: "task_completed" });
    for (const a of planned) {
      if (a.type === "create_task" || a.type === "create_followup") {
        await db.task.create({
          data: {
            workOrderId: task.workOrderId,
            serviceLineId: task.serviceLineId,
            name: a.taskName ?? "Follow-up",
            requiredRoleKey: a.requiredRoleKey ?? null,
            status: "pending",
            dueAt: a.dueInDays ? new Date(Date.now() + a.dueInDays * 86400000) : null,
          },
        });
      } else if (a.type === "create_issue") {
        await db.issue.create({ data: { type: "general", title: a.issueTitle ?? "Automated issue", workOrderId: task.workOrderId } });
      }
    }
  }
  await writeAudit({ actorId: (await requireUser()).id, entityType: "task", entityId: taskId, action: "status_change", newValue: { status: "completed" } });
  revalidatePath("/me");
}

/** Driver marks a laundry batch they're assigned to as collected/delivered. */
export async function driverUpdateBatch(formData: FormData) {
  const staffId = await myProfileId();
  const batchId = String(formData.get("batchId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!staffId || !batchId) return;
  const batch = await db.laundryBatch.findFirst({ where: { id: batchId, driverStaffId: staffId } });
  if (!batch) return; // only the assigned driver can update
  const allowed = ["collected", "returned"];
  if (!allowed.includes(status)) return;
  const data: { status: string; collectionDate?: Date; returnDate?: Date } = { status };
  if (status === "collected") data.collectionDate = new Date();
  if (status === "returned") data.returnDate = new Date();
  await db.laundryBatch.update({ where: { id: batchId }, data });
  revalidatePath("/me");
}

export async function reportIssue(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const task = taskId ? await db.task.findUnique({ where: { id: taskId } }) : null;
  await db.issue.create({
    data: {
      type: String(formData.get("type") ?? "general"),
      title,
      description: String(formData.get("description") ?? "") || null,
      taskId,
      workOrderId: task?.workOrderId ?? null,
      createdById: user.id,
    },
  });
  if (taskId) revalidatePath(`/me/tasks/${taskId}`);
}
