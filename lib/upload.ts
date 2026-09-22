import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

/** Only image types the browser can render, mapped to a safe extension. */
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
 * Saves an uploaded image under public/uploads/<folder>/ and returns its public
 * path. The filename is generated, never taken from the upload, so a crafted
 * name can't escape the uploads directory.
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

  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });

  const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${folder}/${name}`;
}

/** Best-effort cleanup of a previously uploaded file. Never throws. */
export async function deleteUpload(publicPath: string | null): Promise<void> {
  if (!publicPath || !publicPath.startsWith("/uploads/")) return;
  const abs = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
  // Guard against a stored path that tries to climb out of the uploads folder.
  if (!abs.startsWith(UPLOAD_ROOT)) return;
  try {
    await fs.unlink(abs);
  } catch {
    // Already gone, or never written. Nothing to do.
  }
}
