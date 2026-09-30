import Link from "next/link";
import { Crest } from "./ui";
import type { GameGroup, ResolvedMatchup } from "@/lib/stats";
import type { Team } from "@/lib/types";

/** Season records keyed by team id, e.g. "8–1". Optional everywhere. */
export type TeamRecords = Map<string, string>;

interface GameResultProps {
  r: ResolvedMatchup;
  dense?: boolean;
  /** Shows each team's season record beside its name. */
  records?: TeamRecords;
  /** Set false to keep the row inert — used on the box score page for itself. */
  link?: boolean;
  /** Marks the game currently being viewed. */
  current?: boolean;
}

/**
 * One game between two teams: the atomic unit of this league. Nine of these
 * happen every Monday. The winner stays bright and the loser dims, so a whole
 * week of results is readable in a glance without reading a single number.
 *
 * Once a game has been bowled the whole row opens its box score, so the two
 * team links move inside that page rather than competing with it here.
 */
export function GameResult({ r, dense = false, records, link = true, current }: GameResultProps) {
  const t1Won = r.played && !r.tie && r.winnerId === r.matchup.team1Id;
  const t2Won = r.played && !r.tie && r.winnerId === r.matchup.team2Id;
  const toBox = link && r.played;

  const row = (
    <div
      className={[
        "flex items-center gap-2 border-b border-line last:border-b-0 transition-colors",
        current ? "bg-white/[0.05]" : "hover:bg-white/[0.03]",
        dense ? "px-2.5 py-1.5" : "px-3 py-2",
      ].join(" ")}
    >
      <Side
        team={r.team1}
        won={t1Won}
        dim={t2Won}
        record={r.team1 ? records?.get(r.team1.id) : undefined}
        link={!toBox}
      />

      {r.played ? (
        <span className="flex-none flex items-center gap-1.5 font-display italic font-extrabold leading-none num text-[1.05rem]">
          <span className={t1Won ? "text-cream" : "text-muted-2"}>{r.team1Score}</span>
          <span className="text-muted-2 text-[0.7rem] not-italic font-bold">—</span>
          <span className={t2Won ? "text-cream" : "text-muted-2"}>{r.team2Score}</span>
        </span>
      ) : (
        <span className="flex-none overline text-muted-2 px-1">vs</span>
      )}

      <Side
        team={r.team2}
        won={t2Won}
        dim={t1Won}
        align="right"
        record={r.team2 ? records?.get(r.team2.id) : undefined}
        link={!toBox}
      />

      {toBox ? (
        <span className="flex-none text-muted-2 text-[0.75rem] leading-none" aria-hidden>
          ›
        </span>
      ) : null}
    </div>
  );

  if (!toBox) return row;

  return (
    <Link
      href={`/games/${r.matchup.id}`}
      className="block"
      title={`Box score: ${r.team1?.name ?? "TBD"} vs ${r.team2?.name ?? "TBD"}`}
    >
      {row}
    </Link>
  );
}

function Side({
  team,
  won,
  dim,
  align = "left",
  record,
  link = true,
}: {
  team: Team | undefined;
  won: boolean;
  dim: boolean;
  align?: "left" | "right";
  record?: string;
  link?: boolean;
}) {
  const cls = [
    "tap-row flex-1 min-w-0 flex items-center gap-2 self-stretch",
    align === "right" ? "flex-row-reverse text-right" : "",
  ].join(" ");

  // The record sits under the name rather than beside it: on a phone a row
  // this wide has no horizontal space left to give, and team names were
  // truncating to three letters.
  const body = (
    <>
      <Crest team={team} size={20} />
      <span
        className={[
          "min-w-0 flex flex-col leading-tight",
          align === "right" ? "items-end" : "items-start",
        ].join(" ")}
      >
        <span
          className={[
            "max-w-full truncate text-[0.86rem]",
            won ? "text-cream font-semibold" : dim ? "text-muted-2 font-medium" : "font-medium",
          ].join(" ")}
        >
          {team?.name ?? "TBD"}
        </span>
        {record ? (
          <span className="num text-[0.74rem] text-muted-2" title="Season record">
            {record}
          </span>
        ) : null}
      </span>
    </>
  );

  return team && link ? (
    <Link
      href={`/teams/${team.id}`}
      className={`${cls} hover:text-cream transition-colors`}
      title={team.name}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * The three games of a night, each with its own subhead. Matches the "Match #"
 * grouping the commissioner already uses in the spreadsheet.
 */
export function GameGroups({
  groups,
  dense = false,
  records,
  currentId,
}: {
  groups: GameGroup[];
  dense?: boolean;
  records?: TeamRecords;
  currentId?: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted">No games scheduled for this week.</p>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.game}>
          <div className="flex items-center gap-2 px-3 py-1 bg-ink-2 border-y border-line">
            <span className="overline">Game {group.game}</span>
            <span className="flex-1 h-px bg-line" />
            <span className="overline">
              {group.matchups.filter((m) => m.played).length}/{group.matchups.length} bowled
            </span>
          </div>
          {group.matchups.map((r) => (
            <GameResult
              key={r.matchup.id}
              r={r}
              dense={dense}
              records={records}
              current={currentId === r.matchup.id}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/** Compact per-team line: how a team's whole night went. */
export function NightLine({
  team,
  wins,
  losses,
  ties,
  pins,
  bye = false,
}: {
  team: Team | undefined;
  wins: number;
  losses: number;
  ties: number;
  pins: number;
  bye?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-1.5 team-bar border-b border-line last:border-b-0"
      style={{ ["--team" as string]: team?.color ?? "#3a3a44" }}
    >
      <Crest team={team} size={18} />
      <span className="flex-1 min-w-0 truncate text-[0.84rem] font-medium">
        {team?.name ?? "TBD"}
      </span>
      {bye ? (
        <span className="badge badge-bye">Bye</span>
      ) : (
        <>
          <span className="flex-none num text-[0.84rem] font-semibold text-cream w-14 text-right">
            {wins}–{losses}
            {ties ? `–${ties}` : ""}
          </span>
          <span className="flex-none num text-[0.76rem] text-muted-2 w-16 text-right">
            {pins.toLocaleString()}
          </span>
        </>
      )}
    </div>
  );
}
