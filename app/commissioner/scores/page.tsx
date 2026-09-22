import Link from "next/link";
import { readLeague } from "@/lib/store";
import { fmtDate, resolveWeek, weekState } from "@/lib/stats";
import { ScoreEntry, type EntryMatchup, type EntryTeam } from "@/components/admin/score-entry";

export const metadata = { title: "Enter Scores" };

export default async function ScoresAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const league = await readLeague();
  const { week: weekParam } = await searchParams;

  const weeks = [...league.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const selected =
    weeks.find((w) => String(w.weekNumber) === weekParam) ??
    weeks.find((w) => w.weekNumber === league.settings.currentWeek) ??
    weeks[0];

  if (!selected) {
    return (
      <div className="panel p-5">
        <h2 className="display text-xl">No weeks yet</h2>
        <p className="hint mt-1.5">
          Add weeks and matchups from{" "}
          <Link href="/commissioner/schedule" className="text-muted underline">
            Manage Schedule
          </Link>{" "}
          before entering scores.
        </p>
      </div>
    );
  }

  const teams: EntryTeam[] = [...league.teams]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      id: t.id,
      name: t.name,
      abbreviation: t.abbreviation,
      color: t.color,
      players: league.players
        .filter((p) => p.teamId === t.id)
        .map((p) => ({ id: p.id, name: p.name })),
    }));

  const matchups: EntryMatchup[] = [...selected.matchups]
    .sort((a, b) => a.game - b.game)
    .map((m) => ({
      id: m.id,
      game: m.game,
      team1Id: m.team1Id,
      team2Id: m.team2Id,
      team1Score: m.team1Score,
      team2Score: m.team2Score,
    }));

  const initialScores: Record<string, number | null> = {};
  const initialStrikes: Record<string, number | null> = {};
  for (const s of selected.playerScores) {
    initialScores[`s_${s.playerId}_${s.game}`] = s.score;
    initialStrikes[`x_${s.playerId}_${s.game}`] = s.strikes;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="display text-[1.6rem]">Enter Scores</h2>
        <p className="hint mt-1 max-w-2xl">
          Pick a week, type each bowler's three game scores, and save. Standings, averages, total
          pins, the leaderboard and the playoff seeding all recalculate from what you enter here.
        </p>
      </div>

      {/* Week picker doubles as a progress view of the season. */}
      <nav aria-label="Select week" className="flex flex-wrap gap-1.5">
        {weeks.map((w) => {
          const resolved = resolveWeek(league, w);
          const bowled = resolved.filter((r) => r.played).length;
          const active = w.id === selected.id;
          const state = weekState(league, w);
          return (
            <Link
              key={w.id}
              href={`/commissioner/scores?week=${w.weekNumber}`}
              aria-current={active ? "page" : undefined}
              className={[
                "badge !text-[0.7rem] !px-2 !py-1",
                active
                  ? "!bg-red !border-red !text-white"
                  : bowled === resolved.length && resolved.length > 0
                    ? "badge-up"
                    : bowled > 0
                      ? "badge-bye"
                      : state === "current"
                        ? "badge-live"
                        : "",
              ].join(" ")}
            >
              W{w.weekNumber}
              <span className="opacity-70 ml-1">
                {bowled}/{resolved.length}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="panel px-3.5 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="display text-[1.3rem] text-cream">Week {selected.weekNumber}</span>
        <span className="text-[0.82rem] text-muted num">{fmtDate(selected.date)}</span>
        <span className="flex-1" />
        <Link href={`/schedule#week-${selected.weekNumber}`} className="section-link">
          See it on the site →
        </Link>
      </div>

      <ScoreEntry
        weekId={selected.id}
        weekNumber={selected.weekNumber}
        teams={teams}
        byeTeamId={selected.byeTeamId}
        matchups={matchups}
        initialScores={initialScores}
        initialStrikes={initialStrikes}
        completed={selected.completed}
        notes={selected.notes}
      />
    </div>
  );
}
