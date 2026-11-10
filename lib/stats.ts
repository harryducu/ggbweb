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
  const tiebreakers = tiebreakerResults(league);
  /** -1 when x won a tiebreaker game against y, 1 when y did, 0 if none. */
  const headToHead = (x: string, y: string): number => {
    const game = tiebreakers.find(
      (t) => t.winnerId && [t.team1Id, t.team2Id].includes(x) && [t.team1Id, t.team2Id].includes(y),
    );
    if (!game) return 0;
    return game.winnerId === x ? -1 : game.winnerId === y ? 1 : 0;
  };

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

  // Results from weeks after each team's baseline week, added on top of a
  // posted record rather than replacing it.
  const afterWeek = new Map<string, { wins: number; losses: number; ties: number; pins: number }>();
  for (const team of league.teams) {
    const through = team.manualRecord?.throughWeek;
    if (through == null) continue;
    const acc = { wins: 0, losses: 0, ties: 0, pins: 0 };
    for (const week of orderedWeeks) {
      if (week.weekNumber <= through) continue;
      for (const r of resolveWeek(league, week)) {
        if (!r.played) continue;
        const isTeam1 = r.matchup.team1Id === team.id;
        const isTeam2 = r.matchup.team2Id === team.id;
        if (!isTeam1 && !isTeam2) continue;
        acc.pins += (isTeam1 ? r.team1Score : r.team2Score) ?? 0;
        if (r.tie) acc.ties += 1;
        else if (r.winnerId === team.id) acc.wins += 1;
        else acc.losses += 1;
      }
    }
    afterWeek.set(team.id, acc);
  }

  return (
    [...base.values()]
      .map((s) => {
        // A manually posted record wins over the derived one, so the site can
        // show real standings before every game score has been typed in.
        const m = s.team.manualRecord;
        const after = m?.throughWeek == null ? null : afterWeek.get(s.team.id);
        const wins = m?.wins == null ? s.wins : m.wins + (after?.wins ?? 0);
        const losses = m?.losses == null ? s.losses : m.losses + (after?.losses ?? 0);
        const ties = m?.ties == null ? s.ties : m.ties + (after?.ties ?? 0);
        const totalPins = m?.totalPins == null ? s.totalPins : m.totalPins + (after?.pins ?? 0);
        const games = wins + losses + ties;
        const manual = Boolean(
          m && (m.wins !== null || m.losses !== null || m.ties !== null || m.totalPins !== null),
        );
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
      // Level teams are separated by a tiebreaker game when one was bowled,
      // before falling back to pins.
      .sort(
        (x, y) =>
          y.winPct - x.winPct ||
          headToHead(x.team.id, y.team.id) ||
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

    // With a baseline week set, only games from later weeks are added on top of
    // the posted totals; without one, posted totals are a flat override.
    const m = player.manualStats;
    const through = m?.throughWeek ?? null;
    const later = through === null ? [] : byWeek.filter((w) => w.weekNumber > through);
    const laterScores = later.flatMap((w) => w.scores).filter((v): v is number => v !== null);
    const laterTotal = laterScores.reduce((a, b) => a + b, 0);
    const laterStrikes = later.reduce((n, w) => n + (w.strikes ?? 0), 0);

    const games = m?.games == null ? allScores.length : m.games + laterScores.length;
    const totalScore = m?.totalScore == null ? derivedTotal : m.totalScore + laterTotal;
    const strikes = m?.strikes == null ? derivedStrikes : m.strikes + laterStrikes;
    // A posted average is only honoured as a flat override; with a baseline
    // week it must be recomputed so later games actually move it.
    const average =
      m?.average != null && through === null ? m.average : games > 0 ? totalScore / games : null;

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
      manual: Boolean(
        m &&
        (m.games !== null || m.average !== null || m.totalScore !== null || m.strikes !== null),
      ),
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
    /** Matchup id — the box score for this game lives at /games/<id>. */
    id: string;
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
        id: r.matchup.id,
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

/* --------------------------------------------------------------- box score */

/** One bowler's line in a single game, with the rest of their night alongside. */
export interface BoxScoreLine {
  player: Player;
  /** Score in this game. Null when it was never entered. */
  score: number | null;
  strikes: number | null;
  /** All three of the player's games that night, in game order. */
  night: Array<number | null>;
  nightTotal: number | null;
}

export interface BoxScoreSide {
  team: Team | undefined;
  score: number | null;
  /** True when the total came from bowler scores rather than a typed-in team total. */
  fromPlayers: boolean;
  lines: BoxScoreLine[];
  result: "W" | "L" | "T" | null;
}

export interface BoxScore {
  week: Week;
  matchup: Matchup;
  resolved: ResolvedMatchup;
  side1: BoxScoreSide;
  side2: BoxScoreSide;
  /** Highest single score in the game, across both rosters. */
  highScore: number | null;
}

/**
 * Matchup ids are unique across the season, so a game can be addressed on its
 * own without the week in the URL. The week comes back with it because every
 * score lives on the week, not the matchup.
 */
export function findGame(
  league: League,
  matchupId: string,
): { week: Week; matchup: Matchup } | undefined {
  for (const week of [...league.weeks].sort((a, b) => a.weekNumber - b.weekNumber)) {
    const matchup = week.matchups.find((m) => m.id === matchupId);
    if (matchup) return { week, matchup };
  }
  return undefined;
}

/**
 * Everything one game needs to be shown on its own page: who bowled, what they
 * shot in that game, and how the rest of their night went.
 */
export function boxScore(league: League, week: Week, matchup: Matchup): BoxScore {
  const resolved = resolveMatchup(league, week, matchup);

  const buildSide = (teamId: string, score: number | null): BoxScoreSide => {
    const lines: BoxScoreLine[] = rosterFor(league, teamId)
      .map((player) => {
        const entry = (g: GameNumber) =>
          week.playerScores.find((s) => s.playerId === player.id && s.game === g);
        const night = GAMES.map((g) => entry(g)?.score ?? null);
        const bowled = night.filter((v): v is number => v !== null);
        return {
          player,
          score: entry(matchup.game)?.score ?? null,
          strikes: entry(matchup.game)?.strikes ?? null,
          night,
          nightTotal: bowled.length ? bowled.reduce((a, b) => a + b, 0) : null,
        };
      })
      // Best game first: a box score is read top-down for who carried the team.
      .sort(
        (a, b) => (b.score ?? -1) - (a.score ?? -1) || a.player.name.localeCompare(b.player.name),
      );

    return {
      team: findTeam(league, teamId),
      score,
      fromPlayers: lines.some((l) => l.score !== null),
      lines,
      result: !resolved.played
        ? null
        : resolved.tie
          ? "T"
          : resolved.winnerId === teamId
            ? "W"
            : "L",
    };
  };

  const side1 = buildSide(matchup.team1Id, resolved.team1Score);
  const side2 = buildSide(matchup.team2Id, resolved.team2Score);
  const all = [...side1.lines, ...side2.lines]
    .map((l) => l.score)
    .filter((s): s is number => s !== null);

  return {
    week,
    matchup,
    resolved,
    side1,
    side2,
    highScore: all.length ? Math.max(...all) : null,
  };
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

export const PLAYOFF_ROUND_LABEL: Record<PlayoffSeries["round"], string> = {
  tiebreaker: "Tiebreaker",
  playin: "Play-in round",
  semifinal: "Semifinals",
  final: "Championship",
};

/** Games in a series; the round decides when the commissioner hasn't. */
export function bestOfFor(series: PlayoffSeries): number {
  if (series.bestOf && series.bestOf > 0) return series.bestOf;
  return series.round === "tiebreaker" ? 1 : series.round === "playin" ? 3 : 5;
}

/** Wins needed to take a series: 2 of 3, 3 of 5. */
export function winsNeeded(series: PlayoffSeries): number {
  return Math.floor(bestOfFor(series) / 2) + 1;
}

/** A team's pins in one game of a playoff series, from its bowlers. */
function seriesGamePins(
  league: League,
  series: PlayoffSeries,
  teamId: string | undefined,
  game: number,
): number | null {
  if (!teamId) return null;
  const roster = new Set(rosterFor(league, teamId).map((p) => p.id));
  const scores = (series.playerScores ?? []).filter(
    (s) => s.game === game && s.score !== null && roster.has(s.playerId),
  );
  return scores.length ? scores.reduce((n, s) => n + (s.score ?? 0), 0) : null;
}

export interface SeriesGame {
  game: number;
  team1: number | null;
  team2: number | null;
  /** 1 or 2 for the side that won the game; null if unplayed or tied. */
  winner: 1 | 2 | null;
}

/** Game-by-game team totals for a series, from the bowler scores. */
export function seriesGames(
  league: League,
  series: PlayoffSeries,
  team1: Team | undefined,
  team2: Team | undefined,
): SeriesGame[] {
  return Array.from({ length: bestOfFor(series) }, (_, i) => {
    const game = i + 1;
    const a = seriesGamePins(league, series, team1?.id, game);
    const b = seriesGamePins(league, series, team2?.id, game);
    return {
      game,
      team1: a,
      team2: b,
      winner: a === null || b === null || a === b ? null : a > b ? 1 : 2,
    };
  });
}

/**
 * What the bracket shows for one side: games won in a best-of series, pins in
 * a one-game series. A typed-in score wins over the bowlers' numbers.
 */
function seriesScore(
  league: League,
  series: PlayoffSeries,
  side: 1 | 2,
  team1: Team | undefined,
  team2: Team | undefined,
): number | null {
  const manual = side === 1 ? series.team1Score : series.team2Score;
  if (manual !== null) return manual;
  const games = seriesGames(league, series, team1, team2);
  if (bestOfFor(series) === 1) return side === 1 ? games[0].team1 : games[0].team2;
  if (!games.some((g) => g.winner !== null)) return null;
  return games.filter((g) => g.winner === side).length;
}

function decide(
  series: PlayoffSeries,
  t1: Team | undefined,
  t2: Team | undefined,
  s1: number | null,
  s2: number | null,
): string | null {
  if (series.winnerId) return series.winnerId;
  if (s1 === null || s2 === null) return null;
  if (bestOfFor(series) === 1) {
    if (s1 === s2) return null;
    return (s1 > s2 ? t1 : t2)?.id ?? null;
  }
  // A best-of series is only decided once someone reaches the majority.
  const need = winsNeeded(series);
  if (s1 >= need && s1 > s2) return t1?.id ?? null;
  if (s2 >= need && s2 > s1) return t2?.id ?? null;
  return null;
}

export interface TiebreakerResult {
  series: PlayoffSeries;
  team1Id: string | null;
  team2Id: string | null;
  team1Score: number | null;
  team2Score: number | null;
  winnerId: string | null;
}

/**
 * Tiebreaker games name their teams directly, so they resolve without the
 * standings — which matters, because the standings are what they feed.
 */
export function tiebreakerResults(league: League): TiebreakerResult[] {
  const direct = (slot: string) => (slot.startsWith("team:") ? slot.slice(5) : null);
  return league.playoffs.series
    .filter((s) => s.round === "tiebreaker")
    .map((series) => {
      const team1Id = direct(series.slot1);
      const team2Id = direct(series.slot2);
      const t1 = team1Id ? findTeam(league, team1Id) : undefined;
      const t2 = team2Id ? findTeam(league, team2Id) : undefined;
      const team1Score = seriesScore(league, series, 1, t1, t2);
      const team2Score = seriesScore(league, series, 2, t1, t2);
      return {
        series,
        team1Id,
        team2Id,
        team1Score,
        team2Score,
        winnerId: decide(series, t1, t2, team1Score, team2Score),
      };
    });
}

export interface ResolvedSeries {
  series: PlayoffSeries;
  team1: Team | undefined;
  team2: Team | undefined;
  /** Text shown when a slot's team isn't known yet, e.g. "Winner of 4 vs 5". */
  team1Label: string;
  team2Label: string;
  /** Games won (best-of) or pins (one game); typed in or from the bowlers. */
  team1Score: number | null;
  team2Score: number | null;
  bestOf: number;
  games: SeriesGame[];
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
    const winnerId = decide(
      s,
      t1,
      t2,
      seriesScore(league, s, 1, t1, t2),
      seriesScore(league, s, 2, t1, t2),
    );
    return winnerId ? findTeam(league, winnerId) : undefined;
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

  return league.playoffs.series.map((series) => {
    const team1 = resolveSlot(series.slot1);
    const team2 = resolveSlot(series.slot2);
    return {
      series,
      team1,
      team2,
      team1Label: labelFor(series.slot1),
      team2Label: labelFor(series.slot2),
      team1Score: seriesScore(league, series, 1, team1, team2),
      team2Score: seriesScore(league, series, 2, team1, team2),
      bestOf: bestOfFor(series),
      games: seriesGames(league, series, team1, team2),
      winner: winnerOf(series.id),
    };
  });
}

/**
 * True once the current-week setting is past the last scheduled week and the
 * bracket is switched on — the site then leads with the playoffs.
 */
export function isPostseason(league: League): boolean {
  const last = Math.max(0, ...league.weeks.map((w) => w.weekNumber));
  return league.playoffs.enabled && last > 0 && league.settings.currentWeek > last;
}

/** The round being bowled now: the first with a series still undecided. */
export function currentPlayoffRound(
  resolved: ResolvedSeries[],
): Exclude<PlayoffSeries["round"], "tiebreaker"> | null {
  for (const round of ["playin", "semifinal", "final"] as const) {
    const series = resolved.filter((r) => r.series.round === round);
    if (series.some((r) => !r.winner)) return round;
  }
  return null;
}

/* ------------------------------------------------------- postseason stats */

export interface PostseasonLine {
  series: PlayoffSeries;
  opponent: Team | undefined;
  scores: Array<number | null>;
  total: number | null;
  strikes: number | null;
}

/**
 * A bowler's playoff and tiebreaker games. Deliberately separate from
 * computePlayerStats: none of this touches the season average or totals.
 */
export interface PostseasonStats {
  player: Player;
  team: Team | undefined;
  games: number;
  totalScore: number;
  average: number | null;
  strikes: number;
  highGame: number | null;
  lines: PostseasonLine[];
}

export function computePostseasonStats(league: League): PostseasonStats[] {
  const resolved = resolvePlayoffs(league);
  const order: PlayoffSeries["round"][] = ["tiebreaker", "playin", "semifinal", "final"];
  const ordered = [...resolved].sort(
    (a, b) => order.indexOf(a.series.round) - order.indexOf(b.series.round),
  );

  return league.players
    .map((player) => {
      const lines: PostseasonLine[] = [];
      for (const r of ordered) {
        const entries = (r.series.playerScores ?? []).filter((s) => s.playerId === player.id);
        const scores = Array.from(
          { length: r.bestOf },
          (_, i) => entries.find((s) => s.game === i + 1)?.score ?? null,
        );
        const bowled = scores.filter((v): v is number => v !== null);
        if (bowled.length === 0) continue;
        const strikes = entries.map((s) => s.strikes).filter((v): v is number => v !== null);
        const onTeam1 = player.teamId !== null && r.team1?.id === player.teamId;
        lines.push({
          series: r.series,
          opponent: onTeam1 ? r.team2 : r.team1,
          scores,
          total: bowled.reduce((a, b) => a + b, 0),
          strikes: strikes.length ? strikes.reduce((a, b) => a + b, 0) : null,
        });
      }
      const all = lines.flatMap((l) => l.scores).filter((v): v is number => v !== null);
      const totalScore = all.reduce((a, b) => a + b, 0);
      return {
        player,
        team: player.teamId ? findTeam(league, player.teamId) : undefined,
        games: all.length,
        totalScore,
        average: all.length ? totalScore / all.length : null,
        strikes: lines.reduce((n, l) => n + (l.strikes ?? 0), 0),
        highGame: all.length ? Math.max(...all) : null,
        lines,
      };
    })
    .filter((s) => s.games > 0)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || b.totalScore - a.totalScore);
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
