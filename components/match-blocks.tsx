import Link from "next/link";
import { Crest } from "./ui";
import type { GameGroup, ResolvedMatchup } from "@/lib/stats";
import type { Team } from "@/lib/types";

/**
 * One game between two teams: the atomic unit of this league. Nine of these
 * happen every Monday. The winner stays bright and the loser dims, so a whole
 * week of results is readable in a glance without reading a single number.
 */
export function GameResult({ r, dense = false }: { r: ResolvedMatchup; dense?: boolean }) {
  const t1Won = r.played && !r.tie && r.winnerId === r.matchup.team1Id;
  const t2Won = r.played && !r.tie && r.winnerId === r.matchup.team2Id;

  return (
    <div
      className={[
        "flex items-center gap-2 border-b border-line last:border-b-0 hover:bg-white/[0.03] transition-colors",
        dense ? "px-2.5 py-1.5" : "px-3 py-2",
      ].join(" ")}
    >
      <Side team={r.team1} won={t1Won} dim={t2Won} />

      {r.played ? (
        <span className="flex-none flex items-center gap-1.5 font-display italic font-extrabold leading-none num text-[1.05rem]">
          <span className={t1Won ? "text-cream" : "text-muted-2"}>{r.team1Score}</span>
          <span className="text-muted-2 text-[0.7rem] not-italic font-bold">—</span>
          <span className={t2Won ? "text-cream" : "text-muted-2"}>{r.team2Score}</span>
        </span>
      ) : (
        <span className="flex-none overline text-muted-2 px-1">vs</span>
      )}

      <Side team={r.team2} won={t2Won} dim={t1Won} align="right" />
    </div>
  );
}

function Side({
  team,
  won,
  dim,
  align = "left",
}: {
  team: Team | undefined;
  won: boolean;
  dim: boolean;
  align?: "left" | "right";
}) {
  const cls = [
    "tap-row flex-1 min-w-0 flex items-center gap-2 self-stretch",
    align === "right" ? "flex-row-reverse text-right" : "",
  ].join(" ");

  const body = (
    <>
      <Crest team={team} size={20} />
      <span
        className={[
          "truncate text-[0.86rem]",
          won ? "text-cream font-semibold" : dim ? "text-muted-2 font-medium" : "font-medium",
        ].join(" ")}
      >
        {team?.name ?? "TBD"}
      </span>
    </>
  );

  return team ? (
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
export function GameGroups({ groups, dense = false }: { groups: GameGroup[]; dense?: boolean }) {
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
            <GameResult key={r.matchup.id} r={r} dense={dense} />
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
