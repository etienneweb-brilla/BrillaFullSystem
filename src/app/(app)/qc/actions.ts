"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function approveTask(formData: FormData) {
  const user = await requireSection("qc");
  const taskId = String(formData.get("taskId") ?? "");
  const notes = String(formData.get("reviewNotes") ?? "") || null;
  if (!taskId) return;
  await db.task.update({
    where: { id: taskId },
    data: { qualityStatus: "approved", reviewNotes: notes, reviewedById: user.id },
  });
  await writeAudit({ actorId: user.id, entityType: "task", entityId: taskId, action: "update", newValue: { qualityStatus: "approved" } });
  revalidatePath("/qc");
}

/** Reject a task → mark it rejected and auto-create a revisit task on the same line. */
export async function rejectTask(formData: FormData) {
  const user = await requireSection("qc");
  const taskId = String(formData.get("taskId") ?? "");
  const notes = String(formData.get("reviewNotes") ?? "") || null;
  if (!taskId) return;
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  await db.task.update({
    where: { id: taskId },
    data: { qualityStatus: "rejected", reviewNotes: notes, reviewedById: user.id },
  });

  // Create a revisit task (spec §19) assigned to the same staff member, depends on original.
  await db.task.create({
    data: {
      workOrderId: task.workOrderId,
      serviceLineId: task.serviceLineId,
      name: `Revisit: ${task.name}`,
      taskType: task.taskType,
      requiredRoleKey: task.requiredRoleKey,
      assignedStaffId: task.assignedStaffId,
      status: task.assignedStaffId ? "assigned" : "pending",
      checklistTemplateId: task.checklistTemplateId,
      photosRequired: task.photosRequired,
      notesRequired: task.notesRequired,
      signatureRequired: task.signatureRequired,
      dependsOnTaskId: task.id,
      isRevisit: true,
    },
  });
  // Reopen the service line.
  if (task.serviceLineId) {
    await db.serviceLine.update({ where: { id: task.serviceLineId }, data: { status: "in_progress" } });
  }
  await writeAudit({ actorId: user.id, entityType: "task", entityId: taskId, action: "update", newValue: { qualityStatus: "rejected", revisitCreated: true } });
  revalidatePath("/qc");
}
