"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertCommissioner, checkPassword, createSession, destroySession } from "./auth";
import { mutateLeague, readLeague, resetLeague } from "./store";
import { computeStandings } from "./stats";
import { storage, storageIsEphemeral, storageReport } from "./storage";
import { UploadError, deleteUpload, saveImage } from "./upload";
import type { GameNumber, League, Player, Team } from "./types";

export type ActionResult = { ok: boolean; message: string } | null;

/* ------------------------------------------------------------------ helpers */

function str(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

/** Empty input means "no value", which is different from zero. */
function num(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function int(fd: FormData, key: string, fallback: number): number {
  const n = num(fd, key);
  return n === null ? fallback : Math.round(n);
}

function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

function file(fd: FormData, key: string): File | null {
  const v = fd.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}

function slug(input: string, taken: string[]): string {
  const base =
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `item-${randomBytes(3).toString("hex")}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function abbrFrom(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words
    .map((w) => (/^\d/.test(w) ? w[0] : w[0]))
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

/** Every mutation ends the same way: fresh data on every page of the site. */
function refresh(): void {
  revalidatePath("/", "layout");
}

/**
 * Wraps an action so an expected failure (bad upload, missing field, expired
 * session) becomes a message on the form instead of an error screen.
 */
async function guard(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await assertCommissioner();
    const message = await fn();
    refresh();
    return { ok: true, message };
  } catch (error) {
    if (error instanceof UploadError) return { ok: false, message: error.message };
    const message = error instanceof Error ? error.message : "Something went wrong.";
    // A read-only filesystem means this is deployed somewhere that can't store
    // the league file. Say so, instead of surfacing a raw EROFS.
    if (/EROFS|read-only file system|ENOENT.*data\/league\.json/i.test(message)) {
      return {
        ok: false,
        message:
          "Nothing was saved: this deployment has no writable storage. Create a Vercel Blob store and redeploy — see the banner at the top of this page.",
      };
    }
    return { ok: false, message };
  }
}

/* --------------------------------------------------------------------- auth */

export async function signInAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const password = str(fd, "password");
  if (!password) return { ok: false, message: "Enter the commissioner password." };
  if (!checkPassword(password)) return { ok: false, message: "That password is not right." };
  await createSession();
  refresh();
  redirect("/commissioner");
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  refresh();
  redirect("/");
}

/* ------------------------------------------------------------------ players */

export async function addPlayerAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const name = str(fd, "name");
    if (!name) throw new Error("A bowler needs a name.");
    const teamId = str(fd, "teamId") || null;
    const photo = await saveImage(file(fd, "photo"), "players");

    await mutateLeague((league) => {
      const player: Player = {
        id: slug(
          name,
          league.players.map((p) => p.id),
        ),
        name,
        photo,
        teamId,
        nickname: null,
        additionalStats: Object.fromEntries(
          league.settings.playerStatFields.map((f) => [f.key, null]),
        ),
        manualStats: {
          throughWeek: null,
          games: null,
          average: null,
          totalScore: null,
          strikes: null,
        },
        active: true,
      };
      league.players.push(player);
    });

    return `${name} added.`;
  });
}

export async function updatePlayerAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = str(fd, "id");
    const name = str(fd, "name");
    if (!name) throw new Error("A bowler needs a name.");

    const newPhoto = await saveImage(file(fd, "photo"), "players");
    const removePhoto = bool(fd, "removePhoto");

    let oldPhoto: string | null = null;
    await mutateLeague((league) => {
      const player = league.players.find((p) => p.id === id);
      if (!player) throw new Error("That bowler no longer exists.");

      if (newPhoto || removePhoto) oldPhoto = player.photo;
      if (newPhoto) player.photo = newPhoto;
      else if (removePhoto) player.photo = null;

      player.name = name;
      player.nickname = str(fd, "nickname") || null;
      player.teamId = str(fd, "teamId") || null;
      player.active = bool(fd, "active");
    });

    if (oldPhoto && oldPhoto !== newPhoto) await deleteUpload(oldPhoto);
    return `${name} saved.`;
  });
}

export async function deletePlayerAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = str(fd, "id");
    let name = "Bowler";
    let photo: string | null = null;

    await mutateLeague((league) => {
      const player = league.players.find((p) => p.id === id);
      if (!player) throw new Error("That bowler no longer exists.");
      name = player.name;
      photo = player.photo;
      league.players = league.players.filter((p) => p.id !== id);
      // Their entered scores go with them, so totals stay consistent.
      for (const week of league.weeks) {
        week.playerScores = week.playerScores.filter((s) => s.playerId !== id);
      }
    });

    await deleteUpload(photo);
    return `${name} removed from the league.`;
  });
}

/* -------------------------------------------------------------------- teams */

export async function addTeamAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const name = str(fd, "name");
    if (!name) throw new Error("A team needs a name.");
    const logo = await saveImage(file(fd, "logo"), "teams");

    await mutateLeague((league) => {
      const team: Team = {
        id: slug(
          name,
          league.teams.map((t) => t.id),
        ),
        name,
        abbreviation: str(fd, "abbreviation") || abbrFrom(name),
        logo,
        color: str(fd, "color") || "#71717a",
        powerRanking: league.teams.length + 1,
        powerScore: null,
        powerRankingDescription: "",
        powerMovement: 0,
        sortOrder: league.teams.length,
        manualRecord: { throughWeek: null, wins: null, losses: null, ties: null, totalPins: null },
      };
      league.teams.push(team);
    });

    return `${name} added.`;
  });
}

export async function updateTeamAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = str(fd, "id");
    const name = str(fd, "name");
    if (!name) throw new Error("A team needs a name.");

    const newLogo = await saveImage(file(fd, "logo"), "teams");
    const removeLogo = bool(fd, "removeLogo");

    let oldLogo: string | null = null;
    await mutateLeague((league) => {
      const team = league.teams.find((t) => t.id === id);
      if (!team) throw new Error("That team no longer exists.");

      if (newLogo || removeLogo) oldLogo = team.logo;
      if (newLogo) team.logo = newLogo;
      else if (removeLogo) team.logo = null;

      team.name = name;
      team.abbreviation = str(fd, "abbreviation") || abbrFrom(name);
      team.color = str(fd, "color") || team.color;
      team.manualRecord = {
        // Keep the baseline week; only the posted numbers are editable here.
        throughWeek: team.manualRecord?.throughWeek ?? null,
        wins: num(fd, "manualWins"),
        losses: num(fd, "manualLosses"),
        ties: num(fd, "manualTies"),
        totalPins: num(fd, "manualPins"),
      };
    });

    if (oldLogo && oldLogo !== newLogo) await deleteUpload(oldLogo);
    return `${name} saved.`;
  });
}

export async function deleteTeamAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = str(fd, "id");
    let name = "Team";
    let logo: string | null = null;

    await mutateLeague((league) => {
      const team = league.teams.find((t) => t.id === id);
      if (!team) throw new Error("That team no longer exists.");
      name = team.name;
      logo = team.logo;

      league.teams = league.teams.filter((t) => t.id !== id);
      // Bowlers survive as free agents rather than being deleted with the team.
      for (const player of league.players) {
        if (player.teamId === id) player.teamId = null;
      }
      // Any scheduled game involving the team is no longer meaningful.
      for (const week of league.weeks) {
        week.matchups = week.matchups.filter((m) => m.team1Id !== id && m.team2Id !== id);
        if (week.byeTeamId === id) week.byeTeamId = null;
      }
      league.teams.forEach((t, i) => {
        t.sortOrder = i;
      });
      if (league.playoffs.championId === id) league.playoffs.championId = null;
    });

    await deleteUpload(logo);
    return `${name} deleted. Its bowlers are now free agents.`;
  });
}

export async function moveTeamAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = str(fd, "id");
    const dir = str(fd, "direction") === "up" ? -1 : 1;

    await mutateLeague((league) => {
      const ordered = [...league.teams].sort((a, b) => a.sortOrder - b.sortOrder);
      const i = ordered.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ordered.length) return;
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      ordered.forEach((t, k) => {
        t.sortOrder = k;
      });
    });

    return "Order updated.";
  });
}

/* ------------------------------------------------------------------- scores */

/**
 * Saves a whole week in one submit: every bowler's three game scores and strike
 * counts, plus optional manual team totals for games where the individual
 * scores aren't available. Standings and averages recompute from this.
 */
export async function saveWeekScoresAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const weekId = str(fd, "weekId");
    let count = 0;

    await mutateLeague((league) => {
      const week = league.weeks.find((w) => w.id === weekId);
      if (!week) throw new Error("That week no longer exists.");

      // The form only renders inputs for bowlers on the teams playing that
      // night, so it tells us which ones it covered. Anyone else — the bye
      // team's bowlers, free agents — keeps whatever scores they already had,
      // rather than being silently wiped by a save that never showed them.
      const covered = new Set(
        str(fd, "coveredPlayerIds")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
      const scoresThisForm = covered.size > 0;

      week.playerScores = scoresThisForm
        ? week.playerScores.filter((s) => !covered.has(s.playerId))
        : [];

      for (const player of league.players) {
        if (scoresThisForm && !covered.has(player.id)) continue;
        for (const game of [1, 2, 3] as GameNumber[]) {
          const score = num(fd, `s_${player.id}_${game}`);
          const strikes = num(fd, `x_${player.id}_${game}`);
          if (score === null && strikes === null) continue;
          week.playerScores.push({ playerId: player.id, game, score, strikes });
          if (score !== null) count++;
        }
      }

      for (const matchup of week.matchups) {
        matchup.team1Score = num(fd, `t1_${matchup.id}`);
        matchup.team2Score = num(fd, `t2_${matchup.id}`);
      }

      week.completed = bool(fd, "completed");
      week.notes = str(fd, "notes");
    });

    return `Week saved — ${count} game score${count === 1 ? "" : "s"} recorded.`;
  });
}

export async function clearWeekScoresAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const weekId = str(fd, "weekId");
    let label = "";

    await mutateLeague((league) => {
      const week = league.weeks.find((w) => w.id === weekId);
      if (!week) throw new Error("That week no longer exists.");
      label = `Week ${week.weekNumber}`;
      week.playerScores = [];
      week.completed = false;
      for (const m of week.matchups) {
        m.team1Score = null;
        m.team2Score = null;
      }
    });

    return `${label} scores cleared.`;
  });
}

export async function clearAllScoresAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    if (str(fd, "confirm") !== "CLEAR") {
      throw new Error("Type CLEAR in the confirmation box to wipe every score.");
    }

    await mutateLeague((league) => {
      for (const week of league.weeks) {
        week.playerScores = [];
        week.completed = false;
        week.notes = "";
        for (const m of week.matchups) {
          m.team1Score = null;
          m.team2Score = null;
        }
      }
      for (const player of league.players) {
        player.manualStats = {
          throughWeek: null,
          games: null,
          average: null,
          totalScore: null,
          strikes: null,
        };
        player.additionalStats = Object.fromEntries(
          league.settings.playerStatFields.map((f) => [f.key, null]),
        );
      }
      for (const team of league.teams) {
        team.manualRecord = {
          throughWeek: null,
          wins: null,
          losses: null,
          ties: null,
          totalPins: null,
        };
        team.powerScore = null;
        team.powerMovement = 0;
      }
    });

    return "Every score and stat cleared. The schedule and rosters are untouched.";
  });
}

/* ----------------------------------------------------------------- schedule */

export async function addWeekAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    let weekNumber = 0;
    await mutateLeague((league) => {
      weekNumber = Math.max(0, ...league.weeks.map((w) => w.weekNumber)) + 1;
      league.weeks.push({
        id: `week-${weekNumber}-${randomBytes(2).toString("hex")}`,
        weekNumber,
        date: str(fd, "date") || null,
        byeTeamId: str(fd, "byeTeamId") || null,
        completed: false,
        matchups: [],
        playerScores: [],
        notes: "",
      });
    });
    return `Week ${weekNumber} added. Add its matchups next.`;
  });
}

export async function updateWeekAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = str(fd, "id");
    await mutateLeague((league) => {
      const week = league.weeks.find((w) => w.id === id);
      if (!week) throw new Error("That week no longer exists.");
      week.weekNumber = int(fd, "weekNumber", week.weekNumber);
      week.date = str(fd, "date") || null;
      week.byeTeamId = str(fd, "byeTeamId") || null;
      week.completed = bool(fd, "completed");
      week.notes = str(fd, "notes");
      league.weeks.sort((a, b) => a.weekNumber - b.weekNumber);
    });
    return "Week updated.";
  });
}

export async function deleteWeekAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = str(fd, "id");
    let label = "";
    await mutateLeague((league) => {
      const week = league.weeks.find((w) => w.id === id);
      if (!week) throw new Error("That week no longer exists.");
      label = `Week ${week.weekNumber}`;
      league.weeks = league.weeks.filter((w) => w.id !== id);
    });
    return `${label} deleted.`;
  });
}

export async function saveMatchupAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const weekId = str(fd, "weekId");
    const matchupId = str(fd, "matchupId");
    const team1Id = str(fd, "team1Id");
    const team2Id = str(fd, "team2Id");
    const game = Math.min(3, Math.max(1, int(fd, "game", 1))) as GameNumber;

    if (!team1Id || !team2Id) throw new Error("Pick both teams.");
    if (team1Id === team2Id) throw new Error("A team can't bowl against itself.");

    await mutateLeague((league) => {
      const week = league.weeks.find((w) => w.id === weekId);
      if (!week) throw new Error("That week no longer exists.");

      if (matchupId) {
        const m = week.matchups.find((x) => x.id === matchupId);
        if (!m) throw new Error("That matchup no longer exists.");
        m.game = game;
        m.team1Id = team1Id;
        m.team2Id = team2Id;
      } else {
        week.matchups.push({
          id: `m-${randomBytes(4).toString("hex")}`,
          game,
          team1Id,
          team2Id,
          team1Score: null,
          team2Score: null,
        });
      }
      week.matchups.sort((a, b) => a.game - b.game);
    });

    return matchupId ? "Matchup updated." : "Matchup added.";
  });
}

export async function deleteMatchupAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const weekId = str(fd, "weekId");
    const matchupId = str(fd, "matchupId");
    await mutateLeague((league) => {
      const week = league.weeks.find((w) => w.id === weekId);
      if (!week) throw new Error("That week no longer exists.");
      week.matchups = week.matchups.filter((m) => m.id !== matchupId);
    });
    return "Matchup removed.";
  });
}

/* ----------------------------------------------------------- power rankings */

export async function savePowerRankingsAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    // The order field is a comma-separated list of team ids, written by the
    // drag-and-drop / move-up-down control on the client.
    const order = str(fd, "order")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await mutateLeague((league) => {
      for (const team of league.teams) {
        const position = order.indexOf(team.id);
        if (position >= 0) team.powerRanking = position + 1;
        team.powerScore = num(fd, `score_${team.id}`);
        team.powerMovement = int(fd, `movement_${team.id}`, 0);
        team.powerRankingDescription = str(fd, `note_${team.id}`);
      }
    });

    return "Power rankings published.";
  });
}

/**
 * Rebuilds the ranking from the standings and computes each team's movement
 * against the positions currently published.
 */
export async function autoPowerRankingsAction(
  _prev: ActionResult,
  _fd: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const league = await readLeague();
    const standings = computeStandings(league);
    const previous = new Map(league.teams.map((t) => [t.id, t.powerRanking]));

    await mutateLeague((draft) => {
      standings.forEach((s, i) => {
        const team = draft.teams.find((t) => t.id === s.team.id);
        if (!team) return;
        const before = previous.get(team.id);
        team.powerRanking = i + 1;
        team.powerMovement = before ? before - (i + 1) : 0;
      });
    });

    return "Rankings rebuilt from the standings. Movement calculated against the previous order.";
  });
}

/* -------------------------------------------------------------------- stats */

export async function savePlayerStatsAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    let touched = 0;

    await mutateLeague((league) => {
      for (const player of league.players) {
        const before = JSON.stringify([player.manualStats, player.additionalStats]);

        player.manualStats = {
          throughWeek: player.manualStats?.throughWeek ?? null,
          games: num(fd, `games_${player.id}`),
          average: num(fd, `average_${player.id}`),
          totalScore: num(fd, `total_${player.id}`),
          strikes: num(fd, `strikes_${player.id}`),
        };
        player.additionalStats = Object.fromEntries(
          league.settings.playerStatFields.map((f) => [f.key, num(fd, `x_${f.key}_${player.id}`)]),
        );

        if (JSON.stringify([player.manualStats, player.additionalStats]) !== before) touched++;
      }
    });

    return `Stats saved — ${touched} bowler${touched === 1 ? "" : "s"} changed.`;
  });
}

export async function addStatFieldAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const label = str(fd, "label");
    if (!label) throw new Error("Give the category a name.");

    await mutateLeague((league) => {
      const key = slug(
        label,
        league.settings.playerStatFields.map((f) => f.key),
      ).replace(/-/g, "_");
      league.settings.playerStatFields.push({
        key,
        label,
        lowerIsBetter: bool(fd, "lowerIsBetter"),
        showOnStatsPage: bool(fd, "showOnStatsPage"),
      });
      for (const player of league.players) {
        player.additionalStats[key] = null;
      }
    });

    return `"${label}" added. It now appears on the Stats page and every player profile.`;
  });
}

export async function removeStatFieldAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const key = str(fd, "key");
    let label = key;

    await mutateLeague((league) => {
      label = league.settings.playerStatFields.find((f) => f.key === key)?.label ?? key;
      league.settings.playerStatFields = league.settings.playerStatFields.filter(
        (f) => f.key !== key,
      );
      for (const player of league.players) {
        delete player.additionalStats[key];
      }
    });

    return `"${label}" removed.`;
  });
}

/* ----------------------------------------------------------------- playoffs */

export async function savePlayoffsAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    await mutateLeague((league) => {
      league.playoffs.enabled = bool(fd, "enabled");
      league.playoffs.qualifiers = Math.max(
        2,
        Math.min(league.teams.length, int(fd, "qualifiers", league.playoffs.qualifiers)),
      );
      for (const series of league.playoffs.series) {
        series.team1Score = num(fd, `s1_${series.id}`);
        series.team2Score = num(fd, `s2_${series.id}`);
        series.winnerId = str(fd, `w_${series.id}`) || null;
      }
      league.playoffs.championId = str(fd, "championId") || null;
    });
    return "Bracket saved.";
  });
}

/* ----------------------------------------------------------------- settings */

export async function saveSettingsAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const newLogo = await saveImage(file(fd, "logo"), "league");
    const removeLogo = bool(fd, "removeLogo");

    let oldLogo: string | null = null;
    await mutateLeague((league) => {
      const s = league.settings;
      if (newLogo || removeLogo) oldLogo = s.logo;
      if (newLogo) s.logo = newLogo;
      else if (removeLogo) s.logo = null;

      s.name = str(fd, "name") || s.name;
      s.tagline = str(fd, "tagline");
      s.season = str(fd, "season");
      s.currentWeek = Math.max(1, int(fd, "currentWeek", s.currentWeek));
      s.description = str(fd, "description");
      s.rules = str(fd, "rules");
      s.pointsPerWin = int(fd, "pointsPerWin", s.pointsPerWin);
      s.pointsPerTie = int(fd, "pointsPerTie", s.pointsPerTie);
      s.gamesPerNight = Math.max(1, int(fd, "gamesPerNight", s.gamesPerNight));
      s.playersPerTeam = Math.max(1, int(fd, "playersPerTeam", s.playersPerTeam));
    });

    // The bundled brand logo isn't an upload and must survive a logo change.
    if (oldLogo && oldLogo !== newLogo) await deleteUpload(oldLogo);
    return "League settings saved.";
  });
}

export async function resetLeagueAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    if (str(fd, "confirm") !== "RESET") {
      throw new Error("Type RESET in the confirmation box to start over.");
    }
    await resetLeague();
    return "League reset to the original teams, schedule and placeholder rosters.";
  });
}

/* ------------------------------------------------------- read-only for admin */

/**
 * Proves whether this deployment can actually persist a change, by writing a
 * throwaway value into the league document and reading it back. Beats reading
 * environment variables and hoping.
 */
export async function testStorageAction(_prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  try {
    await assertCommissioner();
    const report = storageReport();
    const stamp = `probe-${Date.now()}`;

    const previous = (await readLeague()).settings.description;
    await mutateLeague((l) => {
      l.settings.description = stamp;
    });
    const readBack = (await readLeague()).settings.description;
    await mutateLeague((l) => {
      l.settings.description = previous;
    });

    if (readBack !== stamp) {
      return {
        ok: false,
        message: `Wrote a test value but read back something else. Driver: ${report.driver}.`,
      };
    }

    refresh();
    return {
      ok: true,
      message:
        report.driver === "vercel-blob"
          ? `Storage is working. Saving to Vercel Blob via ${report.tokenVariable}.`
          : `Storage is working, using the ${report.driver}. On Vercel this will not persist.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const report = storageReport();
    return {
      ok: false,
      message:
        `Write failed (driver: ${report.driver}). ` +
        `BLOB env vars visible: ${report.blobEnvVarsSeen.length ? report.blobEnvVarsSeen.join(", ") : "none"}. ` +
        `Error: ${message}`,
    };
  }
}

export async function storageWarning(): Promise<boolean> {
  return storageIsEphemeral();
}

export async function getLeagueForAdmin(): Promise<League> {
  await assertCommissioner();
  return readLeague();
}
