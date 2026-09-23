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
  putImage(folder: string, filename: string, bytes: Buffer, contentType: string): Promise<string>;
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

/**
 * Two ways a connected Blob store authenticates:
 *
 * - OIDC, which is the current default on Vercel. The store contributes
 *   BLOB_STORE_ID and the SDK exchanges the deployment's OIDC identity for
 *   access. No long-lived secret exists, and none is needed.
 * - A static BLOB_READ_WRITE_TOKEN, still used for older stores and required
 *   anywhere outside Vercel. A store created with a custom variable prefix
 *   exports PREFIX_BLOB_READ_WRITE_TOKEN, so match on the suffix.
 *
 * OIDC takes precedence in the SDK when both are present, so the token is only
 * passed when we actually have one.
 */
/**
 * Turns an SDK failure into something a commissioner can act on. A wrong or
 * revoked token otherwise surfaces as a bare "This store does not exist",
 * which says nothing about where to go and fix it.
 */
async function withBlobContext<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not ${what} from Vercel Blob (${detail}). Check that a Blob store is ` +
        `still connected to this project and redeploy. Token variable: ${blobTokenName() ?? "none"}.`,
    );
  }
}

export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find(
    (k) => k.endsWith("BLOB_READ_WRITE_TOKEN") && process.env[k],
  );
  return key ? process.env[key] : undefined;
}

/** A Blob store is reachable if either auth route is available. */
export function blobConfigured(): boolean {
  return Boolean(blobToken() || process.env.BLOB_STORE_ID);
}

/** Only pass a token when one exists; otherwise let the SDK use OIDC. */
function blobAuth(): { token?: string } {
  const token = blobToken();
  return token ? { token } : {};
}

/** Name of the variable the token was found under, for the diagnostics panel. */
export function blobTokenName(): string | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "BLOB_READ_WRITE_TOKEN";
  return (
    Object.keys(process.env).find((k) => k.endsWith("BLOB_READ_WRITE_TOKEN") && process.env[k]) ??
    null
  );
}

function blobDriver(): StorageDriver {
  return {
    name: "vercel-blob",

    async readDoc() {
      const { list } = await import("@vercel/blob");
      const { blobs } = await withBlobContext("read the league data", () =>
        list({ prefix: DOC_KEY, limit: 1, ...blobAuth() }),
      );
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
      await withBlobContext("save the league data", () =>
        put(DOC_KEY, json, {
          ...blobAuth(),
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 0,
        }),
      );
    },

    async putImage(folder, filename, bytes, contentType) {
      const { put } = await import("@vercel/blob");
      const { url } = await put(`uploads/${folder}/${filename}`, bytes, {
        ...blobAuth(),
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
        await del(ref, { ...blobAuth() });
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
    cached = blobConfigured() ? blobDriver() : filesystemDriver;
  }
  return cached;
}

/** True when writes cannot possibly persist — used to warn in the admin panel. */
export function storageIsEphemeral(): boolean {
  return Boolean(process.env.VERCEL) && !blobConfigured();
}

/** What the running deployment can actually see, for the diagnostics panel. */
export function storageReport() {
  return {
    onVercel: Boolean(process.env.VERCEL),
    driver: storage().name,
    auth: blobToken()
      ? `static token (${blobTokenName()})`
      : process.env.BLOB_STORE_ID
        ? "OIDC via BLOB_STORE_ID"
        : "none",
    tokenVariable: blobTokenName(),
    blobEnvVarsSeen: Object.keys(process.env)
      .filter((k) => k.includes("BLOB"))
      .sort(),
    vercelEnv: process.env.VERCEL_ENV ?? null,
  };
}
