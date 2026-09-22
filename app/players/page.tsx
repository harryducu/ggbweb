import Link from "next/link";
import { readLeague } from "@/lib/store";
import { computePlayerStats, fmtAvg, fmtInt } from "@/lib/stats";
import { PlayerCard } from "@/components/player-card";
import { PageTitle, StatLine, StatRow } from "@/components/ui";

export const metadata = { title: "Players" };

export default async function PlayersPage() {
  const league = await readLeague();
  const stats = computePlayerStats(league);

  // Bowlers with games sort by average; everyone else follows alphabetically so
  // a fresh season still reads as a full, ordered roster rather than a jumble.
  const ordered = [...stats].sort((a, b) => {
    if (a.games === 0 && b.games === 0) return a.player.name.localeCompare(b.player.name);
    if (a.games === 0) return 1;
    if (b.games === 0) return -1;
    return (b.average ?? 0) - (a.average ?? 0);
  });

  const withGames = ordered.filter((s) => s.games > 0);
  const leagueAvg =
    withGames.length > 0
      ? withGames.reduce((n, s) => n + s.totalScore, 0) / withGames.reduce((n, s) => n + s.games, 0)
      : null;
  const highGame = withGames.reduce<{ v: number; name: string } | null>((best, s) => {
    if (s.highGame === null) return best;
    return !best || s.highGame > best.v ? { v: s.highGame, name: s.player.name } : best;
  }, null);

  return (
    <div className="wrap">
      <PageTitle
        overline={`${league.players.length} bowlers · ${league.teams.length} teams`}
        title="Players"
        lede="Every bowler in the league, ranked by season average. Tap any card for the full game-by-game log."
        right={
          <Link href="/stats" className="btn btn-ghost btn-sm">
            Sortable stats table
          </Link>
        }
      />

      <div className="py-6 md:py-8 space-y-7">
        <StatRow>
          <StatLine label="Bowlers" value={fmtInt(league.players.length)} />
          <StatLine label="League average" value={fmtAvg(leagueAvg)} />
          <StatLine label="High game" value={highGame ? fmtInt(highGame.v) : "—"} />
          <StatLine
            label="High game by"
            value={<span className="text-[1rem]">{highGame?.name ?? "—"}</span>}
          />
        </StatRow>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {ordered.map((s) => (
            <PlayerCard key={s.player.id} stats={s} rank={s.averageRank ?? undefined} />
          ))}
        </div>
      </div>
    </div>
  );
}
