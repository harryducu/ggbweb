import Link from "next/link";
import { readLeague } from "@/lib/store";
import { computePowerRankings, computeStandings, fmtRecord, standingFor } from "@/lib/stats";
import { PowerEditor, type PowerTeam } from "@/components/admin/power-editor";
import { ActionForm, FormStatus, SubmitBtn } from "@/components/admin/form-kit";
import { autoPowerRankingsAction } from "@/lib/actions";

export const metadata = { title: "Manage Power Rankings" };

export default async function PowerAdminPage() {
  const league = await readLeague();
  const standings = computeStandings(league);
  const rows = computePowerRankings(league);

  const teams: PowerTeam[] = rows.map((row) => {
    const standing = standingFor(standings, row.team.id);
    return {
      id: row.team.id,
      name: row.team.name,
      abbreviation: row.team.abbreviation,
      color: row.team.color,
      logo: row.team.logo,
      score: row.team.powerScore,
      movement: row.team.powerMovement,
      description: row.team.powerRankingDescription,
      record: fmtRecord(standing),
      pins: standing?.totalPins ?? 0,
      standingsRank: standing?.rank ?? 0,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="display text-[1.6rem]">Manage Power Rankings</h2>
        <p className="hint mt-1 max-w-2xl">
          The rankings are entirely yours — order, score and the written take. Nothing here is
          calculated unless you ask for it.{" "}
          <Link href="/power-rankings" className="text-muted underline">
            See the public page
          </Link>
          .
        </p>
      </div>

      <section className="panel p-3.5">
        <ActionForm action={autoPowerRankingsAction}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="overline">Start from the standings</div>
              <p className="hint mt-0.5">
                Reorders every team by points, then calculates each team's movement against the
                currently published order. Your written notes and power scores are kept.
              </p>
            </div>
            <SubmitBtn className="btn" pendingLabel="Rebuilding…">
              Rebuild from standings
            </SubmitBtn>
            <div className="w-full">
              <FormStatus />
            </div>
          </div>
        </ActionForm>
      </section>

      <PowerEditor teams={teams} />
    </div>
  );
}
