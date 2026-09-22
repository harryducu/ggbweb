import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gg_commish";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): string {
  return process.env.SESSION_SECRET || "dev-only-insecure-secret";
}

function password(): string {
  return process.env.COMMISSIONER_PASSWORD || "strike300";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(candidate: string): boolean {
  return safeEqual(candidate, password());
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
