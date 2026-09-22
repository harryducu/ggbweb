import Link from "next/link";
import { Avatar } from "./ui";
import { fmtAvg, fmtInt, type PlayerStats } from "@/lib/stats";

/**
 * The league's "Top 5 Bowlers" graphic, as a leaderboard. Medal chips for the
 * podium, the headline number on the right, team as the supporting line.
 */
export function TopBowlers({
  rows,
  metric = "total",
}: {
  rows: PlayerStats[];
  metric?: "total" | "average";
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted">
        No games bowled yet. Enter Week 1 scores to fill the leaderboard.
      </div>
    );
  }

  return (
    <ol>
      {rows.map((row, i) => {
        // Shared rank on ties, matching how the league's own graphic reads.
        const value = metric === "total" ? row.totalScore : (row.average ?? 0);
        const prev = rows[i - 1];
        const prevValue = prev
          ? metric === "total"
            ? prev.totalScore
            : (prev.average ?? 0)
          : null;
        const position = prevValue === value ? positionOf(rows, i, metric) : i + 1;
        const medal = position <= 3 ? String(position) : undefined;

        return (
          <li
            key={row.player.id}
            className="team-bar border-b border-line last:border-b-0 hover:bg-white/[0.03] transition-colors"
            style={{ ["--team" as string]: row.team?.color ?? "#3a3a44" }}
          >
            <Link
              href={`/players/${row.player.id}`}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <span className="rank flex-none" data-medal={medal}>
                {position}
              </span>
              <Avatar player={row.player} size={34} />
              <span className="flex-1 min-w-0">
                <span className="block display text-[1.02rem] text-cream truncate">
                  {row.player.name}
                </span>
                <span className="block overline truncate">{row.team?.name ?? "Free agent"}</span>
              </span>
              <span className="flex-none text-right">
                <span className="block display num text-[1.5rem] leading-none text-cream">
                  {metric === "total" ? fmtInt(row.totalScore) : fmtAvg(row.average)}
                </span>
                <span className="block overline mt-0.5">
                  {metric === "total" ? "Total pins" : "Average"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function positionOf(rows: PlayerStats[], index: number, metric: "total" | "average"): number {
  const value = metric === "total" ? rows[index].totalScore : (rows[index].average ?? 0);
  const first = rows.findIndex(
    (r) => (metric === "total" ? r.totalScore : (r.average ?? 0)) === value,
  );
  return first + 1;
}
