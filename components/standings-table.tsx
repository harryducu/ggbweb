import Link from "next/link";
import { Crest, Pips } from "./ui";
import { fmtAvg, fmtInt, fmtPct, type Standing } from "@/lib/stats";

/**
 * The league table. `compact` trims it to the columns that matter at a glance
 * for the home page; the full version lives on /standings.
 */
export function StandingsTable({
  standings,
  compact = false,
  playoffLine,
}: {
  standings: Standing[];
  compact?: boolean;
  /** Draw a cut line after this rank to mark the playoff field. */
  playoffLine?: number;
}) {
  return (
    <div className="table-scroll">
      <table className="stat">
        <thead>
          <tr>
            <th className="left w-8">#</th>
            <th className="left">Team</th>
            <th>W</th>
            <th>L</th>
            <th>T</th>
            <th>Pts</th>
            {compact ? null : <th>GP</th>}
            <th>Win%</th>
            {compact ? null : <th>Avg</th>}
            <th>Pins</th>
            {compact ? null : <th className="left pl-4">Form</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const leader = s.rank === 1 && s.games > 0;
            const cut = playoffLine !== undefined && s.rank === playoffLine;
            return (
              <tr
                key={s.team.id}
                className={[
                  "team-bar",
                  leader ? "bg-gold/[0.055]" : "",
                  cut ? "border-b-2 !border-b-red/50" : "",
                ].join(" ")}
                style={{ ["--team" as string]: s.team.color }}
              >
                <td className="num">
                  <span className={leader ? "text-gold font-bold" : "text-muted-2"}>{s.rank}</span>
                </td>
                <td className="key left">
                  <Link
                    href={`/teams/${s.team.id}`}
                    className="inline-flex items-center gap-2 min-w-0 hover:text-cream transition-colors"
                  >
                    <Crest team={s.team} size={22} />
                    <span className="truncate">{s.team.name}</span>
                    {leader ? <span className="badge badge-bye ml-1">1st</span> : null}
                  </Link>
                </td>
                <td className="num font-semibold">{s.wins}</td>
                <td className="num">{s.losses}</td>
                <td className="num dim">{s.ties}</td>
                <td className="num font-semibold text-cream">{s.points}</td>
                {compact ? null : <td className="num dim">{s.games}</td>}
                <td className="num">{fmtPct(s.winPct)}</td>
                {compact ? null : <td className="num dim">{fmtAvg(s.avgScore, 0)}</td>}
                <td className="num">{fmtInt(s.totalPins)}</td>
                {compact ? null : (
                  <td className="left pl-4">
                    <Pips form={s.form} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
