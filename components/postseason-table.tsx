import Link from "next/link";
import { fmtAvg, fmtInt, type PostseasonStats } from "@/lib/stats";
import { Avatar } from "./ui";

/** Playoff and tiebreaker bowling, ranked by average. Never part of season stats. */
export function PostseasonTable({ stats }: { stats: PostseasonStats[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="table-scroll">
        <table className="stat">
          <thead>
            <tr>
              <th className="left w-10">#</th>
              <th className="left">Bowler</th>
              <th className="left">Team</th>
              <th>G</th>
              <th>Avg</th>
              <th>Pins</th>
              <th>High</th>
              <th>X</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr
                key={s.player.id}
                className="team-bar"
                style={{ ["--team" as string]: s.team?.color ?? "#3a3a44" }}
              >
                <td className="num dim">{i + 1}</td>
                <td className="key left">
                  <Link
                    href={`/players/${s.player.id}`}
                    className="inline-flex items-center gap-2 hover:text-cream transition-colors"
                  >
                    <Avatar player={s.player} size={24} />
                    <span className="truncate">{s.player.name}</span>
                  </Link>
                </td>
                <td className="left dim">{s.team?.abbreviation ?? "—"}</td>
                <td className="num">{s.games}</td>
                <td className="num font-semibold text-cream">{fmtAvg(s.average)}</td>
                <td className="num">{fmtInt(s.totalScore)}</td>
                <td className="num">{fmtInt(s.highGame)}</td>
                <td className="num dim">{fmtInt(s.strikes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
