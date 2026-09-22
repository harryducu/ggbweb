import { NextResponse } from "next/server";
import { isCommissioner } from "@/lib/auth";
import { mutateLeague, readLeague } from "@/lib/store";
import {
  computePlayerStats,
  computePowerRankings,
  computeStandings,
  resolvePlayoffs,
  resolveWeek,
  teamNight,
  weekGames,
} from "@/lib/stats";

/**
 * Data integrity check for the league file. Commissioner-only: it writes and
 * reverts a value to prove the store round-trips.
 */
export async function GET() {
  if (!(await isCommissioner())) {
    return NextResponse.json(
      { error: "Sign in to the Commissioner panel first." },
      { status: 401 },
    );
  }

  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
  const notes: string[] = [];
  const ok = (name: string, pass: boolean, detail = "") => checks.push({ name, pass, detail });

  const league = await readLeague();

  ok("7 teams", league.teams.length === 7, String(league.teams.length));
  ok("28 players", league.players.length === 28, String(league.players.length));
  ok(
    "no duplicate player ids",
    new Set(league.players.map((p) => p.id)).size === league.players.length,
    "",
  );
  ok(
    "no duplicate player names",
    new Set(league.players.map((p) => p.name)).size === league.players.length,
    "",
  );
  ok("7 weeks", league.weeks.length === 7, String(league.weeks.length));

  // Schedule shape: 9 games a week, one bye, each playing team in exactly 3.
  for (const week of league.weeks) {
    const games = weekGames(league, week);
    ok(
      `W${week.weekNumber}: 9 games in 3 groups of 3`,
      games.length === 3 && games.every((g) => g.matchups.length === 3),
      games.map((g) => g.matchups.length).join("/"),
    );
    const appearances = new Map<string, number>();
    for (const m of week.matchups) {
      appearances.set(m.team1Id, (appearances.get(m.team1Id) ?? 0) + 1);
      appearances.set(m.team2Id, (appearances.get(m.team2Id) ?? 0) + 1);
    }
    ok(
      `W${week.weekNumber}: every playing team bowls 3`,
      [...appearances.values()].every((n) => n === 3) && appearances.size === 6,
      `${appearances.size} teams, counts ${[...new Set(appearances.values())].join(",")}`,
    );
    ok(
      `W${week.weekNumber}: bye team is idle`,
      week.byeTeamId !== null && !appearances.has(week.byeTeamId),
      week.byeTeamId ?? "none",
    );
    // Informational: a night usually pits each team against three different
    // opponents, but the source schedule repeats a pairing in week 5 and the
    // season-wide "each pair meets three times" total still comes out exact.
    const pairs = week.matchups.map((m) => [m.team1Id, m.team2Id].sort().join("|"));
    if (new Set(pairs).size !== pairs.length) {
      notes.push(
        `Week ${week.weekNumber} repeats a pairing: ${pairs.length - new Set(pairs).size} duplicate matchup(s).`,
      );
    }
  }

  // Each pair should meet 3 times across the season.
  const seasonPairs = new Map<string, number>();
  for (const week of league.weeks) {
    for (const m of week.matchups) {
      const k = [m.team1Id, m.team2Id].sort().join("|");
      seasonPairs.set(k, (seasonPairs.get(k) ?? 0) + 1);
    }
  }
  const counts = [...seasonPairs.values()];
  ok(
    "every pair meets exactly 3 times",
    counts.every((c) => c === 3) && seasonPairs.size === 21,
    `${seasonPairs.size} pairs, counts: ${[...new Set(counts)].sort().join(",")}`,
  );

  // Standings must balance: wins == losses across the league.
  const standings = computeStandings(league);
  const wins = standings.reduce((n, s) => n + s.wins, 0);
  const losses = standings.reduce((n, s) => n + s.losses, 0);
  ok("wins equal losses", wins === losses, `${wins} W / ${losses} L`);
  ok(
    "standings ranked 1..7",
    standings.every((s, i) => s.rank === i + 1),
    "",
  );
  ok(
    "points match wins",
    standings.every(
      (s) =>
        s.points === s.wins * league.settings.pointsPerWin + s.ties * league.settings.pointsPerTie,
    ),
    "",
  );

  // A team's posted pin total should equal the sum of its roster's pins. Any
  // gap is a discrepancy in the source workbook, so report it rather than fail.
  for (const s of standings) {
    const roster = league.players.filter((p) => p.teamId === s.team.id);
    const rosterPins = roster.reduce((n, p) => n + (p.manualStats?.totalScore ?? 0), 0);
    const fromWeeks = league.weeks.reduce((n, w) => n + teamNight(league, w, s.team.id).pins, 0);

    ok(
      `${s.team.abbreviation}: 4 bowlers on the roster`,
      roster.length === league.settings.playersPerTeam,
      `${roster.length} bowlers`,
    );
    ok(
      `${s.team.abbreviation}: games match record`,
      s.games === s.wins + s.losses + s.ties,
      `${s.games} games vs ${s.wins}-${s.losses}-${s.ties}`,
    );
    if (rosterPins !== s.totalPins && rosterPins > 0) {
      notes.push(
        `${s.team.name}: posted total ${s.totalPins} pins but its four bowlers sum to ${rosterPins} (off by ${s.totalPins - rosterPins}).`,
      );
    }
    if (!s.manual && fromWeeks !== s.totalPins) {
      ok(`${s.team.abbreviation}: pins reconcile`, false, `${fromWeeks} vs ${s.totalPins}`);
    }
  }

  // Player totals must sum to team totals for each played game.
  const playerStats = computePlayerStats(league);
  const playerPins = playerStats.reduce((n, s) => n + s.totalScore, 0);
  const teamPins = standings.reduce((n, s) => n + s.totalPins, 0);
  if (playerPins !== teamPins) {
    notes.push(
      `League totals differ: bowlers sum to ${playerPins} pins, teams to ${teamPins} (off by ${teamPins - playerPins}).`,
    );
  }
  ok(
    "every bowler is on a team",
    playerStats.every((s) => s.team !== undefined),
    `${playerStats.filter((s) => !s.team).length} free agents`,
  );
  ok(
    "every bowler has season stats",
    playerStats.every((s) => s.games > 0 && s.totalScore > 0 && s.average !== null),
    `${playerStats.filter((s) => s.games === 0).length} without games`,
  );
  ok(
    "games played is 3 or 6 after two weeks",
    playerStats.every((s) => s.games === 3 || s.games === 6),
    [...new Set(playerStats.map((s) => s.games))].sort().join("/"),
  );
  ok("no placeholder names left", !league.players.some((p) => /roster spot/i.test(p.name)), "");
  ok(
    "standings order matches the workbook",
    standings.map((s) => s.team.abbreviation).join(",") === "BAB,2F1T,PP,SSB,GT,OPL,SG",
    standings.map((s) => s.team.abbreviation).join(","),
  );
  ok(
    "top bowler is Charlie Dixon at 857",
    playerStats.slice().sort((a, b) => b.totalScore - a.totalScore)[0]?.totalScore === 857,
    String(playerStats.slice().sort((a, b) => b.totalScore - a.totalScore)[0]?.totalScore),
  );
  ok(
    "averages consistent",
    playerStats.every(
      (s) => s.games === 0 || Math.abs((s.average ?? 0) * s.games - s.totalScore) < 0.01,
    ),
    "",
  );
  ok(
    "week 1 bye team has no scores",
    playerStats
      .filter((s) => s.team?.id === league.weeks[0].byeTeamId)
      .every((s) => s.byWeek[0].total === null),
    "",
  );

  // Power rankings and playoffs resolve without gaps.
  const power = computePowerRankings(league);
  ok("power rankings cover every team", power.length === 7, String(power.length));
  ok(
    "power positions 1..7",
    power.every((p, i) => p.position === i + 1),
    "",
  );

  const bracket = resolvePlayoffs(league);
  ok("bracket has 5 series", bracket.length === 5, String(bracket.length));
  ok(
    "play-in slots resolve to seeds 3-6",
    bracket
      .filter((b) => b.series.round === "playin")
      .every((b) => b.team1 !== undefined && b.team2 !== undefined),
    bracket
      .filter((b) => b.series.round === "playin")
      .map((b) => `${b.team1?.abbreviation}/${b.team2?.abbreviation}`)
      .join(" "),
  );
  ok(
    "semifinal top seeds resolve",
    bracket.filter((b) => b.series.round === "semifinal").every((b) => b.team1 !== undefined),
    "",
  );
  ok(
    "final has no winner yet",
    bracket.find((b) => b.series.round === "final")?.winner === undefined,
    "",
  );

  // Mutation round trip: write, read back, restore.
  const before = league.settings.tagline;
  await mutateLeague((l) => {
    l.settings.tagline = "__selftest__";
  });
  const mid = await readLeague();
  await mutateLeague((l) => {
    l.settings.tagline = before;
  });
  const after = await readLeague();
  ok("mutateLeague persists", mid.settings.tagline === "__selftest__", mid.settings.tagline);
  ok("mutateLeague restores", after.settings.tagline === before, after.settings.tagline);

  // Manual override path. Snapshot the real values first and put them back —
  // a diagnostic must never be able to damage the league's own data.
  const teamSnapshot = structuredClone(league.teams[0].manualRecord);
  await mutateLeague((l) => {
    l.teams[0].manualRecord = { throughWeek: null, wins: 12, losses: 3, ties: 0, totalPins: 9999 };
  });
  const overridden = computeStandings(await readLeague()).find(
    (s) => s.team.id === league.teams[0].id,
  );
  ok(
    "manual record overrides derived",
    overridden?.wins === 12 && overridden?.totalPins === 9999 && overridden?.manual === true,
    `${overridden?.wins}W ${overridden?.totalPins} pins`,
  );
  await mutateLeague((l) => {
    l.teams[0].manualRecord = structuredClone(teamSnapshot);
  });

  const playerSnapshot = structuredClone(league.players[0].manualStats);
  await mutateLeague((l) => {
    l.players[0].manualStats = {
      throughWeek: null,
      games: 6,
      average: 200,
      totalScore: 1200,
      strikes: 40,
    };
  });
  const pOver = computePlayerStats(await readLeague()).find(
    (s) => s.player.id === league.players[0].id,
  );
  ok(
    "manual player stats override derived",
    pOver?.average === 200 && pOver?.totalScore === 1200 && pOver?.strikes === 40,
    `${pOver?.average} avg`,
  );
  await mutateLeague((l) => {
    l.players[0].manualStats = structuredClone(playerSnapshot);
  });

  // And prove the restore actually restored.
  const restored = await readLeague();
  ok(
    "team override restored exactly",
    JSON.stringify(restored.teams[0].manualRecord) === JSON.stringify(teamSnapshot),
    JSON.stringify(restored.teams[0].manualRecord),
  );
  ok(
    "player override restored exactly",
    JSON.stringify(restored.players[0].manualStats) === JSON.stringify(playerSnapshot),
    JSON.stringify(restored.players[0].manualStats),
  );

  const failed = checks.filter((c) => !c.pass);
  return NextResponse.json(
    { total: checks.length, failed: failed.length, failures: failed, notes, checks },
    { status: failed.length ? 500 : 200 },
  );
}
