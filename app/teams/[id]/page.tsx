import Link from "next/link";
import { notFound } from "next/navigation";
import { readLeague } from "@/lib/store";
import {
  computePlayerStats,
  computePowerRankings,
  computeStandings,
  fmtAvg,
  fmtDate,
  fmtInt,
  fmtRecord,
  findTeam,
  standingFor,
  teamNight,
  weekState,
} from "@/lib/stats";
import { Avatar, Crest, Movement, Pips, SectionHead, StatLine, StatRow } from "@/components/ui";
import { TrendChart } from "@/components/trend-chart";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await readLeague();
  return { title: findTeam(league, id)?.name ?? "Team" };
}

export default async function TeamProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await readLeague();
  const team = findTeam(league, id);
  if (!team) notFound();

  const standings = computeStandings(league);
  const standing = standingFor(standings, team.id);
  const power = computePowerRankings(league).find((p) => p.team.id === team.id);
  const roster = computePlayerStats(league)
    .filter((s) => s.team?.id === team.id)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

  const weeks = [...league.weeks].sort((a, b) => a.weekNumber - b.weekNumber);

  /** One row per week: three games against three different opponents. */
  const weekRows = weeks.map((week) => ({
    ...teamNight(league, week, team.id),
    state: weekState(league, week),
  }));

  return (
    <div className="wrap">
      {/* ====================================================== team header */}
      <header
        className="relative mt-6 md:mt-8 overflow-hidden border border-line"
        style={{
          background: `linear-gradient(105deg, ${team.color}30 0%, ${team.color}0f 40%, transparent 72%)`,
          boxShadow: `inset 4px 0 0 ${team.color}`,
        }}
      >
        <div className="px-4 py-5 md:px-7 md:py-7">
          <Link href="/teams" className="section-link">
            ← All teams
          </Link>

          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
            <Crest team={team} size={84} />
            <div className="min-w-0 flex-1">
              <div className="overline" style={{ color: team.color }}>
                {team.abbreviation} · {league.settings.season}
              </div>
              <h1 className="display text-[clamp(1.9rem,6.5vw,3.3rem)] mt-1">{team.name}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="badge">{fmtRecord(standing)} record</span>
                <span className="badge">#{standing?.rank ?? "—"} in standings</span>
                <span className="badge">Power #{power?.position ?? "—"}</span>
                {power ? <Movement value={power.movement} /> : null}
                {standing && standing.rank <= league.playoffs.qualifiers && standing.games > 0 ? (
                  <span className="badge badge-bye">In playoff position</span>
                ) : null}
              </div>
            </div>
            {standing ? (
              <div className="flex-none flex gap-5 sm:flex-col sm:gap-1 sm:text-right">
                <div>
                  <div className="overline">Points</div>
                  <div className="display num text-[2rem] leading-none text-cream">
                    {standing.points}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {power?.description ? (
        <blockquote
          className="mt-4 panel px-4 py-3 border-l-2"
          style={{ borderLeftColor: team.color }}
        >
          <div className="overline mb-1">Commissioner's note</div>
          <p className="text-[0.92rem] leading-relaxed text-muted">{power.description}</p>
        </blockquote>
      ) : null}

      <div className="py-7 md:py-9 space-y-9">
        <StatRow>
          <StatLine label="Total pins" value={fmtInt(standing?.totalPins ?? 0)} />
          <StatLine label="Team avg / game" value={fmtAvg(standing?.avgScore ?? null, 0)} />
          <StatLine label="Games bowled" value={fmtInt(standing?.games ?? 0)} />
          <StatLine label="Form" value={<Pips form={standing?.form ?? []} limit={9} />} />
        </StatRow>

        {/* ========================================================= roster */}
        <section>
          <SectionHead
            overline={`${roster.length} bowlers`}
            title="Roster"
            href="/players"
            hrefLabel="All players"
          />
          <div className="panel overflow-hidden">
            <div className="table-scroll">
              <table className="stat">
                <thead>
                  <tr>
                    <th className="left">Bowler</th>
                    <th>GP</th>
                    <th>Avg</th>
                    <th>Total</th>
                    <th>High</th>
                    <th>X</th>
                    <th>Lg rank</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((s) => (
                    <tr key={s.player.id}>
                      <td className="key left">
                        <Link
                          href={`/players/${s.player.id}`}
                          className="inline-flex items-center gap-2.5 hover:text-cream transition-colors"
                        >
                          <Avatar player={s.player} size={30} />
                          <span className="truncate">{s.player.name}</span>
                        </Link>
                      </td>
                      <td className="dim">{s.games}</td>
                      <td className="font-semibold text-cream">{fmtAvg(s.average)}</td>
                      <td>{fmtInt(s.totalScore)}</td>
                      <td className="dim">{fmtInt(s.highGame)}</td>
                      <td className="dim">{fmtInt(s.strikes)}</td>
                      <td className="dim">{s.averageRank ? `#${s.averageRank}` : "—"}</td>
                    </tr>
                  ))}
                  {roster.length === 0 ? (
                    <tr>
                      <td className="left dim" colSpan={7}>
                        No bowlers assigned to this team yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ============================================= weekly performance */}
        <section>
          <SectionHead overline="Team performance" title="Average by week" />
          <div className="panel">
            <TrendChart
              points={weekRows.map((r) => ({ label: `W${r.week.weekNumber}`, value: r.avg }))}
              reference={standing?.avgScore ?? null}
              referenceLabel="Season avg"
            />
          </div>
        </section>

        {/* ================================================ weekly results */}
        <section>
          <SectionHead
            overline="Game by game"
            title="Weekly Results"
            href="/schedule"
            hrefLabel="Full schedule"
          />
          <div className="panel overflow-hidden divide-y divide-line">
            {weekRows.map((row) => (
              <div
                key={row.week.id}
                className={row.state === "current" ? "bg-panel-2" : row.bye ? "opacity-70" : ""}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 bg-ink-2 border-b border-line">
                  <span className="display text-[1rem] text-cream">Week {row.week.weekNumber}</span>
                  <span className="text-[0.76rem] text-muted-2 num">{fmtDate(row.week.date)}</span>
                  <span className="flex-1" />
                  {row.bye ? (
                    <span className="badge badge-bye">Bye week</span>
                  ) : row.played > 0 ? (
                    <>
                      <span className="badge">
                        {row.wins}W · {row.losses}L{row.ties ? ` · ${row.ties}T` : ""}
                      </span>
                      <span className="badge">{fmtInt(row.pins)} pins</span>
                      <span className="badge">{fmtAvg(row.avg, 0)} avg</span>
                    </>
                  ) : (
                    <span className="badge">
                      {row.state === "current" ? "Bowling tonight" : "Scheduled"}
                    </span>
                  )}
                </div>

                {row.bye ? null : (
                  <ul className="divide-y divide-line">
                    {row.games.map((g) => (
                      <li key={g.game} className="flex items-center gap-2.5 px-3.5 py-1.5">
                        <span className="flex-none overline w-7">G{g.game}</span>
                        <span
                          className={[
                            "flex-none pip w-[1.05rem]",
                            g.result ? `pip-${g.result}` : "opacity-40",
                          ].join(" ")}
                        >
                          {g.result ?? "·"}
                        </span>
                        <span className="flex-none text-[0.72rem] text-muted-2 uppercase tracking-wider">
                          vs
                        </span>
                        <Link
                          href={g.opponent ? `/teams/${g.opponent.id}` : "#"}
                          className="flex-1 min-w-0 flex items-center gap-1.5 hover:text-cream transition-colors"
                        >
                          <Crest team={g.opponent} size={18} />
                          <span className="truncate text-[0.85rem]">
                            {g.opponent?.name ?? "TBD"}
                          </span>
                        </Link>
                        <span className="flex-none num text-[0.85rem] w-20 text-right">
                          {g.played ? (
                            <>
                              <span className={g.result === "W" ? "text-cream font-semibold" : ""}>
                                {g.score}
                              </span>
                              <span className="text-muted-2 mx-1">–</span>
                              <span
                                className={
                                  g.result === "L" ? "text-cream font-semibold" : "text-muted-2"
                                }
                              >
                                {g.opponentScore}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-2">—</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
