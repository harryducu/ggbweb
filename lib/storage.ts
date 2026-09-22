import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Where league data and uploaded images live.
 *
 * Locally that is the filesystem. On Vercel it can't be: serverless functions
 * get a read-only filesystem (everything outside /tmp throws EROFS), and even
 * /tmp is wiped between invocations — so any write from the commissioner panel
 * fails, and anything that did land would vanish on the next deploy.
 *
 * When BLOB_READ_WRITE_TOKEN is present the Vercel Blob driver takes over and
 * both the league document and the uploads are stored there instead.
 */
export interface StorageDriver {
  readonly name: "filesystem" | "vercel-blob";
  /** The league document as JSON text, or null if it has never been written. */
  readDoc(): Promise<string | null>;
  writeDoc(json: string): Promise<void>;
  /** Stores an image and returns the URL to render it from. */
  putImage(
    folder: string,
    filename: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<string>;
  /** Best effort; never throws. */
  deleteImage(ref: string): Promise<void>;
}

/* --------------------------------------------------------------- filesystem */

const DATA_DIR = process.env.LEAGUE_DATA_DIR
  ? path.resolve(process.env.LEAGUE_DATA_DIR)
  : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "league.json");
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

const filesystemDriver: StorageDriver = {
  name: "filesystem",

  async readDoc() {
    try {
      return await fs.readFile(DATA_FILE, "utf8");
    } catch {
      return null;
    }
  },

  async writeDoc(json) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Write then rename, so an interrupted save can't truncate the league's
    // only copy of its season. The random suffix matters: two writes racing
    // inside one process would otherwise pick the same temp path, and the
    // loser's rename fails with ENOENT after the winner moves the file away.
    const tmp = `${DATA_FILE}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    await fs.writeFile(tmp, json, "utf8");
    await fs.rename(tmp, DATA_FILE);
  },

  async putImage(folder, filename, bytes) {
    const dir = path.join(UPLOAD_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), bytes);
    return `/uploads/${folder}/${filename}`;
  },

  async deleteImage(ref) {
    if (!ref.startsWith("/uploads/")) return;
    const abs = path.join(process.cwd(), "public", ref.replace(/^\//, ""));
    if (!abs.startsWith(UPLOAD_ROOT)) return;
    try {
      await fs.unlink(abs);
    } catch {
      // Already gone, or never written.
    }
  },
};

/* -------------------------------------------------------------- vercel blob */

const DOC_KEY = "league/league.json";

function blobDriver(): StorageDriver {
  return {
    name: "vercel-blob",

    async readDoc() {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: DOC_KEY, limit: 1 });
      const found = blobs.find((b) => b.pathname === DOC_KEY);
      if (!found) return null;
      // Blob URLs sit behind a CDN, so ask for the origin copy every time or
      // the commissioner can save a change and then read back the old one.
      const res = await fetch(`${found.url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return null;
      return res.text();
    },

    async writeDoc(json) {
      const { put } = await import("@vercel/blob");
      await put(DOC_KEY, json, {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
      });
    },

    async putImage(folder, filename, bytes, contentType) {
      const { put } = await import("@vercel/blob");
      const { url } = await put(`uploads/${folder}/${filename}`, bytes, {
        access: "public",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return url;
    },

    async deleteImage(ref) {
      if (!ref.startsWith("http")) return;
      try {
        const { del } = await import("@vercel/blob");
        await del(ref);
      } catch {
        // Already gone, or the token no longer has access.
      }
    },
  };
}

/* ------------------------------------------------------------------ selection */

let cached: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (!cached) {
    cached = process.env.BLOB_READ_WRITE_TOKEN ? blobDriver() : filesystemDriver;
  }
  return cached;
}

/** True when writes cannot possibly persist — used to warn in the admin panel. */
export function storageIsEphemeral(): boolean {
  return Boolean(process.env.VERCEL) && !process.env.BLOB_READ_WRITE_TOKEN;
}
