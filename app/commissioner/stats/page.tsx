import { readLeague } from "@/lib/store";
import { computePlayerStats, fmtAvg, fmtInt } from "@/lib/stats";
import {
  ActionForm,
  Check,
  DangerSubmit,
  Field,
  FormStatus,
  StickySave,
  SubmitBtn,
} from "@/components/admin/form-kit";
import {
  addStatFieldAction,
  clearAllScoresAction,
  removeStatFieldAction,
  savePlayerStatsAction,
} from "@/lib/actions";

export const metadata = { title: "Manage Stats" };

export default async function StatsAdminPage() {
  const league = await readLeague();
  const stats = computePlayerStats(league);
  const fields = league.settings.playerStatFields;
  // Every bowler shares the same carry-over week, set when the data was imported.
  const baselineWeek =
    league.players.find((p) => p.manualStats?.throughWeek != null)?.manualStats.throughWeek ?? null;

  const teams = [...league.teams].sort((a, b) => a.sortOrder - b.sortOrder);
  const grouped = [
    ...teams.map((t) => ({
      key: t.id,
      label: t.name,
      color: t.color,
      rows: stats.filter((s) => s.team?.id === t.id),
    })),
    { key: "free", label: "Free agents", color: "#3a3a44", rows: stats.filter((s) => !s.team) },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-[1.6rem]">Manage Stats</h2>
        <p className="hint mt-1 max-w-3xl">
          The numbers below are the season totals carried over from your spreadsheet, and they run{" "}
          <strong>through week {baselineWeek ?? "\u2014"}</strong>. Game scores you enter for any
          later week are <strong>added on top</strong>, so averages keep moving as the season goes
          on \u2014 you do not need to come back here every week. Edit a value only to correct the
          carried-over total; clear it to calculate that bowler purely from entered games.
        </p>
      </div>

      {/* ------------------------------------------------------- stat fields */}
      <section className="panel p-4">
        <div className="overline mb-2.5">Stat categories</div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {fields.map((f) => (
            <ActionForm key={f.key} action={removeStatFieldAction}>
              <input type="hidden" name="key" value={f.key} />
              <span className="badge !pr-1 items-center gap-1.5">
                {f.label}
                {f.lowerIsBetter ? <span className="text-muted-2">↓ better</span> : null}
                {f.showOnStatsPage ? null : <span className="text-muted-2">hidden</span>}
                <DangerSubmit confirmLabel="Remove">✕</DangerSubmit>
              </span>
            </ActionForm>
          ))}
          {fields.length === 0 ? <p className="hint">No extra categories yet.</p> : null}
        </div>

        <ActionForm action={addStatFieldAction}>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 items-end">
            <Field
              label="Add a category"
              hint="Becomes an editable field below and a sortable column on the Stats page."
            >
              <input name="label" className="input" placeholder="e.g. Splits Converted" required />
            </Field>
            <div className="pb-1">
              <Check name="showOnStatsPage" label="Show on Stats page" defaultChecked />
              <Check name="lowerIsBetter" label="Lower is better" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <SubmitBtn>Add category</SubmitBtn>
            <FormStatus className="!mt-0" />
          </div>
        </ActionForm>
      </section>

      {/* -------------------------------------------------------- stat grid */}
      <ActionForm action={savePlayerStatsAction}>
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.key}>
              <div className="section-head">
                <div>
                  <div className="overline" style={{ color: group.color }}>
                    {group.rows.length} bowlers
                  </div>
                  <h3 className="display text-[1.2rem]">{group.label}</h3>
                </div>
              </div>

              <div className="panel overflow-hidden">
                <div className="table-scroll">
                  <table className="stat">
                    <thead>
                      <tr>
                        <th className="left">Bowler</th>
                        <th className="w-20">Games</th>
                        <th className="w-20">Average</th>
                        <th className="w-20">Total</th>
                        <th className="w-20">Strikes</th>
                        {fields.map((f) => (
                          <th key={f.key} className="w-20">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((s) => {
                        const m = s.player.manualStats;
                        return (
                          <tr key={s.player.id}>
                            <td className="key left max-w-[11rem]">
                              <span className="block truncate">{s.player.name}</span>
                              <span className="block hint num">
                                calc: {fmtAvg(s.average)} avg · {fmtInt(s.totalScore)} pins ·{" "}
                                {s.games} gp
                                {s.manual ? " · overridden" : ""}
                              </span>
                            </td>
                            <td className="!px-1.5">
                              <input
                                type="number"
                                min={0}
                                name={`games_${s.player.id}`}
                                defaultValue={m?.games ?? ""}
                                className="input input-num"
                                placeholder="auto"
                                aria-label={`${s.player.name} games played`}
                              />
                            </td>
                            <td className="!px-1.5">
                              <input
                                type="number"
                                step="0.1"
                                min={0}
                                max={300}
                                name={`average_${s.player.id}`}
                                defaultValue={m?.average ?? ""}
                                className="input input-num"
                                placeholder="auto"
                                aria-label={`${s.player.name} average`}
                              />
                            </td>
                            <td className="!px-1.5">
                              <input
                                type="number"
                                min={0}
                                name={`total_${s.player.id}`}
                                defaultValue={m?.totalScore ?? ""}
                                className="input input-num"
                                placeholder="auto"
                                aria-label={`${s.player.name} total score`}
                              />
                            </td>
                            <td className="!px-1.5">
                              <input
                                type="number"
                                min={0}
                                name={`strikes_${s.player.id}`}
                                defaultValue={m?.strikes ?? ""}
                                className="input input-num"
                                placeholder="auto"
                                aria-label={`${s.player.name} strikes`}
                              />
                            </td>
                            {fields.map((f) => (
                              <td key={f.key} className="!px-1.5">
                                <input
                                  type="number"
                                  name={`x_${f.key}_${s.player.id}`}
                                  defaultValue={s.player.additionalStats?.[f.key] ?? ""}
                                  className="input input-num"
                                  placeholder="—"
                                  aria-label={`${s.player.name} ${f.label}`}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>

        <StickySave label="Save all stats" />
      </ActionForm>

      {/* ------------------------------------------------------ danger zone */}
      <section className="panel p-4 border-loss/40">
        <div className="overline text-loss">Start the season over</div>
        <p className="hint mt-1 mb-3 max-w-2xl">
          Clears every game score, manual stat override, team record override and power score.
          Teams, rosters, photos, logos and the schedule are all kept. Use this once you're done
          with the placeholder data and ready to enter real results.
        </p>
        <ActionForm action={clearAllScoresAction}>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Type CLEAR to confirm">
              <input name="confirm" className="input w-40" placeholder="CLEAR" autoComplete="off" />
            </Field>
            <div className="pb-[1px]">
              <DangerSubmit confirmLabel="Clear every score">Clear all scores</DangerSubmit>
            </div>
          </div>
          <FormStatus />
        </ActionForm>
      </section>
    </div>
  );
}
