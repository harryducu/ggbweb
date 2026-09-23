import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gg_commish";
const MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * No fallbacks, deliberately. A default password or signing key baked into the
 * source is readable by anyone with the repository, so a missing variable locks
 * the panel rather than leaving it open with a known credential.
 */
function secret(): string | null {
  return process.env.SESSION_SECRET || null;
}

function password(): string | null {
  return process.env.COMMISSIONER_PASSWORD || null;
}

/** Whether the deployment is configured well enough to allow a sign-in. */
export function authConfigured(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!password()) missing.push("COMMISSIONER_PASSWORD");
  if (!secret()) missing.push("SESSION_SECRET");
  return { ok: missing.length === 0, missing };
}

function sign(payload: string): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not set.");
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(candidate: string): boolean {
  const expected = password();
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

/** Cookie value is `expiresAt.signature`, so it can't be forged or replayed past expiry. */
export async function createSession(): Promise<void> {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const value = `${expiresAt}.${sign(String(expiresAt))}`;
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isCommissioner(): Promise<boolean> {
  if (!authConfigured().ok) return false;
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const [expiresAt, signature] = raw.split(".");
  if (!expiresAt || !signature) return false;
  if (!safeEqual(signature, sign(expiresAt))) return false;
  return Number(expiresAt) > Date.now();
}

/** Guard for every server action that writes league data. */
export async function assertCommissioner(): Promise<void> {
  if (!(await isCommissioner())) {
    throw new Error("Not authorized. Sign in to the Commissioner panel.");
  }
}
