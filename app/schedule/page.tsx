import Link from "next/link";
import { readLeague } from "@/lib/store";
import {
  fmtAvg,
  fmtDate,
  fmtInt,
  findTeam,
  weekGames,
  weekState,
  weekTeamSummaries,
  type WeekState,
} from "@/lib/stats";
import { GameResult, NightLine } from "@/components/match-blocks";
import { Crest, PageTitle } from "@/components/ui";
import type { League, Week } from "@/lib/types";

export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const league = await readLeague();
  const weeks = [...league.weeks].sort((a, b) => a.weekNumber - b.weekNumber);

  return (
    <div className="wrap">
      <PageTitle
        overline={`${league.settings.season} · Regular season`}
        title="Schedule"
        lede={`${league.teams.length} teams over ${weeks.length} weeks. Six teams bowl each Monday while one sits a bye, and every bowling team plays three different opponents — one game against each.`}
        right={
          <nav aria-label="Jump to week" className="flex flex-wrap gap-1.5 pb-1">
            {weeks.map((w) => {
              const state = weekState(league, w);
              return (
                <Link
                  key={w.id}
                  href={`#week-${w.weekNumber}`}
                  className={[
                    "badge hover:text-cream",
                    state === "current"
                      ? "badge-live"
                      : state === "complete"
                        ? ""
                        : state === "unrecorded"
                          ? "badge-bye"
                          : "text-muted-2",
                  ].join(" ")}
                >
                  W{w.weekNumber}
                </Link>
              );
            })}
          </nav>
        }
      />

      <div className="py-6 md:py-8 space-y-7">
        {weeks.map((week) => (
          <WeekBlock key={week.id} league={league} week={week} />
        ))}
      </div>
    </div>
  );
}

const STATE_LABEL: Record<WeekState, string> = {
  complete: "Final",
  unrecorded: "Scores not in",
  current: "This week",
  upcoming: "Upcoming",
};

function WeekBlock({ league, week }: { league: League; week: Week }) {
  const state = weekState(league, week);
  const groups = weekGames(league, week);
  const summaries = weekTeamSummaries(league, week);
  const bye = week.byeTeamId ? findTeam(league, week.byeTeamId) : undefined;

  const totalGames = groups.reduce((n, g) => n + g.matchups.length, 0);
  const bowled = groups.reduce((n, g) => n + g.matchups.filter((m) => m.played).length, 0);

  return (
    <section
      id={`week-${week.weekNumber}`}
      className={[
        "panel scroll-mt-20 overflow-hidden",
        // The current week gets a red spine and lifted contrast; everything
        // else stays quiet so the eye lands on tonight first.
        state === "current" ? "border-red/45 bg-panel-2" : "",
        state === "upcoming" ? "opacity-[0.9]" : "",
      ].join(" ")}
      style={state === "current" ? { boxShadow: "inset 3px 0 0 var(--color-red)" } : undefined}
    >
      <div className="panel-head flex-wrap">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="display text-[1.4rem] text-cream">Week {week.weekNumber}</h2>
          <span className="text-[0.8rem] text-muted num">{fmtDate(week.date)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {bye ? (
            <span className="badge badge-bye">
              <Crest team={bye} size={13} /> Bye: {bye.name}
            </span>
          ) : null}
          <span className="badge">
            {bowled}/{totalGames} games
          </span>
          <span
            className={[
              "badge",
              state === "current"
                ? "badge-live"
                : state === "complete"
                  ? "badge-final"
                  : state === "unrecorded"
                    ? "badge-bye"
                    : "",
            ].join(" ")}
          >
            {STATE_LABEL[state]}
          </span>
        </div>
      </div>

      {week.notes ? (
        <p className="px-3.5 py-2.5 text-[0.85rem] text-muted border-b border-line bg-ink-2 italic">
          {week.notes}
        </p>
      ) : null}

      {/* Three games, three columns — the same shape as the commissioner's sheet. */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
        {groups.map((group) => (
          <div key={group.game}>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-ink-2 border-b border-line">
              <span className="overline">Game {group.game}</span>
              <span className="flex-1 h-px bg-line" />
              <span className="overline">
                {group.matchups.filter((m) => m.played).length}/{group.matchups.length}
              </span>
            </div>
            {group.matchups.map((r) => (
              <GameResult key={r.matchup.id} r={r} dense />
            ))}
          </div>
        ))}
      </div>

      {/* Night summary only once there's something to summarise. */}
      {bowled > 0 ? (
        <details className="border-t border-line group">
          <summary className="px-3.5 py-2 cursor-pointer select-none flex items-center gap-2 hover:bg-white/[0.03] transition-colors">
            <span className="section-link">Week {week.weekNumber} team totals</span>
            <span className="text-muted-2 text-[0.7rem] group-open:rotate-90 transition-transform">
              ▶
            </span>
          </summary>
          <div className="border-t border-line">
            <div className="flex items-center gap-2 px-3 py-1 bg-ink-2 border-b border-line">
              <span className="overline">Team</span>
              <span className="flex-1" />
              <span className="overline w-14 text-right">W–L</span>
              <span className="overline w-16 text-right">Pins</span>
              <span className="overline w-14 text-right hidden sm:block">Avg</span>
            </div>
            {summaries.map((night) => (
              <div key={night.team?.id} className="flex items-center">
                <div className="flex-1 min-w-0">
                  <NightLine
                    team={night.team}
                    wins={night.wins}
                    losses={night.losses}
                    ties={night.ties}
                    pins={night.pins}
                  />
                </div>
                <span className="hidden sm:block w-14 pr-3 text-right num text-[0.76rem] text-muted-2">
                  {fmtAvg(night.avg, 0)}
                </span>
              </div>
            ))}
            {bye ? (
              <div className="px-3 py-1.5 border-t border-line flex items-center gap-2.5">
                <Crest team={bye} size={18} />
                <span className="flex-1 text-[0.84rem] text-muted-2">{bye.name}</span>
                <span className="badge badge-bye">Bye week</span>
              </div>
            ) : null}
            <div className="px-3 py-1.5 border-t border-line text-right">
              <span className="overline">
                Week total {fmtInt(summaries.reduce((n, s) => n + s.pins, 0))} pins
              </span>
            </div>
          </div>
        </details>
      ) : null}
    </section>
  );
}
