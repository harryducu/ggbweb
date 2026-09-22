import { readLeague } from "@/lib/store";
import { computePlayerStats, fmtAvg, fmtInt } from "@/lib/stats";
import { StatsTable, type StatsColumn, type StatsRow } from "@/components/stats-table";
import { PageTitle, StatLine, StatRow } from "@/components/ui";

export const metadata = { title: "Stats" };

export default async function StatsPage() {
  const league = await readLeague();
  const stats = computePlayerStats(league);

  const rows: StatsRow[] = stats.map((s) => ({
    id: s.player.id,
    name: s.player.name,
    photo: s.player.photo,
    teamId: s.team?.id ?? null,
    teamName: s.team?.name ?? "Free agent",
    teamAbbr: s.team?.abbreviation ?? "—",
    teamColor: s.team?.color ?? "#3a3a44",
    games: s.games,
    average: s.average,
    totalScore: s.totalScore,
    strikes: s.strikes,
    highGame: s.highGame,
    lowGame: s.lowGame,
    extras: Object.fromEntries(
      league.settings.playerStatFields.map((f) => [
        f.key,
        s.player.additionalStats?.[f.key] ?? null,
      ]),
    ),
  }));

  const extraColumns: StatsColumn[] = league.settings.playerStatFields
    .filter((f) => f.showOnStatsPage)
    .map((f) => ({ key: f.key, label: f.label, lowerIsBetter: f.lowerIsBetter }));

  const played = stats.filter((s) => s.games > 0);
  const totalGames = played.reduce((n, s) => n + s.games, 0);
  const totalPins = played.reduce((n, s) => n + s.totalScore, 0);
  const strikes = played.reduce((n, s) => n + s.strikes, 0);
  const high = played.reduce<number | null>(
    (best, s) => (s.highGame !== null && (best === null || s.highGame > best) ? s.highGame : best),
    null,
  );

  return (
    <div className="wrap">
      <PageTitle
        overline={`${league.settings.season} · Individual`}
        title="Stats"
        lede="Every bowler, every category. Average and total pins are calculated from entered game scores; the rest are maintained by the commissioner."
      />

      <div className="py-6 md:py-8 space-y-7">
        <StatRow>
          <StatLine label="Bowler games" value={fmtInt(totalGames)} />
          <StatLine label="Pins bowled" value={fmtInt(totalPins)} />
          <StatLine label="Strikes" value={fmtInt(strikes)} />
          <StatLine
            label="League avg"
            value={fmtAvg(totalGames > 0 ? totalPins / totalGames : null)}
          />
        </StatRow>

        <StatsTable
          rows={rows}
          extraColumns={extraColumns}
          teams={league.teams
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((t) => ({ id: t.id, name: t.name, abbr: t.abbreviation, color: t.color }))}
        />

        <div className="panel p-4">
          <div className="overline">Highest game of the season</div>
          <div className="display text-[1.8rem] text-cream mt-1 num">
            {high === null ? "—" : high}
          </div>
          <p className="hint mt-1">
            New categories can be added any time from Commissioner → Manage Stats. They appear here
            as sortable columns automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
