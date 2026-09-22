import Link from "next/link";
import { readLeague } from "@/lib/store";
import {
  computePlayerStats,
  computePowerRankings,
  computeStandings,
  fmtAvg,
  fmtInt,
  fmtRecord,
  standingFor,
} from "@/lib/stats";
import { Avatar, Crest, PageTitle } from "@/components/ui";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  const league = await readLeague();
  const standings = computeStandings(league);
  const power = computePowerRankings(league);
  const playerStats = computePlayerStats(league);

  // Ordered by the table, so the page doubles as an at-a-glance hierarchy.
  const ordered = standings.map((s) => s.team);

  return (
    <div className="wrap">
      <PageTitle
        overline={`${league.teams.length} teams · ${league.settings.playersPerTeam} bowlers each`}
        title="Teams"
        lede="Rosters, records, and season pin totals. Teams are listed in standings order."
      />

      <div className="py-6 md:py-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((team) => {
          const standing = standingFor(standings, team.id);
          const powerRow = power.find((p) => p.team.id === team.id);
          const roster = playerStats
            .filter((s) => s.team?.id === team.id)
            .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

          return (
            <article key={team.id} className="panel overflow-hidden flex flex-col">
              {/* Header carries the team color so cards stay distinguishable. */}
              <Link
                href={`/teams/${team.id}`}
                className="relative flex items-center gap-3 px-3.5 py-3 border-b border-line group"
                style={{
                  background: `linear-gradient(100deg, ${team.color}2e 0%, ${team.color}0d 45%, transparent 75%)`,
                  boxShadow: `inset 3px 0 0 ${team.color}`,
                }}
              >
                <Crest team={team} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block display text-[1.15rem] text-cream truncate group-hover:text-white transition-colors">
                    {team.name}
                  </span>
                  <span className="block overline mt-0.5">
                    {standing ? `${standing.rank} in table` : "Unranked"} · Power{" "}
                    {powerRow?.position ?? "—"}
                  </span>
                </span>
                <span className="flex-none text-right">
                  <span className="block display num text-[1.5rem] leading-none text-cream">
                    {fmtRecord(standing)}
                  </span>
                  <span className="block overline mt-0.5">Record</span>
                </span>
              </Link>

              <ul className="divide-y divide-line flex-1">
                {roster.map((s) => (
                  <li key={s.player.id}>
                    <Link
                      href={`/players/${s.player.id}`}
                      className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/[0.03] transition-colors"
                    >
                      <Avatar player={s.player} size={26} />
                      <span className="flex-1 min-w-0 truncate text-[0.88rem]">
                        {s.player.name}
                      </span>
                      <span className="flex-none num text-[0.82rem] text-muted">
                        {fmtAvg(s.average)}
                      </span>
                      <span className="flex-none num text-[0.82rem] text-muted-2 w-12 text-right">
                        {fmtInt(s.totalScore)}
                      </span>
                    </Link>
                  </li>
                ))}
                {roster.length === 0 ? (
                  <li className="px-3.5 py-6 text-center text-sm text-muted">
                    No bowlers assigned yet.
                  </li>
                ) : null}
              </ul>

              <dl className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
                <Mini label="Points" value={fmtInt(standing?.points ?? 0)} />
                <Mini label="Total pins" value={fmtInt(standing?.totalPins ?? 0)} />
                <Mini label="Team avg" value={fmtAvg(standing?.avgScore ?? null, 0)} />
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2">
      <dd className="display num text-[1.05rem] leading-none text-cream">{value}</dd>
      <dt className="overline mt-1">{label}</dt>
    </div>
  );
}
