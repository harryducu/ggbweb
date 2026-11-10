import { cache } from "react";
import {
  ASSETS_VERSION,
  BUNDLED_TEAM_LOGOS,
  DATA_FIX_VERSION,
  SCHEDULE_VERSION,
  buildSeedLeague,
  scheduleForWeek,
} from "./seed";
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

/**
 * Gives teams their bundled crest. Only fills a team that has none, so an
 * uploaded logo is never replaced.
 */
function migrateTeamLogos(league: League): boolean {
  if (league.settings.assetsVersion === ASSETS_VERSION) return false;
  for (const team of league.teams) {
    if (!team.logo && BUNDLED_TEAM_LOGOS[team.id]) team.logo = BUNDLED_TEAM_LOGOS[team.id];
  }
  league.settings.assetsVersion = ASSETS_VERSION;
  return true;
}

/**
 * One-time corrections to the stored season, applied once and then marked
 * done. Each fix only touches a value that still holds what it is correcting,
 * so anything the commissioner already changed by hand is left alone.
 */
function migrateDataFixes(league: League): boolean {
  const version = league.settings.dataFixVersion ?? 0;
  if (version >= DATA_FIX_VERSION) return false;

  if (version < 1) {
    // The league broke after week 5 and came back on Nov 2, so weeks 6 and 7
    // were bowled three weeks later than the original Monday-by-Monday dates.
    const moved: Record<number, [string, string]> = {
      6: ["2026-10-19", "2026-11-02"],
      7: ["2026-10-26", "2026-11-09"],
    };
    for (const week of league.weeks) {
      const fix = moved[week.weekNumber];
      if (fix && week.date === fix[0]) week.date = fix[1];
    }

    // Sunday Guys and Osama Pin Laden finished level on win percentage and
    // bowled a tiebreaker for the last playoff spot. Sunday Guys won it.
    const ids = new Set(league.teams.map((t) => t.id));
    const hasTiebreaker = league.playoffs.series.some((s) => s.round === "tiebreaker");
    if (!hasTiebreaker && ids.has("sunday-guys") && ids.has("osama-pin-laden")) {
      league.playoffs.series.unshift({
        id: "tb-1",
        round: "tiebreaker",
        label: "Tiebreaker",
        slot1: "team:sunday-guys",
        slot2: "team:osama-pin-laden",
        team1Score: null,
        team2Score: null,
        winnerId: "sunday-guys",
        playerScores: [],
      });
    }

    league.settings.rules = league.settings.rules.replace(
      "Ties in the standings are broken by total pins.",
      "Ties in the standings are broken by a tiebreaker game when one is bowled, otherwise by total pins.",
    );
  }

  league.settings.dataFixVersion = DATA_FIX_VERSION;
  return true;
}

/**
 * Every pending upgrade for a stored league. A data fix rewrites real season
 * data, so the league exactly as it was is copied aside first; if the copy
 * can't be made, nothing is changed.
 */
async function migrate(league: League): Promise<boolean> {
  if ((league.settings.dataFixVersion ?? 0) < DATA_FIX_VERSION) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await storage().writeBackup(
      `before-fix-${DATA_FIX_VERSION}-${stamp}`,
      JSON.stringify(league, null, 2),
    );
  }
  return applyMigrations(league);
}

/** The upgrades themselves, in memory only. */
function applyMigrations(league: League): boolean {
  // All run; `||` would skip the later ones once an earlier one reported a change.
  const schedule = migrateSchedule(league);
  const logos = migrateTeamLogos(league);
  const fixes = migrateDataFixes(league);
  return schedule || logos || fixes;
}

function needsMigration(league: League): boolean {
  return (
    league.settings.scheduleVersion !== SCHEDULE_VERSION ||
    league.settings.assetsVersion !== ASSETS_VERSION ||
    (league.settings.dataFixVersion ?? 0) < DATA_FIX_VERSION
  );
}

async function loadStored(): Promise<League | null> {
  const raw = await storage().readDoc();
  return raw ? (JSON.parse(raw) as League) : null;
}

export async function readLeague(): Promise<League> {
  if (isBuildPhase()) {
    try {
      // Pages are prerendered from this, so show them upgraded — but only in
      // memory. The stored copy is backed up and rewritten on the first real
      // request or save, never during a build.
      const stored = await loadStored();
      if (!stored) return buildSeedLeague();
      applyMigrations(stored);
      return stored;
    } catch {
      return buildSeedLeague();
    }
  }

  const stored = await loadStored();
  if (stored) {
    // Migrating is a write, so it has to go through the same queue as any other
    // save — never by calling mutateLeague from here, which would re-enter this
    // function and deadlock on the write chain.
    if (needsMigration(stored)) {
      return enqueue(async () => {
        const fresh = (await loadStored()) ?? buildSeedLeague();
        if (await migrate(fresh)) {
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
    await migrate(league);
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

/**
 * readLeague, deduplicated within one page render. generateMetadata, the root
 * layout and the page each need the league, and without this every page view
 * reads the Blob store three times. Pages use this; server actions keep
 * calling readLeague so they always see their own writes.
 */
export const getLeague = cache(readLeague);
