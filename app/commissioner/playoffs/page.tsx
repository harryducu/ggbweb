import Link from "next/link";
import { readLeague } from "@/lib/store";
import { computeStandings, resolvePlayoffs } from "@/lib/stats";
import { ActionForm, Check, Field, FormStatus, StickySave } from "@/components/admin/form-kit";
import { savePlayoffsAction } from "@/lib/actions";

export const metadata = { title: "Manage Playoffs" };

const ROUND_LABEL = {
  playin: "Play-in round",
  semifinal: "Semifinals",
  final: "Championship",
} as const;

export default async function PlayoffsAdminPage() {
  const league = await readLeague();
  const standings = computeStandings(league);
  const resolved = resolvePlayoffs(league);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="display text-[1.6rem]">Manage Playoffs</h2>
        <p className="hint mt-1 max-w-2xl">
          Seeds come from the standings automatically — you only enter scores. Winners advance on
          their own, so the bracket fills in as the postseason is bowled.{" "}
          <Link href="/playoffs" className="text-muted underline">
            See the public bracket
          </Link>
          .
        </p>
      </div>

      <ActionForm action={savePlayoffsAction}>
        <section className="panel p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <Check
                name="enabled"
                label="Show the playoff bracket on the site"
                defaultChecked={league.playoffs.enabled}
              />
            </div>
            <Field
              label="Teams that qualify"
              hint={`Out of ${league.teams.length}. The top two seeds skip the play-in round.`}
            >
              <input
                type="number"
                name="qualifiers"
                min={2}
                max={league.teams.length}
                defaultValue={league.playoffs.qualifiers}
                className="input num w-24"
              />
            </Field>
          </div>
        </section>

        {/* --------------------------------------------- current seeding */}
        <section className="panel overflow-hidden">
          <div className="panel-head">
            <span className="overline">Seeding as it stands</span>
            <span className="overline">From the standings</span>
          </div>
          <div className="table-scroll">
            <table className="stat">
              <thead>
                <tr>
                  <th className="left w-12">Seed</th>
                  <th className="left">Team</th>
                  <th>Record</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.slice(0, league.playoffs.qualifiers).map((s) => (
                  <tr
                    key={s.team.id}
                    className="team-bar"
                    style={{ ["--team" as string]: s.team.color }}
                  >
                    <td className="num">{s.rank}</td>
                    <td className="key left">{s.team.name}</td>
                    <td className="num">
                      {s.wins}–{s.losses}
                      {s.ties ? `–${s.ties}` : ""}
                    </td>
                    <td className="num font-semibold text-cream">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ----------------------------------------------------- series */}
        <section className="space-y-3">
          {(["playin", "semifinal", "final"] as const).map((round) => {
            const series = resolved.filter((r) => r.series.round === round);
            if (series.length === 0) return null;
            return (
              <div key={round} className="panel overflow-hidden">
                <div className="panel-head">
                  <span className="overline">{ROUND_LABEL[round]}</span>
                  <span className="overline">{series.length} series</span>
                </div>
                <div className="divide-y divide-line">
                  {series.map((r) => (
                    <div key={r.series.id} className="px-3.5 py-3">
                      <div className="overline mb-2">{r.series.label}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)_5rem] gap-2 sm:gap-3 items-end">
                        <div>
                          <span className="label">{r.team1?.name ?? r.team1Label}</span>
                          <div className="hint">{r.team1 ? "Seeded" : "Not decided yet"}</div>
                        </div>
                        <label className="block">
                          <span className="label">Score</span>
                          <input
                            type="number"
                            min={0}
                            name={`s1_${r.series.id}`}
                            defaultValue={r.series.team1Score ?? ""}
                            className="input input-num"
                            placeholder="—"
                            aria-label={`${r.team1?.name ?? r.team1Label} score`}
                          />
                        </label>
                        <div>
                          <span className="label">{r.team2?.name ?? r.team2Label}</span>
                          <div className="hint">{r.team2 ? "Seeded" : "Not decided yet"}</div>
                        </div>
                        <label className="block">
                          <span className="label">Score</span>
                          <input
                            type="number"
                            min={0}
                            name={`s2_${r.series.id}`}
                            defaultValue={r.series.team2Score ?? ""}
                            className="input input-num"
                            placeholder="—"
                            aria-label={`${r.team2?.name ?? r.team2Label} score`}
                          />
                        </label>
                      </div>

                      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        <label className="block">
                          <span className="label">Winner override</span>
                          <select
                            name={`w_${r.series.id}`}
                            className="input"
                            defaultValue={r.series.winnerId ?? ""}
                          >
                            <option value="">Decide from the scores</option>
                            {league.teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="hint pb-1">
                          {r.winner
                            ? `Advancing: ${r.winner.name}`
                            : "No winner yet — enter both scores or set one by hand."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="panel p-4">
          <Field label="Champion" hint="Leave on automatic unless you want to declare it yourself.">
            <select
              name="championId"
              className="input"
              defaultValue={league.playoffs.championId ?? ""}
            >
              <option value="">Automatic — winner of the championship</option>
              {league.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <FormStatus />
        </section>

        <StickySave label="Save bracket" />
      </ActionForm>
    </div>
  );
}
