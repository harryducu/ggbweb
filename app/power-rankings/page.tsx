import { readLeague } from "@/lib/store";
import { computePowerRankings } from "@/lib/stats";
import { PowerRankRow } from "@/components/power-rows";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Power Rankings" };

export default async function PowerRankingsPage() {
  const league = await readLeague();
  const rows = computePowerRankings(league);

  const movers = rows.filter((r) => r.movement !== 0);
  const biggestRiser = [...movers].sort((a, b) => b.movement - a.movement)[0];
  const biggestFaller = [...movers].sort((a, b) => a.movement - b.movement)[0];

  return (
    <div className="wrap">
      <PageTitle
        overline={`Week ${league.settings.currentWeek} · Commissioner's take`}
        title="Power Rankings"
        lede="Not the standings. This is the commissioner's read on who is actually rolling well right now — record, pins, and the eye test."
        right={
          <div className="flex gap-2 pb-1">
            {biggestRiser && biggestRiser.movement > 0 ? (
              <span className="badge badge-up">
                ▲ {biggestRiser.team.abbreviation} +{biggestRiser.movement}
              </span>
            ) : null}
            {biggestFaller && biggestFaller.movement < 0 ? (
              <span className="badge badge-down">
                ▼ {biggestFaller.team.abbreviation} {biggestFaller.movement}
              </span>
            ) : null}
          </div>
        }
      />

      <div className="py-6 md:py-8">
        <div className="panel overflow-hidden">
          <div className="panel-head">
            <span className="overline">Rank · Team · Record · Pins · Power score</span>
            <span className="overline hidden sm:block">Movement vs. last week</span>
          </div>
          {rows.map((row) => (
            <PowerRankRow key={row.team.id} row={row} />
          ))}
        </div>

        <p className="hint mt-3 max-w-2xl">
          Power score and movement are set by hand from{" "}
          <span className="text-muted">Commissioner → Power Rankings</span>. They are deliberately
          subjective — argue about them in the group chat, not with the website.
        </p>
      </div>
    </div>
  );
}
