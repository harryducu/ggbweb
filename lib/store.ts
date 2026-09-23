import { buildSeedLeague } from "./seed";
import { storage } from "./storage";
import type { League } from "./types";

/**
 * Serializes writes so two commissioner saves landing at the same moment can't
 * interleave and lose each other. This is per-process, which is enough for a
 * league with a single admin; it is not a distributed lock.
 */
let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Guards the very first read. Without this, several requests arriving before
 * anything is stored would each decide the league is missing and each write
 * their own seed, racing one another.
 */
let seeding: Promise<League> | null = null;

export async function readLeague(): Promise<League> {
  let raw: string | null;
  try {
    raw = await storage().readDoc();
  } catch (error) {
    // A production build has no request to exchange for an OIDC identity, so a
    // Blob read can fail there even though it works at runtime. Every route is
    // rendered on demand anyway, so prerendering only needs a shell — fall back
    // to the seed rather than failing the build.
    if (process.env.NEXT_PHASE === "phase-production-build") return buildSeedLeague();
    throw error;
  }
  if (raw) return JSON.parse(raw) as League;

  if (!seeding) {
    seeding = (async () => {
      // Re-check inside the guard: another caller may have seeded already.
      const existing = await storage().readDoc();
      if (existing) return JSON.parse(existing) as League;
      const seed = buildSeedLeague();
      await storage().writeDoc(JSON.stringify(seed, null, 2));
      return seed;
    })().finally(() => {
      seeding = null;
    });
  }
  return seeding;
}

/** Read, transform, and persist the league in one serialized operation. */
export function mutateLeague<T>(fn: (league: League) => T | Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const league = await readLeague();
    const result = await fn(league);
    await storage().writeDoc(JSON.stringify(league, null, 2));
    return result;
  };
  const next = writeChain.then(run, run);
  // Keep the chain alive even if a mutation throws.
  writeChain = next.catch(() => undefined);
  return next;
}

export async function resetLeague(): Promise<void> {
  await mutateLeague((league) => {
    const fresh = buildSeedLeague();
    league.settings = fresh.settings;
    league.teams = fresh.teams;
    league.players = fresh.players;
    league.weeks = fresh.weeks;
    league.playoffs = fresh.playoffs;
  });
}
