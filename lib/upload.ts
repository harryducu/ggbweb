import { randomBytes } from "node:crypto";
import { storage } from "./storage";

/** Only image types a browser can render, mapped to a safe extension. */
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

const MAX_BYTES = 6 * 1024 * 1024;

export class UploadError extends Error {}

/**
 * Stores an uploaded image and returns the URL to render it from. The filename
 * is generated, never taken from the upload, so a crafted name can't escape the
 * uploads directory.
 */
export async function saveImage(
  file: File | null,
  folder: "players" | "teams" | "league",
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const ext = ALLOWED[file.type];
  if (!ext) {
    throw new UploadError(
      `"${file.type || "unknown"}" isn't a supported image type. Use JPG, PNG, WEBP, GIF, AVIF or SVG.`,
    );
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError(
      `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. Keep uploads under 6MB.`,
    );
  }

  const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  return storage().putImage(folder, name, bytes, file.type);
}

/** Best-effort cleanup of a previously uploaded image. Never throws. */
export async function deleteUpload(ref: string | null): Promise<void> {
  if (!ref) return;
  await storage().deleteImage(ref);
}
