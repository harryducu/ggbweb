import type { GameNumber, League, Matchup, Player, PlayoffSeries, Team, Week } from "./types";

export const GAMES: GameNumber[] = [1, 2, 3];

/* ------------------------------------------------------------------ scores */

/**
 * A team's total for one game of one week: the sum of its bowlers' scores.
 * Falls back to the commissioner's manually entered team total when player
 * scores haven't been filled in.
 */
export function teamGameTotal(
  league: League,
  week: Week,
  teamId: string,
  game: GameNumber,
): number | null {
  const roster = league.players.filter((p) => p.teamId === teamId);
  const scores = week.playerScores.filter(
    (s) => s.game === game && s.score !== null && roster.some((p) => p.id === s.playerId),
  );
  if (scores.length > 0) {
    return scores.reduce((sum, s) => sum + (s.score ?? 0), 0);
  }
  const manual = week.matchups.find(
    (m) => m.game === game && (m.team1Id === teamId || m.team2Id === teamId),
  );
  if (!manual) return null;
  const value = manual.team1Id === teamId ? manual.team1Score : manual.team2Score;
  return value;
}

export interface ResolvedMatchup {
  matchup: Matchup;
  team1: Team | undefined;
  team2: Team | undefined;
  team1Score: number | null;
  team2Score: number | null;
  played: boolean;
  /** Team id of the winner, or null for a tie or an unplayed game. */
  winnerId: string | null;
  tie: boolean;
}

export function resolveMatchup(league: League, week: Week, matchup: Matchup): ResolvedMatchup {
  const team1Score =
    matchup.team1Score ?? teamGameTotal(league, week, matchup.team1Id, matchup.game);
  const team2Score =
    matchup.team2Score ?? teamGameTotal(league, week, matchup.team2Id, matchup.game);
  const played = team1Score !== null && team2Score !== null;
  const tie = played && team1Score === team2Score;
  return {
    matchup,
    team1: findTeam(league, matchup.team1Id),
    team2: findTeam(league, matchup.team2Id),
    team1Score,
    team2Score,
    played,
    tie,
    winnerId: !played || tie ? null : team1Score! > team2Score! ? matchup.team1Id : matchup.team2Id,
  };
}

export function resolveWeek(league: League, week: Week): ResolvedMatchup[] {
  return week.matchups.map((m) => resolveMatchup(league, week, m));
}

/* --------------------------------------------------------------- standings */

export interface Standing {
  rank: number;
  team: Team;
  wins: number;
  losses: number;
  ties: number;
  points: number;
  games: number;
  winPct: number;
  totalPins: number;
  /** Average team score per game bowled. */
  avgScore: number | null;
  /** Result of each game bowled this season, newest last: "W" | "L" | "T". */
  form: Array<"W" | "L" | "T">;
  /** True when any part of this row came from a manual override. */
  manual: boolean;
}

export function computeStandings(league: League): Standing[] {
  const base = new Map<string, Omit<Standing, "rank" | "winPct" | "avgScore">>();
  for (const team of league.teams) {
    base.set(team.id, {
      team,
      wins: 0,
      losses: 0,
      ties: 0,
      points: 0,
      games: 0,
      totalPins: 0,
      form: [],
      manual: false,
    });
  }

  const orderedWeeks = [...league.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  for (const week of orderedWeeks) {
    for (const r of resolveWeek(league, week)) {
      if (!r.played) continue;
      const a = base.get(r.matchup.team1Id);
      const b = base.get(r.matchup.team2Id);
      if (!a || !b) continue;

      a.games += 1;
      b.games += 1;
      a.totalPins += r.team1Score!;
      b.totalPins += r.team2Score!;

      if (r.tie) {
        a.ties += 1;
        b.ties += 1;
        a.points += league.settings.pointsPerTie;
        b.points += league.settings.pointsPerTie;
        a.form.push("T");
        b.form.push("T");
      } else if (r.winnerId === r.matchup.team1Id) {
        a.wins += 1;
        b.losses += 1;
        a.points += league.settings.pointsPerWin;
        a.form.push("W");
        b.form.push("L");
      } else {
        b.wins += 1;
        a.losses += 1;
        b.points += league.settings.pointsPerWin;
        b.form.push("W");
        a.form.push("L");
      }
    }
  }

  return (
    [...base.values()]
      .map((s) => {
        // A manually posted record wins over the derived one, so the site can
        // show real standings before every game score has been typed in.
        const m = s.team.manualRecord ?? { wins: null, losses: null, ties: null, totalPins: null };
        const wins = m.wins ?? s.wins;
        const losses = m.losses ?? s.losses;
        const ties = m.ties ?? s.ties;
        const totalPins = m.totalPins ?? s.totalPins;
        const games = wins + losses + ties;
        const manual =
          m.wins !== null || m.losses !== null || m.ties !== null || m.totalPins !== null;
        return {
          ...s,
          wins,
          losses,
          ties,
          totalPins,
          games,
          manual,
          points: wins * league.settings.pointsPerWin + ties * league.settings.pointsPerTie,
          winPct: games === 0 ? 0 : (wins + ties / 2) / games,
          avgScore: games === 0 ? null : totalPins / games,
        };
      })
      // Win percentage first, matching the commissioner's own standings sheet.
      // Points would rank a 3-3 team above a 2-1 team, which is wrong in a league
      // where byes leave teams on different game counts.
      .sort(
        (x, y) =>
          y.winPct - x.winPct ||
          y.wins - x.wins ||
          y.totalPins - x.totalPins ||
          x.team.name.localeCompare(y.team.name),
      )
      .map((s, i) => ({ ...s, rank: i + 1 }))
  );
}

export function standingFor(standings: Standing[], teamId: string): Standing | undefined {
  return standings.find((s) => s.team.id === teamId);
}

/* ----------------------------------------------------------- player stats */

export interface PlayerWeekLine {
  weekNumber: number;
  date: string | null;
  bye: boolean;
  scores: Array<number | null>;
  total: number | null;
  average: number | null;
  strikes: number | null;
}

export interface PlayerStats {
  player: Player;
  team: Team | undefined;
  games: number;
  totalScore: number;
  average: number | null;
  strikes: number;
  highGame: number | null;
  lowGame: number | null;
  byWeek: PlayerWeekLine[];
  /** Season rank by average among bowlers with at least one game. */
  averageRank: number | null;
  /** True when any part of this row came from a manual override. */
  manual: boolean;
}

export function computePlayerStats(league: League): PlayerStats[] {
  const orderedWeeks = [...league.weeks].sort((a, b) => a.weekNumber - b.weekNumber);

  const rows: PlayerStats[] = league.players.map((player) => {
    const byWeek: PlayerWeekLine[] = orderedWeeks.map((week) => {
      const bye = player.teamId !== null && week.byeTeamId === player.teamId;
      const scores = GAMES.map(
        (g) =>
          week.playerScores.find((s) => s.playerId === player.id && s.game === g)?.score ?? null,
      );
      const played = scores.filter((s): s is number => s !== null);
      const strikeVals = GAMES.map(
        (g) =>
          week.playerScores.find((s) => s.playerId === player.id && s.game === g)?.strikes ?? null,
      ).filter((s): s is number => s !== null);
      return {
        weekNumber: week.weekNumber,
        date: week.date,
        bye,
        scores,
        total: played.length ? played.reduce((a, b) => a + b, 0) : null,
        average: played.length ? played.reduce((a, b) => a + b, 0) / played.length : null,
        strikes: strikeVals.length ? strikeVals.reduce((a, b) => a + b, 0) : null,
      };
    });

    const allScores = byWeek.flatMap((w) => w.scores).filter((s): s is number => s !== null);
    const derivedTotal = allScores.reduce((a, b) => a + b, 0);
    const derivedStrikes = byWeek.reduce((sum, w) => sum + (w.strikes ?? 0), 0);

    const m = player.manualStats ?? { games: null, average: null, totalScore: null, strikes: null };
    const games = m.games ?? allScores.length;
    const totalScore = m.totalScore ?? derivedTotal;
    const strikes = m.strikes ?? derivedStrikes;
    const average =
      m.average ??
      (games > 0 ? totalScore / games : allScores.length ? derivedTotal / allScores.length : null);

    return {
      player,
      team: player.teamId ? findTeam(league, player.teamId) : undefined,
      games,
      totalScore,
      average,
      strikes,
      highGame:
        player.additionalStats?.highGame ?? (allScores.length ? Math.max(...allScores) : null),
      lowGame: allScores.length ? Math.min(...allScores) : null,
      byWeek,
      averageRank: null,
      manual: m.games !== null || m.average !== null || m.totalScore !== null || m.strikes !== null,
    };
  });

  const ranked = [...rows]
    .filter((r) => r.games > 0)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  ranked.forEach((r, i) => {
    r.averageRank = i + 1;
  });

  return rows;
}

export function topBowlers(stats: PlayerStats[], limit: number, by: "total" | "average" = "total") {
  return [...stats]
    .filter((s) => s.games > 0)
    .sort((a, b) =>
      by === "total" ? b.totalScore - a.totalScore : (b.average ?? 0) - (a.average ?? 0),
    )
    .slice(0, limit);
}

/* ----------------------------------------------------------------- lookups */

export function findTeam(league: League, teamId: string): Team | undefined {
  return league.teams.find((t) => t.id === teamId);
}

export function rosterFor(league: League, teamId: string): Player[] {
  return league.players.filter((p) => p.teamId === teamId);
}

export function weekByNumber(league: League, weekNumber: number): Week | undefined {
  return league.weeks.find((w) => w.weekNumber === weekNumber);
}

export type WeekState = "complete" | "unrecorded" | "current" | "upcoming";

export function weekState(league: League, week: Week): WeekState {
  if (week.weekNumber === league.settings.currentWeek) return "current";
  const past = week.completed || week.weekNumber < league.settings.currentWeek;
  if (!past) return "upcoming";
  // Bowled, but no game scores entered yet — don't claim a result we don't have.
  return resolveWeek(league, week).some((r) => r.played) ? "complete" : "unrecorded";
}

/**
 * The most recent week with at least one played game — what "Last Week" shows
 * on the home page, whether or not the commissioner flipped the completed flag.
 */
export function lastPlayedWeek(league: League): Week | undefined {
  return [...league.weeks]
    .sort((a, b) => b.weekNumber - a.weekNumber)
    .find((w) => resolveWeek(league, w).some((r) => r.played));
}

export function nextUnplayedWeek(league: League): Week | undefined {
  const ordered = [...league.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  return (
    ordered.find((w) => w.weekNumber === league.settings.currentWeek) ??
    ordered.find((w) => !resolveWeek(league, w).every((r) => r.played))
  );
}

/**
 * A night is nine separate games: each of the six playing teams faces three
 * different opponents, one game apiece. Grouping by game number mirrors the
 * "Match #" column in the commissioner's spreadsheet.
 */
export interface GameGroup {
  game: GameNumber;
  matchups: ResolvedMatchup[];
}

export function weekGames(league: League, week: Week): GameGroup[] {
  const resolved = resolveWeek(league, week);
  return GAMES.map((game) => ({
    game,
    matchups: resolved.filter((r) => r.matchup.game === game),
  })).filter((g) => g.matchups.length > 0);
}

/** How one team's night went: three games against three different opponents. */
export interface TeamNight {
  week: Week;
  team: Team | undefined;
  bye: boolean;
  games: Array<{
    game: GameNumber;
    opponent: Team | undefined;
    score: number | null;
    opponentScore: number | null;
    played: boolean;
    result: "W" | "L" | "T" | null;
  }>;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  pins: number;
  avg: number | null;
}

export function teamNight(league: League, week: Week, teamId: string): TeamNight {
  const games = resolveWeek(league, week)
    .filter((r) => r.matchup.team1Id === teamId || r.matchup.team2Id === teamId)
    .sort((a, b) => a.matchup.game - b.matchup.game)
    .map((r) => {
      const isTeam1 = r.matchup.team1Id === teamId;
      const score = isTeam1 ? r.team1Score : r.team2Score;
      const opponentScore = isTeam1 ? r.team2Score : r.team1Score;
      return {
        game: r.matchup.game,
        opponent: isTeam1 ? r.team2 : r.team1,
        score,
        opponentScore,
        played: r.played,
        result: !r.played
          ? null
          : r.tie
            ? ("T" as const)
            : r.winnerId === teamId
              ? ("W" as const)
              : ("L" as const),
      };
    });

  const played = games.filter((g) => g.played);
  const pins = played.reduce((n, g) => n + (g.score ?? 0), 0);

  return {
    week,
    team: findTeam(league, teamId),
    bye: week.byeTeamId === teamId,
    games,
    played: played.length,
    wins: played.filter((g) => g.result === "W").length,
    losses: played.filter((g) => g.result === "L").length,
    ties: played.filter((g) => g.result === "T").length,
    pins,
    avg: played.length ? pins / played.length : null,
  };
}

/** Every team's night, ordered best-to-worst — the "at a glance" strip. */
export function weekTeamSummaries(league: League, week: Week): TeamNight[] {
  return league.teams
    .map((t) => teamNight(league, week, t.id))
    .filter((n) => !n.bye)
    .sort((a, b) => b.wins - a.wins || b.pins - a.pins);
}

/* --------------------------------------------------------- power rankings */

export interface PowerRow {
  position: number;
  team: Team;
  standing: Standing | undefined;
  score: number | null;
  movement: number;
  description: string;
}

export function computePowerRankings(league: League): PowerRow[] {
  const standings = computeStandings(league);
  const ordered = [...league.teams].sort((a, b) => {
    const pa = a.powerRanking ?? Number.MAX_SAFE_INTEGER;
    const pb = b.powerRanking ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    // Teams without a manual position fall back to standings order.
    const sa = standingFor(standings, a.id)?.rank ?? 99;
    const sb = standingFor(standings, b.id)?.rank ?? 99;
    return sa - sb;
  });

  return ordered.map((team, i) => ({
    position: i + 1,
    team,
    standing: standingFor(standings, team.id),
    score: team.powerScore,
    movement: team.powerMovement,
    description: team.powerRankingDescription,
  }));
}

/* ---------------------------------------------------------------- playoffs */

export interface ResolvedSeries {
  series: PlayoffSeries;
  team1: Team | undefined;
  team2: Team | undefined;
  /** Text shown when a slot's team isn't known yet, e.g. "Winner of 4 vs 5". */
  team1Label: string;
  team2Label: string;
  winner: Team | undefined;
}

export function resolvePlayoffs(league: League): ResolvedSeries[] {
  const standings = computeStandings(league);
  const byId = new Map(league.playoffs.series.map((s) => [s.id, s]));

  const winnerOf = (id: string, depth = 0): Team | undefined => {
    if (depth > 8) return undefined;
    const s = byId.get(id);
    if (!s) return undefined;
    if (s.winnerId) return findTeam(league, s.winnerId);
    const t1 = resolveSlot(s.slot1, depth + 1);
    const t2 = resolveSlot(s.slot2, depth + 1);
    if (s.team1Score === null || s.team2Score === null || s.team1Score === s.team2Score) {
      return undefined;
    }
    return s.team1Score > s.team2Score ? t1 : t2;
  };

  const resolveSlot = (slot: string, depth = 0): Team | undefined => {
    if (slot.startsWith("seed:")) {
      const n = Number(slot.slice(5));
      return standings[n - 1]?.team;
    }
    if (slot.startsWith("series:")) return winnerOf(slot.slice(7), depth);
    if (slot.startsWith("team:")) return findTeam(league, slot.slice(5));
    return undefined;
  };

  const labelFor = (slot: string): string => {
    if (slot.startsWith("seed:")) return `${slot.slice(5)} Seed`;
    if (slot.startsWith("series:")) {
      const s = byId.get(slot.slice(7));
      return s ? `Winner of ${s.label}` : "TBD";
    }
    return "TBD";
  };

  return league.playoffs.series.map((series) => ({
    series,
    team1: resolveSlot(series.slot1),
    team2: resolveSlot(series.slot2),
    team1Label: labelFor(series.slot1),
    team2Label: labelFor(series.slot2),
    winner: winnerOf(series.id),
  }));
}

/* --------------------------------------------------------------- formatting */

export function fmtAvg(n: number | null | undefined, digits = 1): string {
  return n === null || n === undefined || Number.isNaN(n) ? "—" : n.toFixed(digits);
}

export function fmtInt(n: number | null | undefined): string {
  return n === null || n === undefined || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString();
}

export function fmtPct(n: number | null | undefined): string {
  return n === null || n === undefined || Number.isNaN(n) ? "—" : n.toFixed(3).replace(/^0/, "");
}

export function fmtRecord(s: Pick<Standing, "wins" | "losses" | "ties"> | undefined): string {
  if (!s) return "0–0";
  return s.ties > 0 ? `${s.wins}–${s.losses}–${s.ties}` : `${s.wins}–${s.losses}`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "Date TBD";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
