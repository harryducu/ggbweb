import { readLeague } from "@/lib/store";
import { fmtDate, resolveWeek } from "@/lib/stats";
import {
  ActionForm,
  Check,
  DangerSubmit,
  Field,
  FormStatus,
  SubmitBtn,
} from "@/components/admin/form-kit";
import {
  addWeekAction,
  deleteMatchupAction,
  deleteWeekAction,
  saveMatchupAction,
  updateWeekAction,
} from "@/lib/actions";

export const metadata = { title: "Manage Schedule" };

export default async function ScheduleAdminPage() {
  const league = await readLeague();
  const weeks = [...league.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const teams = [...league.teams].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-[1.6rem]">Manage Schedule</h2>
        <p className="hint mt-1 max-w-2xl">
          Weeks, dates, bye teams and matchups. Each week holds three games; every bowling team
          plays a different opponent in each one. Scores are entered separately under Enter Scores.
        </p>
      </div>

      {/* ---------------------------------------------------------- add week */}
      <section className="panel p-4">
        <div className="overline mb-2.5">Add a week</div>
        <ActionForm action={addWeekAction}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Date" hint="Monday nights, usually.">
              <input type="date" name="date" className="input" />
            </Field>
            <Field label="Bye team">
              <select name="byeTeamId" className="input" defaultValue="">
                <option value="">No bye — full slate</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <SubmitBtn>Add week</SubmitBtn>
            <FormStatus className="!mt-0" />
          </div>
        </ActionForm>
      </section>

      {/* -------------------------------------------------------- week list */}
      {weeks.map((week) => {
        const resolved = resolveWeek(league, week);
        const bowled = resolved.filter((r) => r.played).length;
        const isCurrent = week.weekNumber === league.settings.currentWeek;

        return (
          <details
            key={week.id}
            className="panel overflow-hidden group"
            style={isCurrent ? { boxShadow: "inset 3px 0 0 var(--color-red)" } : undefined}
          >
            <summary className="flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none hover:bg-white/[0.03] transition-colors">
              <span className="flex-1 min-w-0">
                <span className="block display text-[1.1rem] text-cream">
                  Week {week.weekNumber}
                  {isCurrent ? <span className="badge badge-live ml-2">Current</span> : null}
                </span>
                <span className="block hint num">
                  {fmtDate(week.date)} · {week.matchups.length} games · {bowled} bowled
                  {week.byeTeamId
                    ? ` · bye ${teams.find((t) => t.id === week.byeTeamId)?.abbreviation ?? "?"}`
                    : ""}
                </span>
              </span>
              <span className="badge group-open:hidden">Edit</span>
              <span className="badge hidden group-open:inline-flex">Close</span>
            </summary>

            <div className="px-3.5 pb-4 pt-3 bg-ink-2 border-t border-line space-y-5">
              {/* week details */}
              <ActionForm action={updateWeekAction}>
                <input type="hidden" name="id" value={week.id} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
                  <Field label="Week number">
                    <input
                      type="number"
                      min={1}
                      name="weekNumber"
                      className="input num"
                      defaultValue={week.weekNumber}
                    />
                  </Field>
                  <Field label="Date">
                    <input
                      type="date"
                      name="date"
                      className="input"
                      defaultValue={week.date ?? ""}
                    />
                  </Field>
                  <Field label="Bye team">
                    <select name="byeTeamId" className="input" defaultValue={week.byeTeamId ?? ""}>
                      <option value="">No bye — full slate</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="sm:col-span-3">
                    <Field label="Week recap">
                      <textarea name="notes" className="input" rows={2} defaultValue={week.notes} />
                    </Field>
                  </div>
                </div>
                <Check
                  name="completed"
                  label="Mark week complete"
                  defaultChecked={week.completed}
                />
                <div className="mt-3 flex items-center gap-3">
                  <SubmitBtn>Save week</SubmitBtn>
                  <FormStatus className="!mt-0" />
                </div>
              </ActionForm>

              {/* matchups */}
              <div className="pt-4 border-t border-line">
                <div className="overline mb-2">Matchups</div>
                <div className="space-y-2">
                  {[1, 2, 3].map((game) => {
                    const games = week.matchups.filter((m) => m.game === game);
                    return (
                      <div key={game} className="panel overflow-hidden">
                        <div className="panel-head !py-1.5">
                          <span className="overline">Game {game}</span>
                          <span className="overline">{games.length} matchups</span>
                        </div>
                        <div className="divide-y divide-line">
                          {games.map((m) => (
                            <div key={m.id} className="px-2.5 py-2">
                              <ActionForm action={saveMatchupAction}>
                                <input type="hidden" name="weekId" value={week.id} />
                                <input type="hidden" name="matchupId" value={m.id} />
                                <input type="hidden" name="game" value={game} />
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    name="team1Id"
                                    className="input flex-1 min-w-[8rem] !py-1 !text-[0.82rem]"
                                    defaultValue={m.team1Id}
                                    aria-label="Home team"
                                  >
                                    {teams.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="overline flex-none">vs</span>
                                  <select
                                    name="team2Id"
                                    className="input flex-1 min-w-[8rem] !py-1 !text-[0.82rem]"
                                    defaultValue={m.team2Id}
                                    aria-label="Away team"
                                  >
                                    {teams.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name}
                                      </option>
                                    ))}
                                  </select>
                                  <SubmitBtn className="btn btn-sm" pendingLabel="…">
                                    Save
                                  </SubmitBtn>
                                </div>
                                <FormStatus />
                              </ActionForm>
                              <div className="mt-1.5">
                                <ActionForm action={deleteMatchupAction}>
                                  <input type="hidden" name="weekId" value={week.id} />
                                  <input type="hidden" name="matchupId" value={m.id} />
                                  <DangerSubmit confirmLabel="Remove matchup">Remove</DangerSubmit>
                                </ActionForm>
                              </div>
                            </div>
                          ))}

                          {/* add matchup to this game */}
                          <div className="px-2.5 py-2 bg-ink-2">
                            <ActionForm action={saveMatchupAction}>
                              <input type="hidden" name="weekId" value={week.id} />
                              <input type="hidden" name="matchupId" value="" />
                              <input type="hidden" name="game" value={game} />
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  name="team1Id"
                                  className="input flex-1 min-w-[8rem] !py-1 !text-[0.82rem]"
                                  defaultValue=""
                                  aria-label="Add matchup, first team"
                                >
                                  <option value="">Add team…</option>
                                  {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                                <span className="overline flex-none">vs</span>
                                <select
                                  name="team2Id"
                                  className="input flex-1 min-w-[8rem] !py-1 !text-[0.82rem]"
                                  defaultValue=""
                                  aria-label="Add matchup, second team"
                                >
                                  <option value="">Add team…</option>
                                  {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                                <SubmitBtn className="btn btn-sm" pendingLabel="…">
                                  + Add
                                </SubmitBtn>
                              </div>
                              <FormStatus />
                            </ActionForm>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* delete week */}
              <div className="pt-4 border-t border-line">
                <ActionForm action={deleteWeekAction}>
                  <div className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="id" value={week.id} />
                    <span className="hint flex-1 min-w-0">
                      Deleting week {week.weekNumber} removes its matchups and every score entered
                      for it.
                    </span>
                    <DangerSubmit confirmLabel={`Delete week ${week.weekNumber}`}>
                      Delete week
                    </DangerSubmit>
                    <FormStatus className="!mt-0" />
                  </div>
                </ActionForm>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
