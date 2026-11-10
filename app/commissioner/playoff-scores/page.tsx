import Link from "next/link";
import { readLeague } from "@/lib/store";
import { PLAYOFF_ROUND_LABEL, resolvePlayoffs } from "@/lib/stats";
import { PlayoffScoreEntry } from "@/components/admin/playoff-score-entry";
import type { EntryTeam } from "@/components/admin/score-entry";
import type { Team } from "@/lib/types";

export const metadata = { title: "Playoff Scores" };

export default async function PlayoffScoresAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ series?: string }>;
}) {
  const league = await readLeague();
  const { series: seriesParam } = await searchParams;

  // Only series with both teams known can be bowled.
  const ready = resolvePlayoffs(league).filter((r) => r.team1 && r.team2);
  const selected = ready.find((r) => r.series.id === seriesParam) ?? ready[0];

  const entryTeam = (team: Team): EntryTeam => ({
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    color: team.color,
    players: league.players
      .filter((p) => p.teamId === team.id)
      .map((p) => ({ id: p.id, name: p.name })),
  });

  const initialScores: Record<string, number | null> = {};
  const initialStrikes: Record<string, number | null> = {};
  for (const s of selected?.series.playerScores ?? []) {
    initialScores[`s_${s.playerId}_${s.game}`] = s.score;
    initialStrikes[`x_${s.playerId}_${s.game}`] = s.strikes;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="display text-[1.6rem]">Playoff Scores</h2>
        <p className="hint mt-1 max-w-2xl">
          Bowler scores for tiebreakers and playoff series. They show as playoff stats on the Stats
          page and each bowler&apos;s profile, and never count toward season averages, totals or
          the leaderboard.
        </p>
      </div>

      {ready.length === 0 ? (
        <div className="panel p-5">
          <p className="hint">
            No series has both teams set yet. Seeds fill in from the standings under{" "}
            <Link href="/commissioner/playoffs" className="text-muted underline">
              Manage Playoffs
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <nav aria-label="Select series" className="flex flex-wrap gap-1.5">
            {ready.map((r) => {
              const active = r.series.id === selected?.series.id;
              const entered = (r.series.playerScores ?? []).some((s) => s.score !== null);
              return (
                <Link
                  key={r.series.id}
                  href={`/commissioner/playoff-scores?series=${r.series.id}`}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "badge !text-[0.7rem] !px-2 !py-1",
                    active ? "!bg-red !border-red !text-white" : entered ? "badge-up" : "",
                  ].join(" ")}
                >
                  {r.team1!.abbreviation} v {r.team2!.abbreviation}
                  <span className="opacity-70 ml-1">{PLAYOFF_ROUND_LABEL[r.series.round]}</span>
                </Link>
              );
            })}
          </nav>

          {selected ? (
            <>
              <div className="panel px-3.5 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="display text-[1.3rem] text-cream">
                  {selected.team1!.name} v {selected.team2!.name}
                </span>
                <span className="text-[0.82rem] text-muted">
                  {PLAYOFF_ROUND_LABEL[selected.series.round]} · {selected.series.label} ·{" "}
                  {selected.bestOf === 1 ? "one game" : `best of ${selected.bestOf}`}
                </span>
                <span className="flex-1" />
                <Link href="/commissioner/playoffs" className="section-link">
                  Team scores and winner →
                </Link>
              </div>

              <PlayoffScoreEntry
                key={selected.series.id}
                seriesId={selected.series.id}
                label={selected.series.label}
                bestOf={selected.bestOf}
                teams={[entryTeam(selected.team1!), entryTeam(selected.team2!)]}
                initialScores={initialScores}
                initialStrikes={initialStrikes}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
