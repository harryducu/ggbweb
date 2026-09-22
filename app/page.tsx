import Link from "next/link";
import { readLeague } from "@/lib/store";
import {
  computePlayerStats,
  computePowerRankings,
  computeStandings,
  fmtDate,
  fmtInt,
  findTeam,
  lastPlayedWeek,
  nextUnplayedWeek,
  topBowlers,
  weekByNumber,
  weekGames,
  weekState,
  weekTeamSummaries,
} from "@/lib/stats";
import { GameGroups, NightLine } from "@/components/match-blocks";
import { StandingsTable } from "@/components/standings-table";
import { PowerRankRow } from "@/components/power-rows";
import { TopBowlers } from "@/components/top-bowlers";
import { Crest, SectionHead } from "@/components/ui";

export default async function HomePage() {
  const league = await readLeague();
  const standings = computeStandings(league);
  const power = computePowerRankings(league);
  const playerStats = computePlayerStats(league);
  const leaders = topBowlers(playerStats, 5, "total");

  const currentWeek = weekByNumber(league, league.settings.currentWeek) ?? nextUnplayedWeek(league);
  const previousWeek =
    (currentWeek ? weekByNumber(league, currentWeek.weekNumber - 1) : undefined) ??
    lastPlayedWeek(league);

  const thisWeekGames = currentWeek ? weekGames(league, currentWeek) : [];
  const lastWeekGames = previousWeek ? weekGames(league, previousWeek) : [];
  const lastWeekTeams = previousWeek ? weekTeamSummaries(league, previousWeek) : [];
  const lastWeekPlayed = lastWeekGames.some((g) => g.matchups.some((m) => m.played));
  // Bowled, but no game-level scores entered. Show who played rather than
  // claiming there were no results.
  const lastWeekAwaitingScores =
    !lastWeekPlayed &&
    previousWeek !== undefined &&
    weekState(league, previousWeek) === "unrecorded";

  const currentBye = currentWeek?.byeTeamId ? findTeam(league, currentWeek.byeTeamId) : undefined;
  const lastBye = previousWeek?.byeTeamId ? findTeam(league, previousWeek.byeTeamId) : undefined;

  const leader = standings[0];
  const pinLeader = [...standings].sort((a, b) => b.totalPins - a.totalPins)[0];
  const topBowler = leaders[0];

  return (
    <>
      {/* ================================================== week scoreboard */}
      <section className="border-b border-line bg-ink-2">
        <div className="wrap py-7 md:py-9">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <div className="overline text-red">{league.settings.season} · Monday Night</div>
              <h1 className="display text-[clamp(2.4rem,9vw,4.5rem)] mt-1">
                Week {currentWeek?.weekNumber ?? league.settings.currentWeek}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <span className="badge badge-live">In progress</span>
              <span className="badge">{fmtDate(currentWeek?.date ?? null)}</span>
              {currentBye ? (
                <span className="badge badge-bye">
                  <Crest team={currentBye} size={14} /> {currentBye.name} on bye
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* ------------------------------------------------- last week */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <span className="overline">Last week</span>
                  <span className="ml-2 display text-[1.05rem] text-cream">
                    Week {previousWeek?.weekNumber ?? "—"}
                  </span>
                </div>
                {lastBye ? (
                  <span className="badge badge-bye">Bye: {lastBye.abbreviation}</span>
                ) : null}
              </div>
              {lastWeekPlayed ? (
                <>
                  {/* Night record first — the fastest read of who had a good
                      Monday — then every individual game underneath. */}
                  <div className="flex items-center gap-2 px-3 py-1 bg-ink-2 border-b border-line">
                    <span className="overline">Team</span>
                    <span className="flex-1" />
                    <span className="overline w-14 text-right">W–L</span>
                    <span className="overline w-16 text-right">Pins</span>
                  </div>
                  {lastWeekTeams.map((night) => (
                    <NightLine
                      key={night.team?.id ?? night.week.id}
                      team={night.team}
                      wins={night.wins}
                      losses={night.losses}
                      ties={night.ties}
                      pins={night.pins}
                    />
                  ))}
                  <div className="px-3 py-2 border-t border-line">
                    <Link
                      href={`/schedule#week-${previousWeek?.weekNumber}`}
                      className="section-link"
                    >
                      All {lastWeekGames.reduce((n, g) => n + g.matchups.length, 0)} game results →
                    </Link>
                  </div>
                </>
              ) : lastWeekAwaitingScores ? (
                <>
                  <GameGroups groups={lastWeekGames} dense />
                  <p className="px-3 py-2 border-t border-line hint">
                    This week was bowled, but game-by-game scores haven&apos;t been entered. Records
                    and averages in the{" "}
                    <Link href="/standings" className="text-muted underline">
                      standings
                    </Link>{" "}
                    and{" "}
                    <Link href="/stats" className="text-muted underline">
                      stats
                    </Link>{" "}
                    are current.
                  </p>
                </>
              ) : (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  No results posted yet. Scores appear here the moment the commissioner enters them.
                </p>
              )}
            </div>

            {/* ------------------------------------------------- this week */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <span className="overline">This week</span>
                  <span className="ml-2 display text-[1.05rem] text-cream">
                    Week {currentWeek?.weekNumber ?? "—"}
                  </span>
                </div>
                <span className="badge">
                  {thisWeekGames.reduce((n, g) => n + g.matchups.length, 0)} games
                </span>
              </div>
              <GameGroups groups={thisWeekGames} dense />
              <div className="px-3 py-2 border-t border-line">
                <Link href="/schedule" className="section-link">
                  Full season schedule →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================== league leaders */}
      <section className="border-b border-line">
        <div className="wrap grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-line">
          <LeaderCell
            label="First place"
            value={leader?.games ? leader.team.name : "—"}
            sub={
              leader?.games
                ? `${leader.wins}–${leader.losses} · ${leader.points} pts`
                : "No games bowled"
            }
            color={leader?.games ? leader.team.color : undefined}
          />
          <LeaderCell
            label="Most pins"
            value={pinLeader?.totalPins ? pinLeader.team.name : "—"}
            sub={
              pinLeader?.totalPins ? `${fmtInt(pinLeader.totalPins)} total pins` : "No games bowled"
            }
            color={pinLeader?.totalPins ? pinLeader.team.color : undefined}
          />
          <LeaderCell
            label="Top bowler"
            value={topBowler ? topBowler.player.name : "—"}
            sub={
              topBowler
                ? `${fmtInt(topBowler.totalScore)} pins · ${topBowler.team?.abbreviation ?? ""}`
                : "No games bowled"
            }
            color={topBowler?.team?.color}
            href={topBowler ? `/players/${topBowler.player.id}` : undefined}
          />
          <LeaderCell
            label="Power #1"
            value={power[0]?.team.name ?? "—"}
            sub={
              power[0]?.score !== null && power[0]?.score !== undefined
                ? `Power score ${power[0].score}`
                : "Score not set"
            }
            color={power[0]?.team.color}
            href="/power-rankings"
          />
        </div>
      </section>

      <div className="wrap py-10 md:py-12 space-y-12 md:space-y-14">
        {/* ==================================================== standings */}
        <section>
          <SectionHead
            overline="League table"
            title="Standings"
            href="/standings"
            hrefLabel="Full standings"
          />
          <div className="panel overflow-hidden">
            <StandingsTable
              standings={standings}
              compact
              playoffLine={league.playoffs.qualifiers}
            />
          </div>
          <p className="hint mt-2">
            Red line marks the playoff cut — top {league.playoffs.qualifiers} of{" "}
            {league.teams.length} teams advance.
          </p>
        </section>

        {/* =============================================== power rankings */}
        <section>
          <SectionHead
            overline="Commissioner's take"
            title="Power Rankings"
            href="/power-rankings"
            hrefLabel="All notes"
          />
          <div className="panel overflow-hidden">
            {power.slice(0, 4).map((row) => (
              <PowerRankRow key={row.team.id} row={row} showNote={false} />
            ))}
          </div>
        </section>

        {/* ================================================= top bowlers */}
        <section className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
          <div>
            <SectionHead
              overline={`After week ${previousWeek?.weekNumber ?? "—"}`}
              title="Top 5 Bowlers"
              href="/stats"
              hrefLabel="All bowlers"
            />
            <div className="panel overflow-hidden">
              <TopBowlers rows={leaders} metric="total" />
            </div>
          </div>

          <div>
            <SectionHead overline="How it works" title="The Format" />
            <div className="panel p-4 md:p-5">
              <p className="text-[0.92rem] leading-relaxed text-muted">
                {league.settings.description}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
                <FormatItem label="Teams" value={String(league.teams.length)} />
                <FormatItem label="Bowlers" value={String(league.players.length)} />
                <FormatItem label="Games a night" value={String(league.settings.gamesPerNight)} />
                <FormatItem label="Regular season" value={`${league.weeks.length} weeks`} />
              </dl>
              <Link href="/rules" className="section-link inline-block mt-4">
                League rules →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function LeaderCell({
  label,
  value,
  sub,
  color,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
  href?: string;
}) {
  const body = (
    <div className="px-3 py-4 md:px-4 md:py-5 h-full">
      <div className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 flex-none rounded-[1px]"
          style={{ background: color ?? "#3a3a44" }}
          aria-hidden
        />
        <span className="overline">{label}</span>
      </div>
      <div className="display text-[clamp(1rem,3vw,1.35rem)] text-cream mt-1.5 truncate">
        {value}
      </div>
      <div className="text-[0.76rem] text-muted-2 num mt-0.5 truncate">{sub}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="hover:bg-white/[0.03] transition-colors">
      {body}
    </Link>
  ) : (
    body
  );
}

function FormatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="overline">{label}</dt>
      <dd className="display num text-[1.35rem] leading-none mt-0.5">{value}</dd>
    </div>
  );
}
