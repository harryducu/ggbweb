import { SCHEDULE_VERSION, buildSeedLeague, scheduleForWeek } from "./seed";
import { storage } from "./storage";
import type { GameNumber, League } from "./types";

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

/**
 * A production build has no request to exchange for an OIDC identity, and must
 * never write anything anyway. Every route here is rendered on demand, so
 * prerendering only needs a shell — serve the seed and touch no storage.
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Brings a stored league onto the current fixture list.
 *
 * A week is only rewritten when nothing has been bowled in it — no player
 * scores and no team totals — so a season in progress can never lose a result.
 * Weeks already played keep what they have, and the league is marked migrated
 * either way so this runs once.
 */
function migrateSchedule(league: League): boolean {
  if (league.settings.scheduleVersion === SCHEDULE_VERSION) return false;

  const teamIds = new Set(league.teams.map((t) => t.id));

  for (const week of league.weeks) {
    const fixtures = scheduleForWeek(week.weekNumber);
    if (!fixtures) continue;

    const bowled =
      week.playerScores.some((s) => s.score !== null) ||
      week.matchups.some((m) => m.team1Score !== null || m.team2Score !== null);
    if (bowled) continue;

    // Only safe while every team named in the new fixtures still exists.
    if (
      !fixtures.games
        .flat()
        .flat()
        .every((id) => teamIds.has(id))
    )
      continue;

    week.byeTeamId = fixtures.bye;
    week.matchups = fixtures.games.flatMap((pairs, gi) =>
      pairs.map(([a, b], pi) => ({
        id: `w${week.weekNumber}g${gi + 1}m${pi + 1}`,
        game: (gi + 1) as GameNumber,
        team1Id: a,
        team2Id: b,
        team1Score: null,
        team2Score: null,
      })),
    );
  }

  league.settings.scheduleVersion = SCHEDULE_VERSION;
  return true;
}

async function loadStored(): Promise<League | null> {
  const raw = await storage().readDoc();
  return raw ? (JSON.parse(raw) as League) : null;
}

export async function readLeague(): Promise<League> {
  if (isBuildPhase()) {
    try {
      return (await loadStored()) ?? buildSeedLeague();
    } catch {
      return buildSeedLeague();
    }
  }

  const stored = await loadStored();
  if (stored) {
    // Migrating is a write, so it has to go through the same queue as any other
    // save — never by calling mutateLeague from here, which would re-enter this
    // function and deadlock on the write chain.
    if (stored.settings.scheduleVersion !== SCHEDULE_VERSION) {
      return enqueue(async () => {
        const fresh = (await loadStored()) ?? buildSeedLeague();
        if (migrateSchedule(fresh)) {
          await storage().writeDoc(JSON.stringify(fresh, null, 2));
        }
        return fresh;
      });
    }
    return stored;
  }

  if (!seeding) {
    seeding = (async () => {
      const existing = await loadStored();
      if (existing) return existing;
      const seed = buildSeedLeague();
      await storage().writeDoc(JSON.stringify(seed, null, 2));
      return seed;
    })().finally(() => {
      seeding = null;
    });
  }
  return seeding;
}

/** Runs work serially against the league document. */
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const next = writeChain.then(run, run);
  // Keep the chain alive even if the work throws.
  writeChain = next.catch(() => undefined);
  return next;
}

/** Read, transform, and persist the league in one serialized operation. */
export function mutateLeague<T>(fn: (league: League) => T | Promise<T>): Promise<T> {
  return enqueue(async () => {
    const league = (await loadStored()) ?? buildSeedLeague();
    migrateSchedule(league);
    const result = await fn(league);
    await storage().writeDoc(JSON.stringify(league, null, 2));
    return result;
  });
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
