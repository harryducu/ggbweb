/**
 * Data models for the league. Everything the site renders comes from a single
 * League object persisted as JSON, so the commissioner never touches code.
 */

export type GameNumber = 1 | 2 | 3;

/**
 * Season totals entered by hand. The league's spreadsheet tracks average,
 * total pins and strikes directly, so the commissioner can post those without
 * logging every individual game. Any non-null field overrides the value
 * derived from game scores.
 */
export interface ManualPlayerStats {
  games: number | null;
  average: number | null;
  totalScore: number | null;
  strikes: number | null;
}

export interface Player {
  id: string;
  name: string;
  /** Public path to the player photo, e.g. /uploads/players/abc.jpg. Null renders initials. */
  photo: string | null;
  teamId: string | null;
  /** Optional hand-entered nickname shown under the name on cards. */
  nickname: string | null;
  /**
   * Free-form extra stats. Keys are defined in League.settings.playerStatFields,
   * so new categories can be added from the Commissioner panel without code changes.
   */
  additionalStats: Record<string, number | null>;
  /** Overrides for season totals; null fields fall back to entered game scores. */
  manualStats: ManualPlayerStats;
  active: boolean;
}

/** Same idea as ManualPlayerStats, for a team's record and pin total. */
export interface ManualTeamRecord {
  wins: number | null;
  losses: number | null;
  ties: number | null;
  totalPins: number | null;
}

export interface Team {
  id: string;
  name: string;
  /** Short form used in tight table cells and the bracket, e.g. "2F1T". */
  abbreviation: string;
  logo: string | null;
  /** Hex, drives the team's color bar / row tint across the site. */
  color: string;
  /** Manual power-ranking overrides. Position 1 = top of the rankings. */
  powerRanking: number | null;
  powerScore: number | null;
  powerRankingDescription: string;
  /** Movement vs. previous week: positive = moved up. */
  powerMovement: number;
  /** Display order in the Commissioner panel and Teams grid. */
  sortOrder: number;
  /** Overrides for the standings; null fields fall back to entered results. */
  manualRecord: ManualTeamRecord;
}

export interface Matchup {
  id: string;
  /** Which of the three games of the night this matchup belongs to. */
  game: GameNumber;
  team1Id: string;
  team2Id: string;
  /**
   * Manual team totals. When null, the total is summed from player scores.
   * Lets the commissioner log a result without entering all four players.
   */
  team1Score: number | null;
  team2Score: number | null;
}

export interface PlayerGameScore {
  playerId: string;
  game: GameNumber;
  score: number | null;
  strikes: number | null;
}

export interface Week {
  id: string;
  weekNumber: number;
  /** ISO date string (YYYY-MM-DD) or null if not scheduled yet. */
  date: string | null;
  /** The team sitting out this week. Null for a full slate. */
  byeTeamId: string | null;
  completed: boolean;
  matchups: Matchup[];
  playerScores: PlayerGameScore[];
  /** Commissioner's recap, shown on the home page and schedule. */
  notes: string;
}

export type PlayoffRoundId = "playin" | "semifinal" | "final";

export interface PlayoffSeries {
  id: string;
  round: PlayoffRoundId;
  label: string;
  /**
   * Slot sources. "seed:N" resolves to the Nth team in the final standings,
   * "series:ID" resolves to the winner of another series.
   */
  slot1: string;
  slot2: string;
  team1Score: number | null;
  team2Score: number | null;
  /** Manual winner override; otherwise derived from scores. */
  winnerId: string | null;
}

export interface Playoffs {
  enabled: boolean;
  /** How many teams qualify. Their bracket is built from the standings. */
  qualifiers: number;
  series: PlayoffSeries[];
  championId: string | null;
}

export interface StatField {
  /** Key inside Player.additionalStats. */
  key: string;
  label: string;
  /** Lower is better for stats like "open frames". */
  lowerIsBetter: boolean;
  /** Show as a sortable column on the Stats page. */
  showOnStatsPage: boolean;
}

export interface LeagueSettings {
  name: string;
  tagline: string;
  season: string;
  logo: string | null;
  currentWeek: number;
  description: string;
  rules: string;
  /** Points awarded in the standings. */
  pointsPerWin: number;
  pointsPerTie: number;
  gamesPerNight: number;
  playersPerTeam: number;
  playerStatFields: StatField[];
}

export interface League {
  settings: LeagueSettings;
  teams: Team[];
  players: Player[];
  weeks: Week[];
  playoffs: Playoffs;
}
