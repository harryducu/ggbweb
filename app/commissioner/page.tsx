import Link from "next/link";
import { readLeague } from "@/lib/store";
import {
  computePlayerStats,
  computeStandings,
  fmtDate,
  fmtInt,
  resolveWeek,
  weekByNumber,
} from "@/lib/stats";
import { Crest } from "@/components/ui";

export const metadata = { title: "Commissioner" };

export default async function CommissionerDashboard() {
  const league = await readLeague();
  const standings = computeStandings(league);
  const playerStats = computePlayerStats(league);

  const weeks = [...league.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const currentWeek = weekByNumber(league, league.settings.currentWeek);

  const weekProgress = weeks.map((w) => {
    const resolved = resolveWeek(league, w);
    return {
      week: w,
      total: resolved.length,
      bowled: resolved.filter((r) => r.played).length,
    };
  });

  const currentProgress = weekProgress.find((p) => p.week.id === currentWeek?.id);

  // Everything that still needs the commissioner's attention, most useful first.
  const todo = [
    {
      done: (currentProgress?.bowled ?? 0) >= (currentProgress?.total ?? 1),
      label: currentWeek
        ? `Enter week ${currentWeek.weekNumber} scores (${currentProgress?.bowled ?? 0} of ${currentProgress?.total ?? 0} games in)`
        : "Add weeks to the schedule",
      href: currentWeek
        ? `/commissioner/scores?week=${currentWeek.weekNumber}`
        : "/commissioner/schedule",
    },
    {
      done: league.teams.every((t) => t.powerRankingDescription.trim().length > 0),
      label: "Write a power ranking note for every team",
      href: "/commissioner/power-rankings",
    },
    {
      done: league.teams.every((t) => t.powerScore !== null),
      label: "Set a power score for every team",
      href: "/commissioner/power-rankings",
    },
    {
      done: league.teams.every((t) => t.logo !== null),
      label: `Upload team logos (${league.teams.filter((t) => t.logo).length} of ${league.teams.length} done)`,
      href: "/commissioner/teams",
    },
    {
      done: league.players.every((p) => p.photo !== null),
      label: `Upload player photos (${league.players.filter((p) => p.photo).length} of ${league.players.length} done)`,
      href: "/commissioner/players",
    },
    {
      done: !league.players.some((p) => /roster spot/i.test(p.name)),
      label: `Replace placeholder bowler names (${league.players.filter((p) => /roster spot/i.test(p.name)).length} left)`,
      href: "/commissioner/players",
    },
    {
      done: weeks.every((w) => w.date !== null),
      label: "Set a date for every week",
      href: "/commissioner/schedule",
    },
  ];

  const openItems = todo.filter((t) => !t.done);
  const totalPins = standings.reduce((n, s) => n + s.totalPins, 0);
  const bowledGames = weekProgress.reduce((n, p) => n + p.bowled, 0);
  const totalGames = weekProgress.reduce((n, p) => n + p.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-[1.6rem]">Dashboard</h2>
        <p className="hint mt-1 max-w-2xl">
          Everything on the public site is generated from what you enter here. Scores are the only
          thing you need to keep up with every week — the standings, averages, leaderboard and
          playoff seeds all follow from them.
        </p>
      </div>

      {/* --------------------------------------------------------- headline */}
      <div className="panel grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-line">
        <Metric
          label="Current week"
          value={`Week ${league.settings.currentWeek}`}
          sub={fmtDate(currentWeek?.date ?? null)}
        />
        <Metric
          label="Games entered"
          value={`${bowledGames}/${totalGames}`}
          sub="Across the season"
        />
        <Metric label="Pins bowled" value={fmtInt(totalPins)} sub="League total" />
        <Metric
          label="Leader"
          value={standings[0]?.games ? standings[0].team.abbreviation : "—"}
          sub={
            standings[0]?.games
              ? `${standings[0].wins}–${standings[0].losses}, ${standings[0].points} pts`
              : "No games yet"
          }
        />
      </div>

      {/* ------------------------------------------------------------- todo */}
      <section className="panel overflow-hidden">
        <div className="panel-head">
          <span className="overline">Still to do</span>
          <span className="badge">
            {openItems.length === 0 ? "All caught up" : `${openItems.length} open`}
          </span>
        </div>
        <ul className="divide-y divide-line">
          {todo.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.03] transition-colors"
              >
                <span
                  className={[
                    "flex-none grid place-items-center h-5 w-5 rounded-[1px] border text-[0.7rem]",
                    item.done ? "border-win/50 text-win bg-win/10" : "border-line-2 text-muted-2",
                  ].join(" ")}
                  aria-hidden
                >
                  {item.done ? "✓" : ""}
                </span>
                <span
                  className={[
                    "flex-1 min-w-0 text-[0.9rem]",
                    item.done ? "text-muted-2 line-through decoration-muted-2/50" : "",
                  ].join(" ")}
                >
                  {item.label}
                </span>
                <span className="flex-none section-link">Go →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------- week progress */}
      <section className="panel overflow-hidden">
        <div className="panel-head">
          <span className="overline">Season progress</span>
          <Link href="/commissioner/schedule" className="section-link">
            Manage schedule →
          </Link>
        </div>
        <div className="table-scroll">
          <table className="stat">
            <thead>
              <tr>
                <th className="left">Week</th>
                <th className="left">Date</th>
                <th className="left">Bye</th>
                <th>Games in</th>
                <th className="left pl-4">Status</th>
                <th className="left">Action</th>
              </tr>
            </thead>
            <tbody>
              {weekProgress.map(({ week, bowled, total }) => {
                const bye = league.teams.find((t) => t.id === week.byeTeamId);
                const isCurrent = week.weekNumber === league.settings.currentWeek;
                return (
                  <tr key={week.id} className={isCurrent ? "bg-red/[0.06]" : ""}>
                    <td className="key left">
                      Week {week.weekNumber}
                      {isCurrent ? <span className="badge badge-live ml-2">Now</span> : null}
                    </td>
                    <td className="left dim num">{fmtDate(week.date)}</td>
                    <td className="left">
                      {bye ? (
                        <span className="inline-flex items-center gap-1.5" title={bye.name}>
                          <Crest team={bye} size={16} />
                          <span className="text-[0.8rem] truncate max-w-[9rem]">{bye.name}</span>
                        </span>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </td>
                    <td className="num">
                      {bowled}/{total}
                    </td>
                    <td className="left pl-4">
                      {total === 0 ? (
                        <span className="badge badge-down">No matchups</span>
                      ) : bowled === total ? (
                        <span className="badge badge-up">Complete</span>
                      ) : bowled > 0 ? (
                        <span className="badge badge-bye">Partial</span>
                      ) : (
                        <span className="badge">Not started</span>
                      )}
                    </td>
                    <td className="left">
                      <Link
                        href={`/commissioner/scores?week=${week.weekNumber}`}
                        className="section-link"
                      >
                        Enter scores →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------ quick links */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <QuickCard
          href="/commissioner/scores"
          title="Enter this week's scores"
          body="The one task that keeps the whole site current."
        />
        <QuickCard
          href="/commissioner/power-rankings"
          title="Publish power rankings"
          body="Drag the order, set scores, write the weekly take."
        />
        <QuickCard
          href="/commissioner/players"
          title="Upload player photos"
          body="Photos make the Players page and profiles come alive."
        />
        <QuickCard
          href="/commissioner/teams"
          title="Upload team logos"
          body="Replaces the short-code plates across the site."
        />
        <QuickCard
          href="/commissioner/settings"
          title="League settings"
          body="Name, logo, season, current week, rules."
        />
        <QuickCard
          href="/commissioner/playoffs"
          title="Playoff bracket"
          body="Seeds come from the standings; you enter the scores."
        />
      </section>

      <p className="hint">
        {league.players.length} bowlers · {league.teams.length} teams · {weeks.length} weeks ·{" "}
        {playerStats.filter((s) => s.games > 0).length} bowlers with recorded games
      </p>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="px-3.5 py-3">
      <div className="overline">{label}</div>
      <div className="display num text-[1.45rem] leading-none mt-1 text-cream">{value}</div>
      <div className="hint num mt-0.5 truncate">{sub}</div>
    </div>
  );
}

function QuickCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="panel px-3.5 py-3 hover:border-line-2 transition-colors block">
      <div className="display text-[1rem] text-cream">{title}</div>
      <p className="hint mt-1">{body}</p>
    </Link>
  );
}
