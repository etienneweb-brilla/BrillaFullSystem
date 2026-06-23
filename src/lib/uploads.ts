import "server-only";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Saves an uploaded file to /public/uploads and returns its public URL.
// Local filesystem storage is fine for dev; swap for object storage in production.
export async function saveUpload(file: File): Promise<{ url: string; fileName: string } | null> {
  if (!file || file.size === 0) return null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  await writeFile(path.join(dir, fileName), bytes);
  return { url: `/uploads/${fileName}`, fileName };
}
