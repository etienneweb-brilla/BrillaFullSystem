"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";

async function myProfileId(): Promise<string | null> {
  const user = await requireUser();
  return user.staffProfileId;
}

/** Driver marks an assigned batch collected or delivered (returned). */
export async function setBatchStage(formData: FormData) {
  const staffId = await myProfileId();
  const batchId = String(formData.get("batchId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!staffId || !batchId || !["collected", "returned"].includes(status)) return;
  const batch = await db.laundryBatch.findFirst({ where: { id: batchId, driverStaffId: staffId } });
  if (!batch) return;
  const data: { status: string; collectionDate?: Date; returnDate?: Date } = { status };
  if (status === "collected") data.collectionDate = new Date();
  if (status === "returned") data.returnDate = new Date();
  await db.laundryBatch.update({ where: { id: batchId }, data });
  revalidatePath("/driver");
}

/** Upload a proof-of-collection/delivery photo against a batch. */
export async function uploadBatchProof(formData: FormData) {
  const user = await requireUser();
  const staffId = user.staffProfileId;
  const batchId = String(formData.get("batchId") ?? "");
  if (!staffId || !batchId) return;
  const batch = await db.laundryBatch.findFirst({ where: { id: batchId, driverStaffId: staffId } });
  if (!batch) return;
  const file = formData.get("photo");
  if (!(file instanceof File)) return;
  const saved = await saveUpload(file);
  if (!saved) return;
  await db.attachment.create({
    data: {
      entityType: "laundrybatch",
      entityId: batchId,
      url: saved.url,
      fileName: saved.fileName,
      fileType: String(formData.get("fileType") ?? "proof"),
      uploadedById: user.id,
    },
  });
  revalidatePath("/driver");
}

export async function addBatchNote(formData: FormData) {
  const staffId = await myProfileId();
  const batchId = String(formData.get("batchId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!staffId || !batchId || !note) return;
  const batch = await db.laundryBatch.findFirst({ where: { id: batchId, driverStaffId: staffId } });
  if (!batch) return;
  const existing = batch.notes ? `${batch.notes}\n` : "";
  await db.laundryBatch.update({ where: { id: batchId }, data: { notes: `${existing}${note}` } });
  revalidatePath("/driver");
}
