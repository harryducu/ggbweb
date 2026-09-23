import type { GameNumber, League, Player, Team, Week } from "./types";

/**
 * The league's real teams and real 7-week schedule, transcribed from the
 * commissioner's spreadsheet. Player rosters and all scores are placeholders.
 */

const TEAM_SEED: Array<
  Omit<
    Team,
    | "powerRanking"
    | "powerScore"
    | "powerRankingDescription"
    | "powerMovement"
    | "logo"
    | "manualRecord"
  >
> = [
  {
    id: "two-fingers-one-thumb",
    name: "2 Fingers 1 Thumb",
    abbreviation: "2F1T",
    color: "#8b5cf6",
    sortOrder: 0,
  },
  {
    id: "back-alley-bowljobs",
    name: "Back Alley BowlJobs",
    abbreviation: "BAB",
    color: "#6d28d9",
    sortOrder: 1,
  },
  {
    id: "southside-slaw-bunnies",
    name: "Southside Slaw Bunnies",
    abbreviation: "SSB",
    color: "#db2777",
    sortOrder: 2,
  },
  {
    id: "osama-pin-laden",
    name: "Osama Pin Laden",
    abbreviation: "OPL",
    color: "#b91c1c",
    sortOrder: 3,
  },
  {
    id: "pocket-pounders",
    name: "Pocket Pounders",
    abbreviation: "PP",
    color: "#71717a",
    sortOrder: 4,
  },
  { id: "goop-troop", name: "Goop Troop", abbreviation: "GT", color: "#22c55e", sortOrder: 5 },
  { id: "sunday-guys", name: "Sunday Guys", abbreviation: "SG", color: "#2563eb", sortOrder: 6 },
];

/** Short keys used only inside this file to keep the schedule readable. */
const T = {
  TF: "two-fingers-one-thumb",
  BA: "back-alley-bowljobs",
  SS: "southside-slaw-bunnies",
  OP: "osama-pin-laden",
  PP: "pocket-pounders",
  GT: "goop-troop",
  SG: "sunday-guys",
} as const;

type Pair = readonly [string, string];

/**
 * [byeTeam, game1 pairs, game2 pairs, game3 pairs] for each of the 7 weeks.
 *
 * Weeks 3 to 7 differ from the commissioner's original spreadsheet. That version
 * left week 5 with two repeated pairings — 2 Fingers met Pocket Pounders twice
 * and Goop Troop met Osama twice on the same night — because the other weeks
 * used up the rest of the fixtures first. Six matchups across weeks 3, 5 and 7
 * were swapped so every team faces three different opponents every night. Byes
 * are unchanged, weeks 1 and 2 are exactly as bowled, and all 21 pairings still
 * meet exactly three times.
 */
const SCHEDULE: Array<{ bye: string; games: [Pair[], Pair[], Pair[]] }> = [
  {
    bye: T.PP,
    games: [
      [
        [T.TF, T.OP],
        [T.GT, T.SG],
        [T.SS, T.BA],
      ],
      [
        [T.TF, T.GT],
        [T.SS, T.SG],
        [T.OP, T.BA],
      ],
      [
        [T.TF, T.SG],
        [T.GT, T.BA],
        [T.OP, T.SS],
      ],
    ],
  },
  {
    bye: T.SG,
    games: [
      [
        [T.TF, T.SS],
        [T.OP, T.BA],
        [T.GT, T.PP],
      ],
      [
        [T.TF, T.GT],
        [T.PP, T.BA],
        [T.OP, T.SS],
      ],
      [
        [T.PP, T.OP],
        [T.TF, T.BA],
        [T.SS, T.GT],
      ],
    ],
  },
  {
    bye: T.SS,
    games: [
      [
        [T.BA, T.TF],
        [T.GT, T.PP],
        [T.OP, T.SG],
      ],
      [
        [T.BA, T.PP],
        [T.GT, T.SG],
        [T.OP, T.TF],
      ],
      [
        [T.BA, T.SG],
        [T.GT, T.OP],
        [T.PP, T.TF],
      ],
    ],
  },
  {
    bye: T.OP,
    games: [
      [
        [T.BA, T.TF],
        [T.GT, T.SG],
        [T.PP, T.SS],
      ],
      [
        [T.BA, T.GT],
        [T.PP, T.SG],
        [T.SS, T.TF],
      ],
      [
        [T.BA, T.SS],
        [T.GT, T.PP],
        [T.SG, T.TF],
      ],
    ],
  },
  {
    bye: T.BA,
    games: [
      [
        [T.GT, T.OP],
        [T.PP, T.SG],
        [T.SS, T.TF],
      ],
      [
        [T.GT, T.SS],
        [T.OP, T.SG],
        [T.PP, T.TF],
      ],
      [
        [T.GT, T.TF],
        [T.OP, T.PP],
        [T.SS, T.SG],
      ],
    ],
  },
  {
    bye: T.GT,
    games: [
      [
        [T.BA, T.SG],
        [T.OP, T.TF],
        [T.PP, T.SS],
      ],
      [
        [T.BA, T.OP],
        [T.PP, T.TF],
        [T.SS, T.SG],
      ],
      [
        [T.BA, T.SS],
        [T.OP, T.PP],
        [T.SG, T.TF],
      ],
    ],
  },
  {
    bye: T.TF,
    games: [
      [
        [T.BA, T.PP],
        [T.GT, T.SS],
        [T.OP, T.SG],
      ],
      [
        [T.BA, T.GT],
        [T.OP, T.SS],
        [T.PP, T.SG],
      ],
      [
        [T.BA, T.SG],
        [T.GT, T.OP],
        [T.PP, T.SS],
      ],
    ],
  },
];

/**
 * The real league roster and season-to-date stats, from the commissioner's
 * workbook (BOWLING_LEAGUE_REAL.xlsx) after week 2.
 *
 * The workbook has no player-to-team column, so rosters were reconstructed from
 * each team's Total Score: the twenty bowlers with six games played partition
 * into the five teams that have bowled both weeks with exact sums, and the
 * eight with three games split into the two teams that have had a bye. Five of
 * the seven rosters are uniquely determined that way; the Osama Pin Laden /
 * Goop Troop split was confirmed by the commissioner.
 *
 * Averages are deliberately not stored — they are derived from totalScore and
 * games, which reproduces the workbook exactly without carrying float noise.
 */
interface SeedPlayer {
  name: string;
  teamId: string;
  totalScore: number;
  strikes: number;
  games: number;
}

const PLAYER_SEED: SeedPlayer[] = [
  // 2 Fingers 1 Thumb — 3037 pins
  { name: "Drew Taylor", teamId: T.TF, totalScore: 823, strikes: 4, games: 6 },
  { name: "Chase Nolde", teamId: T.TF, totalScore: 764, strikes: 10, games: 6 },
  { name: "Jack Petsche", teamId: T.TF, totalScore: 734, strikes: 8, games: 6 },
  { name: "Nikola M", teamId: T.TF, totalScore: 716, strikes: 6, games: 6 },

  // Back Alley BowlJobs — 2930 pins
  { name: "Charlie Dixon", teamId: T.BA, totalScore: 857, strikes: 15, games: 6 },
  { name: "Adam Bennett", teamId: T.BA, totalScore: 727, strikes: 10, games: 6 },
  { name: "Connor Eng", teamId: T.BA, totalScore: 719, strikes: 10, games: 6 },
  { name: "Avery Pascoe", teamId: T.BA, totalScore: 627, strikes: 5, games: 6 },

  // Southside Slaw Bunnies — 2782 pins
  { name: "Anthony Brohl", teamId: T.SS, totalScore: 830, strikes: 11, games: 6 },
  { name: "Hunter Lilla", teamId: T.SS, totalScore: 809, strikes: 13, games: 6 },
  { name: "Aidan Poggi", teamId: T.SS, totalScore: 622, strikes: 4, games: 6 },
  { name: "Harry Ducu", teamId: T.SS, totalScore: 521, strikes: 6, games: 6 },

  // Osama Pin Laden — 2699 pins
  { name: "Nick Brown", teamId: T.OP, totalScore: 770, strikes: 11, games: 6 },
  { name: "EBT", teamId: T.OP, totalScore: 653, strikes: 8, games: 6 },
  { name: "Devin Reome", teamId: T.OP, totalScore: 645, strikes: 10, games: 6 },
  { name: "Slutty J", teamId: T.OP, totalScore: 631, strikes: 11, games: 6 },

  // Goop Troop — 2662 pins
  { name: "Zach Cabby", teamId: T.GT, totalScore: 690, strikes: 11, games: 6 },
  { name: "Grayson Jones", teamId: T.GT, totalScore: 688, strikes: 6, games: 6 },
  { name: "Luke Nelson", teamId: T.GT, totalScore: 650, strikes: 10, games: 6 },
  { name: "Charlie Fracker", teamId: T.GT, totalScore: 634, strikes: 8, games: 6 },

  // Pocket Pounders — byed week 1, so three games played
  { name: "Brock Rodgers", teamId: T.PP, totalScore: 393, strikes: 9, games: 3 },
  { name: "Brody Burns", teamId: T.PP, totalScore: 381, strikes: 6, games: 3 },
  { name: "Kyle Mo", teamId: T.PP, totalScore: 316, strikes: 3, games: 3 },
  { name: "Caden Ophoff", teamId: T.PP, totalScore: 314, strikes: 4, games: 3 },

  // Sunday Guys — byed week 2, so three games played
  { name: "Jack Hulgrave", teamId: T.SG, totalScore: 367, strikes: 3, games: 3 },
  { name: "Dylan Pham", teamId: T.SG, totalScore: 347, strikes: 3, games: 3 },
  { name: "Carson Cebul", teamId: T.SG, totalScore: 262, strikes: 1, games: 3 },
  { name: "Matthew Kurc", teamId: T.SG, totalScore: 230, strikes: 1, games: 3 },
];

/**
 * Team records after week 2, straight from the workbook's Team Standings sheet.
 * These are stored as manual overrides because the workbook records season
 * totals only — there are no game-by-game team scores to derive them from yet.
 */
const RECORD_SEED: Record<string, { wins: number; losses: number; totalPins: number }> = {
  [T.BA]: { wins: 6, losses: 0, totalPins: 2930 },
  [T.TF]: { wins: 5, losses: 1, totalPins: 3037 },
  [T.PP]: { wins: 2, losses: 1, totalPins: 1434 },
  [T.SS]: { wins: 3, losses: 3, totalPins: 2782 },
  [T.GT]: { wins: 2, losses: 4, totalPins: 2662 },
  [T.OP]: { wins: 0, losses: 6, totalPins: 2699 },
  [T.SG]: { wins: 0, losses: 3, totalPins: 1206 },
};

/**
 * Where each team sat in the week 1 power rankings graphic. Used only to compute
 * the movement arrows against the current order.
 */
const WEEK1_POWER_ORDER: string[] = [T.TF, T.BA, T.SS, T.OP, T.PP, T.GT, T.SG];

/**
 * The workbook's totals run through this week. Scores entered for any later
 * week are added on top, so the season keeps accumulating from here instead of
 * being frozen at the spreadsheet's numbers.
 */
const TOTALS_THROUGH_WEEK = 2;

/** Bumped when the fixture list changes, so stored leagues can be migrated. */
export const SCHEDULE_VERSION = 2;

/** The corrected fixtures, keyed by week number, for migrating an existing league. */
export function scheduleForWeek(weekNumber: number): { bye: string; games: Pair[][] } | undefined {
  return SCHEDULE[weekNumber - 1];
}

/** Monday nights, starting the first Monday of the season. */
function mondayDates(count: number, firstMonday: string): string[] {
  const out: string[] = [];
  const start = new Date(`${firstMonday}T00:00:00`);
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildSeedLeague(): League {
  // Current order is the standings order; movement is measured against the
  // order published in the week 1 power rankings graphic.
  const standingsOrder = [...TEAM_SEED]
    .map((t) => ({ id: t.id, ...RECORD_SEED[t.id] }))
    // Same ordering computeStandings uses: win percentage, then wins, then pins.
    .sort(
      (a, b) =>
        b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses) ||
        b.wins - a.wins ||
        b.totalPins - a.totalPins,
    )
    .map((t) => t.id);

  const teams: Team[] = TEAM_SEED.map((t) => {
    const record = RECORD_SEED[t.id];
    const position = standingsOrder.indexOf(t.id) + 1;
    const wasAt = WEEK1_POWER_ORDER.indexOf(t.id) + 1;
    return {
      ...t,
      logo: null,
      manualRecord: {
        throughWeek: TOTALS_THROUGH_WEEK,
        wins: record.wins,
        losses: record.losses,
        ties: 0,
        totalPins: record.totalPins,
      },
      powerRanking: position,
      powerScore: null,
      powerMovement: wasAt > 0 ? wasAt - position : 0,
      powerRankingDescription: "",
    };
  });

  const taken = new Set<string>();
  const players: Player[] = PLAYER_SEED.map((p) => {
    let id = slugify(p.name);
    let n = 2;
    while (taken.has(id)) id = `${slugify(p.name)}-${n++}`;
    taken.add(id);
    return {
      id,
      name: p.name,
      photo: null,
      teamId: p.teamId,
      nickname: null,
      additionalStats: { spares: null, openFrames: null },
      // Season totals come from the workbook; average is derived from them.
      manualStats: {
        throughWeek: TOTALS_THROUGH_WEEK,
        games: p.games,
        average: null,
        totalScore: p.totalScore,
        strikes: p.strikes,
      },
      active: true,
    };
  });

  const dates = mondayDates(7, "2026-09-14");
  const weeks: Week[] = SCHEDULE.map((wk, wi) => ({
    id: `week-${wi + 1}`,
    weekNumber: wi + 1,
    date: dates[wi],
    byeTeamId: wk.bye,
    completed: false,
    notes: "",
    matchups: wk.games.flatMap((pairs, gi) =>
      pairs.map(([a, b], pi) => ({
        id: `w${wi + 1}g${gi + 1}m${pi + 1}`,
        game: (gi + 1) as GameNumber,
        team1Id: a,
        team2Id: b,
        team1Score: null,
        team2Score: null,
      })),
    ),
    playerScores: [],
  }));

  // Weeks 1 and 2 have been bowled. The workbook records season totals only,
  // so there are no game-by-game scores to seed — the commissioner can add them
  // under Enter Scores and the overrides above will stop being needed.
  for (const week of weeks) {
    week.completed = week.weekNumber <= 2;
  }

  return {
    settings: {
      name: "Good Guys Bowling League",
      tagline: "Same league, different breed",
      season: "2026 Season",
      logo: "/brand/logo.png",
      currentWeek: 3,
      scheduleVersion: SCHEDULE_VERSION,
      description:
        "Monday night bowling. Seven teams, four bowlers each, three games a night, one bye per team across the seven-week regular season. Top six make the playoffs.",
      rules: [
        "Three games every Monday night. Each game counts as its own win or loss in the standings.",
        "Each team sits one week out on a bye. Bye weeks do not count as wins or losses.",
        "Every pair of teams meets three times over the regular season.",
        "Team score for a game is the sum of its four bowlers' scores.",
        "A bowler missing a night scores zero unless a substitute is approved by the commissioner.",
        "Top six teams by points make the playoffs. Seeds 1 and 2 get a bye into the semifinals.",
        "Ties in the standings are broken by total pins.",
      ].join("\n"),
      pointsPerWin: 2,
      pointsPerTie: 1,
      gamesPerNight: 3,
      playersPerTeam: 4,
      playerStatFields: [
        { key: "spares", label: "Spares", lowerIsBetter: false, showOnStatsPage: true },
        { key: "openFrames", label: "Open Frames", lowerIsBetter: true, showOnStatsPage: false },
      ],
    },
    teams,
    players,
    weeks,
    playoffs: {
      enabled: true,
      qualifiers: 6,
      series: [
        {
          id: "pi-1",
          round: "playin",
          label: "4 vs 5",
          slot1: "seed:4",
          slot2: "seed:5",
          team1Score: null,
          team2Score: null,
          winnerId: null,
        },
        {
          id: "pi-2",
          round: "playin",
          label: "3 vs 6",
          slot1: "seed:3",
          slot2: "seed:6",
          team1Score: null,
          team2Score: null,
          winnerId: null,
        },
        {
          id: "sf-1",
          round: "semifinal",
          label: "1 vs (4/5)",
          slot1: "seed:1",
          slot2: "series:pi-1",
          team1Score: null,
          team2Score: null,
          winnerId: null,
        },
        {
          id: "sf-2",
          round: "semifinal",
          label: "2 vs (3/6)",
          slot1: "seed:2",
          slot2: "series:pi-2",
          team1Score: null,
          team2Score: null,
          winnerId: null,
        },
        {
          id: "final",
          round: "final",
          label: "Championship",
          slot1: "series:sf-1",
          slot2: "series:sf-2",
          team1Score: null,
          team2Score: null,
          winnerId: null,
        },
      ],
      championId: null,
    },
  };
}
