import { readLeague } from "@/lib/store";
import { computeStandings, fmtInt, standingFor } from "@/lib/stats";
import {
  ActionForm,
  ColorField,
  DangerSubmit,
  Field,
  ImageField,
  FormStatus,
  SubmitBtn,
} from "@/components/admin/form-kit";
import { Crest } from "@/components/ui";
import { addTeamAction, deleteTeamAction, moveTeamAction, updateTeamAction } from "@/lib/actions";

export const metadata = { title: "Manage Teams" };

export default async function TeamsAdminPage() {
  const league = await readLeague();
  const teams = [...league.teams].sort((a, b) => a.sortOrder - b.sortOrder);
  const standings = computeStandings(league);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-[1.6rem]">Manage Teams</h2>
        <p className="hint mt-1 max-w-2xl">
          Names, logos, colors and display order. A team's color drives its bar and row tint
          everywhere on the site, so pick something distinct.
        </p>
      </div>

      {/* ---------------------------------------------------------- add form */}
      <section className="panel p-4">
        <div className="overline mb-2.5">Add a team</div>
        <ActionForm action={addTeamAction}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
            <Field label="Team name">
              <input name="name" className="input" required placeholder="e.g. Pocket Pounders" />
            </Field>
            <Field label="Short code" hint="Up to 4 characters. Left blank, it's generated.">
              <input name="abbreviation" className="input" maxLength={4} placeholder="PP" />
            </Field>
            <ColorField name="color" label="Team color" defaultValue="#71717a" />
            <div className="sm:col-span-3">
              <ImageField
                name="logo"
                label="Logo (optional)"
                current={null}
                removeName="removeLogo"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <SubmitBtn>Add team</SubmitBtn>
            <FormStatus className="!mt-0" />
          </div>
        </ActionForm>
      </section>

      {/* -------------------------------------------------------- team list */}
      <section className="space-y-3">
        <div className="section-head">
          <div>
            <div className="overline">{teams.length} teams</div>
            <h3 className="display text-[1.25rem]">The League</h3>
          </div>
          <span className="overline">Order controls the Teams grid</span>
        </div>

        {teams.map((team, i) => {
          const standing = standingFor(standings, team.id);
          const roster = league.players.filter((p) => p.teamId === team.id);

          return (
            <details key={team.id} className="panel overflow-hidden group">
              <summary
                className="flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none hover:bg-white/[0.03] transition-colors"
                style={{ boxShadow: `inset 3px 0 0 ${team.color}` }}
              >
                <span className="overline num w-4 flex-none">{i + 1}</span>
                <Crest team={team} size={34} />
                <span className="flex-1 min-w-0">
                  <span className="block display text-[1.05rem] text-cream truncate">
                    {team.name}
                  </span>
                  <span className="block hint">
                    {team.abbreviation} · {roster.length} bowlers ·{" "}
                    {standing ? `${standing.wins}–${standing.losses}` : "0–0"} ·{" "}
                    {fmtInt(standing?.totalPins ?? 0)} pins
                    {standing?.manual ? " · manual record" : ""}
                  </span>
                </span>
                <span className="badge group-open:hidden">Edit</span>
                <span className="badge hidden group-open:inline-flex">Close</span>
              </summary>

              <div className="px-3.5 pb-4 pt-3 bg-ink-2 border-t border-line space-y-4">
                <ActionForm action={updateTeamAction}>
                  <input type="hidden" name="id" value={team.id} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
                    <Field label="Team name">
                      <input name="name" className="input" defaultValue={team.name} required />
                    </Field>
                    <Field label="Short code">
                      <input
                        name="abbreviation"
                        className="input"
                        maxLength={4}
                        defaultValue={team.abbreviation}
                      />
                    </Field>
                    <ColorField name="color" label="Team color" defaultValue={team.color} />
                    <div className="sm:col-span-3">
                      <ImageField
                        name="logo"
                        label="Logo"
                        current={team.logo}
                        removeName="removeLogo"
                        hint="Square crops work best. Without a logo, the short code is shown on the team color."
                      />
                    </div>
                  </div>

                  {/* Manual record override — matches how the league's own
                        graphics are produced, straight from a spreadsheet. */}
                  <div className="mt-4 pt-3 border-t border-line">
                    <div className="overline">Override record (optional)</div>
                    <p className="hint mt-0.5 mb-2.5">
                      Leave blank to calculate the record from entered game scores. Fill these in to
                      post a record directly — useful before every score is typed in. Currently
                      showing{" "}
                      <span className="text-muted num">
                        {standing?.wins ?? 0}–{standing?.losses ?? 0}
                        {standing?.ties ? `–${standing.ties}` : ""},{" "}
                        {fmtInt(standing?.totalPins ?? 0)} pins
                      </span>
                      .
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Field label="Wins">
                        <input
                          type="number"
                          min={0}
                          name="manualWins"
                          className="input num"
                          defaultValue={team.manualRecord?.wins ?? ""}
                          placeholder="auto"
                        />
                      </Field>
                      <Field label="Losses">
                        <input
                          type="number"
                          min={0}
                          name="manualLosses"
                          className="input num"
                          defaultValue={team.manualRecord?.losses ?? ""}
                          placeholder="auto"
                        />
                      </Field>
                      <Field label="Ties">
                        <input
                          type="number"
                          min={0}
                          name="manualTies"
                          className="input num"
                          defaultValue={team.manualRecord?.ties ?? ""}
                          placeholder="auto"
                        />
                      </Field>
                      <Field label="Total pins">
                        <input
                          type="number"
                          min={0}
                          name="manualPins"
                          className="input num"
                          defaultValue={team.manualRecord?.totalPins ?? ""}
                          placeholder="auto"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <SubmitBtn>Save team</SubmitBtn>
                    <FormStatus className="!mt-0" />
                  </div>
                </ActionForm>

                {/* ------------------------------------------------ roster */}
                <div className="pt-3 border-t border-line">
                  <div className="overline mb-1.5">Roster</div>
                  {roster.length ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {roster.map((p) => (
                        <li key={p.id} className="badge">
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint">No bowlers assigned.</p>
                  )}
                  <p className="hint mt-1.5">Assign bowlers to this team from Manage Players.</p>
                </div>

                {/* -------------------------------------- order and delete */}
                <div className="pt-3 border-t border-line flex flex-wrap items-center gap-2">
                  <ActionForm action={moveTeamAction}>
                    <input type="hidden" name="id" value={team.id} />
                    <input type="hidden" name="direction" value="up" />
                    <SubmitBtn className="btn btn-sm" pendingLabel="…">
                      ↑ Move up
                    </SubmitBtn>
                  </ActionForm>
                  <ActionForm action={moveTeamAction}>
                    <input type="hidden" name="id" value={team.id} />
                    <input type="hidden" name="direction" value="down" />
                    <SubmitBtn className="btn btn-sm" pendingLabel="…">
                      ↓ Move down
                    </SubmitBtn>
                  </ActionForm>
                  <span className="flex-1" />
                  <ActionForm action={deleteTeamAction}>
                    <div className="flex items-center gap-2">
                      <input type="hidden" name="id" value={team.id} />
                      <DangerSubmit confirmLabel={`Delete ${team.name}`}>Delete team</DangerSubmit>
                      <FormStatus className="!mt-0" />
                    </div>
                  </ActionForm>
                </div>
                <p className="hint">
                  Deleting a team removes it from every week's matchups. Its bowlers become free
                  agents rather than being deleted.
                </p>
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}
