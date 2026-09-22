import Link from "next/link";
import { Crest } from "./ui";
import type { ResolvedSeries } from "@/lib/stats";
import type { Team } from "@/lib/types";

/**
 * One playoff series. Reads top-down: seed, mark, team, score. Slots that
 * aren't decided yet show where the team will come from ("Winner of 4 vs 5")
 * so the bracket is useful before a single playoff game is bowled.
 */
export function SeriesCard({
  resolved,
  seedOf,
  highlight = false,
}: {
  resolved: ResolvedSeries;
  seedOf: (team: Team | undefined) => number | null;
  highlight?: boolean;
}) {
  const { series, team1, team2, team1Label, team2Label, winner } = resolved;
  const decided = Boolean(winner);

  return (
    <div className={["panel overflow-hidden w-full", highlight ? "border-gold/55" : ""].join(" ")}>
      <div className="panel-head !py-1.5">
        <span className="overline">{series.label}</span>
        {decided ? <span className="badge badge-final">Final</span> : null}
      </div>
      <SeriesSide
        team={team1}
        label={team1Label}
        score={series.team1Score}
        seed={seedOf(team1)}
        won={decided && winner?.id === team1?.id}
        lost={decided && winner?.id !== team1?.id}
      />
      <div className="h-px bg-line" />
      <SeriesSide
        team={team2}
        label={team2Label}
        score={series.team2Score}
        seed={seedOf(team2)}
        won={decided && winner?.id === team2?.id}
        lost={decided && winner?.id !== team2?.id}
      />
    </div>
  );
}

function SeriesSide({
  team,
  label,
  score,
  seed,
  won,
  lost,
}: {
  team: Team | undefined;
  label: string;
  score: number | null;
  seed: number | null;
  won: boolean;
  lost: boolean;
}) {
  const body = (
    <div
      className={[
        "flex items-center gap-2 px-2.5 py-2 team-bar",
        won ? "bg-gold/[0.08]" : lost ? "opacity-50" : "",
      ].join(" ")}
      style={{ ["--team" as string]: won ? "var(--color-gold)" : (team?.color ?? "transparent") }}
    >
      <span className="flex-none w-4 text-center overline num">{seed ?? ""}</span>
      <Crest team={team} size={22} />
      <span
        className={[
          "flex-1 min-w-0 truncate text-[0.85rem]",
          team ? (won ? "text-cream font-semibold" : "font-medium") : "text-muted-2 italic",
        ].join(" ")}
      >
        {team?.name ?? label}
      </span>
      <span
        className={[
          "flex-none num text-[0.95rem]",
          won ? "text-cream font-bold" : "text-muted-2",
        ].join(" ")}
      >
        {score ?? "—"}
      </span>
    </div>
  );

  return team ? (
    <Link href={`/teams/${team.id}`} className="block hover:bg-white/[0.03] transition-colors">
      {body}
    </Link>
  ) : (
    body
  );
}

/* --------------------------------------------------------------- connectors */

/** Straight feed line: one series into the round beside it. */
export function JoinStraight({ at }: { at: string[] }) {
  return (
    <div className="hidden lg:block relative" aria-hidden>
      {at.map((top) => (
        <div key={top} className="absolute left-0 right-0 border-t border-line-2" style={{ top }} />
      ))}
    </div>
  );
}

/** Classic bracket elbow: two series merging into one in the next round. */
export function JoinElbow({
  fromTop = "25%",
  fromBottom = "75%",
  to = "50%",
}: {
  fromTop?: string;
  fromBottom?: string;
  to?: string;
}) {
  return (
    <div className="hidden lg:block relative" aria-hidden>
      <div className="absolute left-0 w-1/2 border-t border-line-2" style={{ top: fromTop }} />
      <div className="absolute left-0 w-1/2 border-t border-line-2" style={{ top: fromBottom }} />
      <div
        className="absolute left-1/2 border-l border-line-2"
        style={{ top: fromTop, height: `calc(${fromBottom} - ${fromTop})` }}
      />
      <div className="absolute left-1/2 right-0 border-t border-line-2" style={{ top: to }} />
    </div>
  );
}
