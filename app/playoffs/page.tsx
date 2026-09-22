import Link from "next/link";
import { readLeague } from "@/lib/store";
import { computeStandings, fmtInt, fmtRecord, resolvePlayoffs } from "@/lib/stats";
import { JoinElbow, JoinStraight, SeriesCard } from "@/components/bracket";
import { Crest, PageTitle } from "@/components/ui";
import type { Team } from "@/lib/types";

export const metadata = { title: "Playoffs" };

export default async function PlayoffsPage() {
  const league = await readLeague();
  const standings = computeStandings(league);
  const resolved = resolvePlayoffs(league);
  const qualifiers = league.playoffs.qualifiers;

  const seedOf = (team: Team | undefined): number | null => {
    if (!team) return null;
    const rank = standings.find((s) => s.team.id === team.id)?.rank;
    return rank && rank <= qualifiers ? rank : null;
  };

  const playIn = resolved.filter((r) => r.series.round === "playin");
  const semis = resolved.filter((r) => r.series.round === "semifinal");
  const final = resolved.find((r) => r.series.round === "final");
  const champion = league.playoffs.championId
    ? standings.find((s) => s.team.id === league.playoffs.championId)?.team
    : final?.winner;

  if (!league.playoffs.enabled) {
    return (
      <div className="wrap">
        <PageTitle overline="Postseason" title="Playoffs" />
        <p className="py-10 text-muted text-sm">
          The playoff bracket is turned off. Enable it from Commissioner → Manage Playoffs.
        </p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <PageTitle
        overline={`${league.settings.season} · Postseason`}
        title="Playoff Bracket"
        lede={`Top ${qualifiers} of ${league.teams.length} teams qualify. Seeds 1 and 2 skip the play-in round and wait in the semifinals. Single elimination from there.`}
        right={
          champion ? (
            <span className="badge badge-bye pb-1">🏆 {champion.name}</span>
          ) : (
            <span className="badge pb-1">Seeds set by final standings</span>
          )
        }
      />

      <div className="py-7 md:py-9 space-y-9">
        {/* ========================================================= bracket */}
        <section>
          <div className="hidden lg:grid grid-cols-5 gap-x-0 mb-2 overline text-center">
            <span>Play-in</span>
            <span />
            <span>Semifinals</span>
            <span />
            <span>Championship</span>
          </div>

          <div
            className="grid grid-cols-1 gap-y-8 lg:gap-y-0 lg:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)_3rem_minmax(0,1fr)]"
            style={{ minHeight: "22rem" }}
          >
            {/* play-in round */}
            <div className="flex flex-col justify-around gap-6 lg:gap-0">
              <div className="lg:hidden overline">Play-in</div>
              {playIn.map((r) => (
                <SeriesCard key={r.series.id} resolved={r} seedOf={seedOf} />
              ))}
            </div>

            <JoinStraight at={["25%", "75%"]} />

            {/* semifinals */}
            <div className="flex flex-col justify-around gap-6 lg:gap-0">
              <div className="lg:hidden overline">Semifinals</div>
              {semis.map((r) => (
                <SeriesCard key={r.series.id} resolved={r} seedOf={seedOf} />
              ))}
            </div>

            <JoinElbow />

            {/* final + champion */}
            <div className="flex flex-col justify-center gap-4">
              <div className="lg:hidden overline">Championship</div>
              {final ? <SeriesCard resolved={final} seedOf={seedOf} highlight /> : null}

              <div
                className={[
                  "panel px-3.5 py-3 text-center",
                  champion ? "border-gold/60 bg-gold/[0.07]" : "border-dashed",
                ].join(" ")}
              >
                <div className="overline text-gold">Champion</div>
                {champion ? (
                  <Link
                    href={`/teams/${champion.id}`}
                    className="mt-1.5 inline-flex items-center gap-2.5 hover:opacity-85 transition-opacity"
                  >
                    <Crest team={champion} size={34} />
                    <span className="display text-[1.2rem] text-cream">{champion.name}</span>
                  </Link>
                ) : (
                  <div className="mt-1.5 display text-[1.15rem] text-muted-2">To be decided</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= seeding */}
        <section>
          <div className="section-head">
            <div>
              <div className="overline">Current seeding</div>
              <h2 className="display">If the season ended today</h2>
            </div>
            <Link href="/standings" className="section-link">
              Standings →
            </Link>
          </div>

          <div className="panel overflow-hidden">
            <div className="table-scroll">
              <table className="stat">
                <thead>
                  <tr>
                    <th className="left w-10">Seed</th>
                    <th className="left">Team</th>
                    <th>Record</th>
                    <th>Pts</th>
                    <th>Pins</th>
                    <th className="left pl-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => {
                    const inField = s.rank <= qualifiers;
                    const bye = s.rank <= 2;
                    return (
                      <tr
                        key={s.team.id}
                        className={`team-bar ${inField ? "" : "opacity-55"} ${s.rank === qualifiers ? "border-b-2 !border-b-red/50" : ""}`}
                        style={{ ["--team" as string]: s.team.color }}
                      >
                        <td className="num">
                          {inField ? (
                            <span
                              className="rank !w-6 !h-6 !text-[0.8rem]"
                              data-medal={s.rank <= 3 ? String(s.rank) : undefined}
                            >
                              {s.rank}
                            </span>
                          ) : (
                            <span className="dim">—</span>
                          )}
                        </td>
                        <td className="key left">
                          <Link
                            href={`/teams/${s.team.id}`}
                            className="inline-flex items-center gap-2 hover:text-cream transition-colors"
                          >
                            <Crest team={s.team} size={22} />
                            <span className="truncate">{s.team.name}</span>
                          </Link>
                        </td>
                        <td className="num">{fmtRecord(s)}</td>
                        <td className="num font-semibold text-cream">{s.points}</td>
                        <td className="num dim">{fmtInt(s.totalPins)}</td>
                        <td className="left pl-4">
                          {bye ? (
                            <span className="badge badge-bye">Semifinal bye</span>
                          ) : inField ? (
                            <span className="badge">Play-in round</span>
                          ) : (
                            <span className="badge badge-final">Outside the field</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="hint mt-2">
            Seeds resolve automatically from the standings. Enter playoff scores from Commissioner →
            Manage Playoffs and the bracket advances on its own.
          </p>
        </section>
      </div>
    </div>
  );
}
