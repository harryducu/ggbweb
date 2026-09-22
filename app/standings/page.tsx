import { readLeague } from "@/lib/store";
import { computeStandings, fmtAvg, fmtInt } from "@/lib/stats";
import { StandingsTable } from "@/components/standings-table";
import { PageTitle, StatLine, StatRow } from "@/components/ui";

export const metadata = { title: "Standings" };

export default async function StandingsPage() {
  const league = await readLeague();
  const standings = computeStandings(league);

  const played = standings.reduce((n, s) => n + s.games, 0) / 2;
  const pins = standings.reduce((n, s) => n + s.totalPins, 0);
  const avg = played > 0 ? pins / (played * 2) : null;
  const best = [...standings].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))[0];

  return (
    <div className="wrap">
      <PageTitle
        overline="League table"
        title="Standings"
        lede={`Every game of every Monday night counts on its own. ${league.settings.pointsPerWin} points for a win, ${league.settings.pointsPerTie} for a tie. Ties in the table break on total pins.`}
      />

      <div className="py-6 md:py-8 space-y-8">
        <StatRow>
          <StatLine label="Games bowled" value={fmtInt(played)} />
          <StatLine label="Total pins" value={fmtInt(pins)} />
          <StatLine label="League avg / game" value={fmtAvg(avg, 0)} />
          <StatLine
            label="Best team avg"
            value={best?.avgScore ? `${fmtAvg(best.avgScore, 0)} ${best.team.abbreviation}` : "—"}
          />
        </StatRow>

        <div className="panel overflow-hidden">
          <StandingsTable standings={standings} playoffLine={league.playoffs.qualifiers} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Legend
            title="Points"
            body={`Win = ${league.settings.pointsPerWin} pts. Tie = ${league.settings.pointsPerTie} pt. Loss = 0. A bye week is not a loss.`}
          />
          <Legend
            title="Win %"
            body="Wins plus half of ties, divided by games bowled. Byes are excluded."
          />
          <Legend
            title="Form"
            body="Each game bowled this season, oldest on the left. Three pips get added every Monday a team bowls."
          />
        </div>
      </div>
    </div>
  );
}

function Legend({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel p-3.5">
      <div className="overline text-muted">{title}</div>
      <p className="hint mt-1.5">{body}</p>
    </div>
  );
}
