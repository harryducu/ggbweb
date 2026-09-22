import { promises as fs } from "node:fs";
import path from "node:path";
import { buildSeedLeague } from "./seed";
import type { League } from "./types";

/**
 * Where the league file lives. Override with LEAGUE_DATA_DIR to point at a
 * mounted volume in production, or at a throwaway directory for testing.
 */
const DATA_DIR = process.env.LEAGUE_DATA_DIR
  ? path.resolve(process.env.LEAGUE_DATA_DIR)
  : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "league.json");

/**
 * Serializes writes so two commissioner saves landing at the same moment can't
 * interleave and lose each other. One process, one chain — enough for a league
 * with a single admin.
 */
let writeChain: Promise<unknown> = Promise.resolve();

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(buildSeedLeague(), null, 2), "utf8");
  }
}

export async function readLeague(): Promise<League> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw) as League;
}

async function writeLeague(league: League): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Write to a temp file then rename, so a crash mid-write can't truncate the
  // league's only copy of its season.
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(league, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

/** Read, transform, and persist the league in one serialized operation. */
export function mutateLeague<T>(fn: (league: League) => T | Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const league = await readLeague();
    const result = await fn(league);
    await writeLeague(league);
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
