import Link from "next/link";
import { notFound } from "next/navigation";
import { readLeague } from "@/lib/store";
import {
  computePlayerStats,
  computeStandings,
  fmtAvg,
  fmtDate,
  fmtInt,
  fmtRecord,
  initials,
  standingFor,
} from "@/lib/stats";
import { Avatar, Crest, PageTitle, SectionHead, StatLine, StatRow } from "@/components/ui";
import { TrendChart } from "@/components/trend-chart";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await readLeague();
  const player = league.players.find((p) => p.id === id);
  return { title: player?.name ?? "Player" };
}

export default async function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await readLeague();
  const all = computePlayerStats(league);
  const stats = all.find((s) => s.player.id === id);
  if (!stats) notFound();

  const { player, team } = stats;
  const standings = computeStandings(league);
  const standing = team ? standingFor(standings, team.id) : undefined;
  const color = team?.color ?? "#3a3a44";

  const teammates = team
    ? all.filter((s) => s.team?.id === team.id && s.player.id !== player.id)
    : [];

  const withGames = all.filter((s) => s.games > 0);
  const leagueAvg =
    withGames.length > 0
      ? withGames.reduce((n, s) => n + s.totalScore, 0) / withGames.reduce((n, s) => n + s.games, 0)
      : null;

  const playedWeeks = stats.byWeek.filter((w) => w.total !== null);
  const lastThree = playedWeeks.slice(-3);
  const recentAvg =
    lastThree.length > 0
      ? lastThree.reduce((n, w) => n + (w.average ?? 0), 0) / lastThree.length
      : null;
  const trendDelta =
    recentAvg !== null && stats.average !== null ? recentAvg - stats.average : null;

  const extraFields = league.settings.playerStatFields;

  return (
    <div className="wrap">
      {/* ==================================================== player header */}
      <header className="pt-8 md:pt-10 pb-6 border-b border-line">
        <Link href="/players" className="section-link">
          ← All players
        </Link>

        <div className="mt-4 flex flex-col sm:flex-row gap-5 sm:gap-6 items-start">
          <div
            className="relative w-28 h-36 sm:w-36 sm:h-44 flex-none overflow-hidden border border-line-2 bg-panel-2"
            style={{ borderBottom: `3px solid ${color}` }}
          >
            {player.photo ? (
              <img src={player.photo} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(90% 70% at 50% 110%, ${color}40, transparent 70%)`,
                  }}
                />
                <span className="absolute inset-0 grid place-items-center display text-[2.4rem] text-white/25">
                  {initials(player.name)}
                </span>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="overline" style={{ color }}>
              {stats.averageRank ? `#${stats.averageRank} by average` : "Awaiting first game"}
            </div>
            <h1 className="display text-[clamp(2rem,7vw,3.4rem)] mt-1">{player.name}</h1>
            {player.nickname ? (
              <p className="text-muted text-[0.95rem] italic mt-0.5">“{player.nickname}”</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {team ? (
                <Link href={`/teams/${team.id}`} className="badge hover:text-cream">
                  <Crest team={team} size={14} /> {team.name}
                </Link>
              ) : (
                <span className="badge">Free agent</span>
              )}
              {standing ? (
                <span className="badge">
                  {fmtRecord(standing)} · {standing.rank} in table
                </span>
              ) : null}
              <span className="badge">{stats.games} games bowled</span>
              {trendDelta !== null && Math.abs(trendDelta) >= 1 ? (
                <span className={`badge ${trendDelta > 0 ? "badge-up" : "badge-down"}`}>
                  {trendDelta > 0 ? "▲" : "▼"} {fmtAvg(Math.abs(trendDelta))} last 3
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="py-6 md:py-8 space-y-9">
        {/* ========================================================= totals */}
        <StatRow>
          <StatLine label="Season average" value={fmtAvg(stats.average)} />
          <StatLine label="Total pins" value={fmtInt(stats.totalScore)} />
          <StatLine label="Strikes" value={fmtInt(stats.strikes)} />
          <StatLine label="High game" value={fmtInt(stats.highGame)} />
        </StatRow>

        {extraFields.length > 0 ? (
          <div className="panel grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-line">
            {extraFields.map((f) => (
              <StatLine
                key={f.key}
                label={f.label}
                value={fmtInt(player.additionalStats?.[f.key] ?? null)}
              />
            ))}
            <StatLine label="Low game" value={fmtInt(stats.lowGame)} />
          </div>
        ) : null}

        {/* ========================================================== trend */}
        <section>
          <SectionHead overline="Season trend" title="Average by week" />
          <div className="panel">
            <TrendChart
              points={stats.byWeek.map((w) => ({
                label: `W${w.weekNumber}`,
                value: w.average,
              }))}
              reference={stats.average}
              referenceLabel="Season avg"
            />
            <div className="border-t border-line px-3.5 py-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem] text-muted-2">
              <span>Gaps are bye weeks or nights missed.</span>
              {leagueAvg !== null ? (
                <span className="num">League average {fmtAvg(leagueAvg)}</span>
              ) : null}
            </div>
          </div>
        </section>

        {/* ===================================================== week table */}
        <section>
          <SectionHead overline="Game log" title="Stats by week" />
          <div className="panel overflow-hidden">
            <div className="table-scroll">
              <table className="stat">
                <thead>
                  <tr>
                    <th className="left">Week</th>
                    <th className="left">Date</th>
                    <th>G1</th>
                    <th>G2</th>
                    <th>G3</th>
                    <th>Series</th>
                    <th>Avg</th>
                    <th>X</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byWeek.map((w) => (
                    <tr key={w.weekNumber} className={w.bye ? "opacity-55" : ""}>
                      <td className="key left">Week {w.weekNumber}</td>
                      <td className="left dim num">{fmtDate(w.date)}</td>
                      {w.bye ? (
                        <td className="dim" colSpan={5}>
                          <span className="badge badge-bye">Bye week</span>
                        </td>
                      ) : (
                        <>
                          {w.scores.map((s, i) => (
                            <td key={i} className={s === null ? "dim" : ""}>
                              {s ?? "—"}
                            </td>
                          ))}
                          <td className="num font-semibold text-cream">{fmtInt(w.total)}</td>
                          <td className="num">{fmtAvg(w.average)}</td>
                        </>
                      )}
                      <td className="dim">{w.bye ? "—" : fmtInt(w.strikes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ======================================================= teammates */}
        {team ? (
          <section>
            <SectionHead
              overline={team.name}
              title="Teammates"
              href={`/teams/${team.id}`}
              hrefLabel="Team page"
            />
            <div className="panel overflow-hidden divide-y divide-line">
              {teammates.map((t) => (
                <Link
                  key={t.player.id}
                  href={`/players/${t.player.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
                >
                  <Avatar player={t.player} size={32} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-[0.92rem] truncate">
                      {t.player.name}
                    </span>
                    <span className="block overline">
                      {t.games} games · {fmtInt(t.strikes)} strikes
                    </span>
                  </span>
                  <span className="text-right flex-none">
                    <span className="block display num text-[1.15rem] leading-none text-cream">
                      {fmtAvg(t.average)}
                    </span>
                    <span className="block overline mt-0.5">Avg</span>
                  </span>
                </Link>
              ))}
              {teammates.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  No other bowlers assigned to {team.name} yet.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
