"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function createIssue(formData: FormData) {
  const user = await requireSection("issues");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await db.issue.create({
    data: {
      type: String(formData.get("type") ?? "general"),
      title,
      description: String(formData.get("description") ?? "") || null,
      priority: String(formData.get("priority") ?? "normal"),
      propertyId: String(formData.get("propertyId") ?? "") || null,
      workOrderId: String(formData.get("workOrderId") ?? "") || null,
      createdById: user.id,
    },
  });
  revalidatePath("/issues");
}

export async function updateIssue(issueId: string, formData: FormData) {
  const user = await requireSection("issues");
  const status = String(formData.get("status") ?? "open");
  const priority = String(formData.get("priority") ?? "normal");
  const assignedToId = String(formData.get("assignedToId") ?? "") || null;
  const resolution = String(formData.get("resolution") ?? "") || null;
  const old = await db.issue.findUnique({ where: { id: issueId } });
  await db.issue.update({
    where: { id: issueId },
    data: { status, priority, assignedToId, resolution },
  });
  await writeAudit({
    actorId: user.id,
    entityType: "issue",
    entityId: issueId,
    action: "update",
    oldValue: { status: old?.status },
    newValue: { status, priority },
  });
  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
}
