import Link from "next/link";
import { notFound } from "next/navigation";
import { readLeague } from "@/lib/store";
import {
  boxScore,
  computePlayerStats,
  computeStandings,
  findGame,
  fmtAvg,
  fmtDate,
  fmtInt,
  fmtRecord,
  weekGames,
  type BoxScoreSide,
} from "@/lib/stats";
import { GameGroups } from "@/components/match-blocks";
import { Avatar, Crest, SectionHead } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await readLeague();
  const found = findGame(league, id);
  if (!found) return { title: "Box score" };
  const { week, matchup } = found;
  const t1 = league.teams.find((t) => t.id === matchup.team1Id);
  const t2 = league.teams.find((t) => t.id === matchup.team2Id);
  return {
    title: `${t1?.abbreviation ?? "TBD"} vs ${t2?.abbreviation ?? "TBD"} · Week ${week.weekNumber}`,
  };
}

const RESULT_LABEL = { W: "Won", L: "Lost", T: "Tied" } as const;

export default async function GameBoxScore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await readLeague();

  const found = findGame(league, id);
  if (!found) notFound();
  const { week, matchup } = found;

  const box = boxScore(league, week, matchup);
  const standings = computeStandings(league);
  const records = new Map(standings.map((s) => [s.team.id, fmtRecord(s)]));
  const seasonAvg = new Map(computePlayerStats(league).map((s) => [s.player.id, s.average]));

  const { side1, side2, resolved } = box;
  const scoreClass = (side: BoxScoreSide) =>
    side.result === "W" || !resolved.played ? "text-cream" : "text-muted-2";

  return (
    <div className="wrap">
      {/* ==================================================== game scoreline */}
      <header className="pt-8 md:pt-10 pb-6 border-b border-line">
        <Link href={`/schedule#week-${week.weekNumber}`} className="section-link">
          ← Week {week.weekNumber} schedule
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="overline text-red">
            Week {week.weekNumber} · Game {matchup.game}
          </span>
          <span className="badge">{fmtDate(week.date)}</span>
          {resolved.played ? (
            <span className="badge badge-final">{resolved.tie ? "Tied" : "Final"}</span>
          ) : (
            <span className="badge badge-bye">Not bowled yet</span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5">
          <HeroSide side={side1} record={records.get(side1.team?.id ?? "")} />
          <div className="flex-none flex items-baseline gap-2 sm:gap-3 font-display italic font-extrabold num text-[clamp(1.6rem,8vw,3.2rem)] leading-none">
            <span className={scoreClass(side1)}>{resolved.team1Score ?? "—"}</span>
            <span className="text-muted-2 text-[0.5em] not-italic">—</span>
            <span className={scoreClass(side2)}>{resolved.team2Score ?? "—"}</span>
          </div>
          <HeroSide side={side2} record={records.get(side2.team?.id ?? "")} align="right" />
        </div>
      </header>

      <div className="py-6 md:py-8 space-y-9">
        {/* ====================================================== box score */}
        <section>
          <SectionHead overline="Box score" title="Who bowled what" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SidePanel
              side={side1}
              highScore={box.highScore}
              seasonAvg={seasonAvg}
              game={matchup.game}
            />
            <SidePanel
              side={side2}
              highScore={box.highScore}
              seasonAvg={seasonAvg}
              game={matchup.game}
            />
          </div>
          <p className="hint mt-2">
            Score is this game only. “Night” is the bowler&apos;s three-game series on the same
            Monday; “Avg” is their season average.
          </p>
        </section>

        {/* =============================================== rest of the night */}
        <section>
          <SectionHead
            overline={`Week ${week.weekNumber}`}
            title="The rest of the night"
            href={`/schedule#week-${week.weekNumber}`}
            hrefLabel="Week on the schedule"
          />
          <div className="panel overflow-hidden">
            <GameGroups
              groups={weekGames(league, week)}
              dense
              records={records}
              currentId={matchup.id}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/** A team's half of the scoreline: crest, name, season record. */
function HeroSide({
  side,
  record,
  align = "left",
}: {
  side: BoxScoreSide;
  record?: string;
  align?: "left" | "right";
}) {
  const team = side.team;
  const right = align === "right";
  return (
    <div className={`min-w-0 ${right ? "text-right" : ""}`}>
      <div className={`flex items-center gap-2 min-w-0 ${right ? "flex-row-reverse" : ""}`}>
        <Crest team={team} size={28} />
        {team ? (
          <Link
            href={`/teams/${team.id}`}
            className="min-w-0 flex items-center min-h-9 hover:text-red transition-colors"
          >
            <span className="display text-[clamp(0.95rem,3.2vw,1.5rem)] text-cream truncate">
              {team.name}
            </span>
          </Link>
        ) : (
          <span className="display text-[clamp(0.95rem,3.2vw,1.5rem)] truncate">TBD</span>
        )}
      </div>
      <div className={`mt-1.5 flex flex-wrap gap-1.5 ${right ? "justify-end" : ""}`}>
        {record ? <span className="badge">{record}</span> : null}
        {side.result ? (
          <span
            className={`badge ${side.result === "W" ? "badge-up" : side.result === "L" ? "badge-down" : ""}`}
          >
            {RESULT_LABEL[side.result]}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** One team's bowlers in this game. */
function SidePanel({
  side,
  highScore,
  seasonAvg,
  game,
}: {
  side: BoxScoreSide;
  highScore: number | null;
  seasonAvg: Map<string, number | null>;
  game: number;
}) {
  const color = side.team?.color ?? "#3a3a44";
  const entered = side.lines.reduce((n, l) => n + (l.score ?? 0), 0);

  return (
    <div className="panel overflow-hidden" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
      <div className="panel-head">
        <div className="flex items-center gap-2 min-w-0">
          <Crest team={side.team} size={20} />
          {side.team ? (
            <Link
              href={`/teams/${side.team.id}`}
              className="min-w-0 flex items-center min-h-9 hover:text-red transition-colors"
            >
              <span className="display text-[1.02rem] text-cream truncate">{side.team.name}</span>
            </Link>
          ) : (
            <span className="display text-[1.02rem] truncate">TBD</span>
          )}
        </div>
        <span className="display num text-[1.3rem] leading-none text-cream flex-none">
          {fmtInt(side.score)}
        </span>
      </div>

      {side.lines.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted">
          No bowlers are assigned to this team yet.
        </p>
      ) : !side.fromPlayers ? (
        <p className="px-3.5 py-6 text-center text-sm text-muted">
          Individual scores for game {game} haven&apos;t been entered. The team total above came
          from the commissioner&apos;s entry.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="stat">
            <thead>
              <tr>
                <th className="left">Bowler</th>
                <th>Score</th>
                <th>X</th>
                <th>Night</th>
                <th>Avg</th>
              </tr>
            </thead>
            <tbody>
              {side.lines.map((l) => {
                const best = l.score !== null && highScore !== null && l.score === highScore;
                return (
                  <tr key={l.player.id} className={l.score === null ? "opacity-60" : ""}>
                    <td className="key left">
                      <Link
                        href={`/players/${l.player.id}`}
                        className="inline-flex items-center gap-2 min-w-0 hover:text-cream transition-colors"
                      >
                        <Avatar player={l.player} size={24} />
                        <span className="truncate">{l.player.name}</span>
                      </Link>
                    </td>
                    <td
                      className={`num font-semibold ${best ? "text-gold" : l.score === null ? "dim" : "text-cream"}`}
                      title={best ? "High game of this matchup" : undefined}
                    >
                      {l.score ?? "—"}
                    </td>
                    <td className="dim">{l.strikes ?? "—"}</td>
                    <td className="num">{fmtInt(l.nightTotal)}</td>
                    <td className="dim num">{fmtAvg(seasonAvg.get(l.player.id) ?? null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {side.fromPlayers ? (
        <div className="flex items-center gap-2 px-3.5 py-2 border-t border-line bg-ink-2">
          <span className="overline">Team total</span>
          <span className="flex-1" />
          <span className="num text-[0.9rem] font-semibold text-cream">{fmtInt(entered)}</span>
        </div>
      ) : null}
    </div>
  );
}
