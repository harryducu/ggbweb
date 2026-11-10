import Link from "next/link";
import { readLeague } from "@/lib/store";
import { PLAYOFF_ROUND_LABEL, computeStandings, resolvePlayoffs } from "@/lib/stats";
import {
  ActionForm,
  Check,
  DangerSubmit,
  Field,
  FormStatus,
  StickySave,
  SubmitBtn,
} from "@/components/admin/form-kit";
import { addTiebreakerAction, deleteTiebreakerAction, savePlayoffsAction } from "@/lib/actions";

export const metadata = { title: "Manage Playoffs" };

export default async function PlayoffsAdminPage() {
  const league = await readLeague();
  const standings = computeStandings(league);
  const resolved = resolvePlayoffs(league);
  const teams = [...league.teams].sort((a, b) => a.sortOrder - b.sortOrder);
  const tiebreakers = resolved.filter((r) => r.series.round === "tiebreaker");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="display text-[1.6rem]">Manage Playoffs</h2>
        <p className="hint mt-1 max-w-2xl">
          Seeds come from the standings automatically — you only enter scores. The play-in is best
          of 3 and the semifinals and championship are best of 5. Each game goes to the team with
          more pins, and series winners advance on their own.{" "}
          <Link href="/playoffs" className="text-muted underline">
            See the public bracket
          </Link>
          . Bowler scores for each game go under{" "}
          <Link href="/commissioner/playoff-scores" className="text-muted underline">
            Playoff Scores
          </Link>{" "}
          and are kept out of season stats. Leave the boxes below blank to use them.
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
          {(["tiebreaker", "playin", "semifinal", "final"] as const).map((round) => {
            const series = resolved.filter((r) => r.series.round === round);
            if (series.length === 0) return null;
            return (
              <div key={round} className="panel overflow-hidden">
                <div className="panel-head">
                  <span className="overline">{PLAYOFF_ROUND_LABEL[round]}</span>
                  <span className="overline">
                    {round === "tiebreaker"
                      ? "Winner ranks ahead when level on win %"
                      : `${series.length} series`}
                  </span>
                </div>
                <div className="divide-y divide-line">
                  {series.map((r) => (
                    <div key={r.series.id} className="px-3.5 py-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="overline">{r.series.label}</span>
                        {r.team1 && r.team2 ? (
                          <Link
                            href={`/commissioner/playoff-scores?series=${r.series.id}`}
                            className="section-link"
                          >
                            Bowler scores →
                          </Link>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)_5rem] gap-2 sm:gap-3 items-end">
                        <div>
                          <span className="label">{r.team1?.name ?? r.team1Label}</span>
                          <div className="hint">{r.team1 ? (r.series.round === "tiebreaker" ? "Tied in the standings" : "Seeded") : "Not decided yet"}</div>
                        </div>
                        <label className="block">
                          <span className="label">{r.bestOf === 1 ? "Pins" : "Games won"}</span>
                          <input
                            type="number"
                            min={0}
                            name={`s1_${r.series.id}`}
                            defaultValue={r.series.team1Score ?? ""}
                            className="input input-num"
                            placeholder={r.team1Score === null ? "—" : String(r.team1Score)}
                            aria-label={`${r.team1?.name ?? r.team1Label} score`}
                          />
                        </label>
                        <div>
                          <span className="label">{r.team2?.name ?? r.team2Label}</span>
                          <div className="hint">{r.team2 ? (r.series.round === "tiebreaker" ? "Tied in the standings" : "Seeded") : "Not decided yet"}</div>
                        </div>
                        <label className="block">
                          <span className="label">{r.bestOf === 1 ? "Pins" : "Games won"}</span>
                          <input
                            type="number"
                            min={0}
                            name={`s2_${r.series.id}`}
                            defaultValue={r.series.team2Score ?? ""}
                            className="input input-num"
                            placeholder={r.team2Score === null ? "—" : String(r.team2Score)}
                            aria-label={`${r.team2?.name ?? r.team2Label} score`}
                          />
                        </label>
                      </div>

                      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-end">
                        <label className="block">
                          <span className="label">Format</span>
                          <select name={`bo_${r.series.id}`} className="input" defaultValue={r.bestOf}>
                            <option value={1}>One game</option>
                            <option value={3}>Best of 3</option>
                            <option value={5}>Best of 5</option>
                            <option value={7}>Best of 7</option>
                          </select>
                        </label>
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
                            ? `${r.series.round === "tiebreaker" ? "Won it" : "Advancing"}: ${r.winner.name}`
                            : r.bestOf === 1
                              ? "No winner yet — enter bowler scores or set one by hand."
                              : `No winner yet — first to ${Math.floor(r.bestOf / 2) + 1} game wins. Enter bowler scores or set one by hand.`}
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

      {/* ------------------------------------------------- tiebreakers */}
      <section className="panel p-4 space-y-4">
        <div>
          <div className="overline">Tiebreaker games</div>
          <p className="hint mt-1 max-w-2xl">
            When two teams finish level on win percentage, the winner of a tiebreaker game between
            them ranks ahead in the standings and the seeding. Without one, total pins decide.
          </p>
        </div>

        {tiebreakers.map((r) => (
          <ActionForm
            key={r.series.id}
            action={deleteTiebreakerAction}
            className="flex flex-wrap items-center gap-3 border-t border-line pt-3"
          >
            <input type="hidden" name="id" value={r.series.id} />
            <span className="flex-1 min-w-0 text-[0.9rem]">
              {r.team1?.name ?? "?"} <span className="text-muted-2">vs</span>{" "}
              {r.team2?.name ?? "?"}
              <span className="hint ml-2">
                {r.winner ? `${r.winner.name} won` : "No result yet"}
              </span>
            </span>
            <DangerSubmit confirmLabel="Remove tiebreaker">Remove</DangerSubmit>
            <FormStatus className="!mt-0 w-full" />
          </ActionForm>
        ))}

        <ActionForm action={addTiebreakerAction} className="border-t border-line pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
            <Field label="Team">
              <select name="team1Id" className="input" defaultValue="">
                <option value="">Pick a team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Against">
              <select name="team2Id" className="input" defaultValue="">
                <option value="">Pick a team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Label">
              <input name="label" className="input" placeholder="Tiebreaker" />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <SubmitBtn>Add tiebreaker</SubmitBtn>
            <FormStatus className="!mt-0" />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
