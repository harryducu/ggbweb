import { readLeague } from "@/lib/store";
import { initials } from "@/lib/stats";
import {
  ActionForm,
  Check,
  DangerSubmit,
  Field,
  ImageField,
  FormStatus,
  SubmitBtn,
} from "@/components/admin/form-kit";
import { addPlayerAction, deletePlayerAction, updatePlayerAction } from "@/lib/actions";

export const metadata = { title: "Manage Players" };

export default async function PlayersAdminPage() {
  const league = await readLeague();
  const teams = [...league.teams].sort((a, b) => a.sortOrder - b.sortOrder);

  const groups = [
    ...teams.map((t) => ({
      key: t.id,
      label: t.name,
      color: t.color,
      players: league.players.filter((p) => p.teamId === t.id),
    })),
    {
      key: "free",
      label: "Free agents",
      color: "#3a3a44",
      players: league.players.filter((p) => !p.teamId),
    },
  ].filter((g) => g.players.length > 0 || g.key !== "free");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-[1.6rem]">Manage Players</h2>
        <p className="hint mt-1 max-w-2xl">
          Add and remove bowlers, move them between teams, and upload photos. Deleting a bowler also
          deletes their entered game scores.
        </p>
      </div>

      {/* ---------------------------------------------------------- add form */}
      <section className="panel p-4">
        <div className="overline mb-2.5">Add a bowler</div>
        <ActionForm action={addPlayerAction}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Name">
              <input name="name" className="input" required placeholder="e.g. Drew Taylor" />
            </Field>
            <Field label="Team">
              <select name="teamId" className="input" defaultValue="">
                <option value="">Free agent</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <ImageField
                name="photo"
                label="Photo (optional)"
                current={null}
                removeName="removePhoto"
                shape="portrait"
                hint="Portrait crops look best. JPG, PNG or WEBP up to 6MB."
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <SubmitBtn>Add bowler</SubmitBtn>
            <FormStatus className="!mt-0" />
          </div>
        </ActionForm>
      </section>

      {/* ------------------------------------------------------- roster list */}
      {groups.map((group) => (
        <section key={group.key}>
          <div className="section-head">
            <div>
              <div className="overline" style={{ color: group.color }}>
                {group.players.length} of {league.settings.playersPerTeam} spots
              </div>
              <h3 className="display text-[1.25rem]">{group.label}</h3>
            </div>
          </div>

          <div className="panel overflow-hidden divide-y divide-line">
            {group.players.map((player) => (
              <details key={player.id} className="group">
                <summary className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer select-none hover:bg-white/[0.03] transition-colors">
                  <span className="avatar h-8 w-8 text-[0.7rem]">
                    {player.photo ? (
                      <img src={player.photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials(player.name)
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-[0.92rem] truncate">
                      {player.name}
                    </span>
                    <span className="block hint">
                      {player.photo ? "Photo set" : "No photo"}
                      {player.nickname ? ` · “${player.nickname}”` : ""}
                      {player.active ? "" : " · Inactive"}
                    </span>
                  </span>
                  <span className="badge group-open:hidden">Edit</span>
                  <span className="badge hidden group-open:inline-flex">Close</span>
                </summary>

                <div className="px-3.5 pb-4 pt-1 bg-ink-2 border-t border-line">
                  <ActionForm action={updatePlayerAction}>
                    <input type="hidden" name="id" value={player.id} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-3">
                      <Field label="Name">
                        <input name="name" className="input" defaultValue={player.name} required />
                      </Field>
                      <Field label="Nickname" hint="Shown in quotes on the player page.">
                        <input
                          name="nickname"
                          className="input"
                          defaultValue={player.nickname ?? ""}
                        />
                      </Field>
                      <Field label="Team">
                        <select name="teamId" className="input" defaultValue={player.teamId ?? ""}>
                          <option value="">Free agent</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="flex items-end pb-1">
                        <Check
                          name="active"
                          label="Active this season"
                          defaultChecked={player.active}
                          hint="Inactive bowlers stay on the roster but keep their history."
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <ImageField
                          name="photo"
                          label="Photo"
                          current={player.photo}
                          removeName="removePhoto"
                          shape="portrait"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <SubmitBtn>Save bowler</SubmitBtn>
                      <FormStatus className="!mt-0" />
                    </div>
                  </ActionForm>

                  <div className="mt-4 pt-3 border-t border-line">
                    <ActionForm action={deletePlayerAction}>
                      <div className="flex flex-wrap items-center gap-3">
                        <input type="hidden" name="id" value={player.id} />
                        <span className="hint flex-1 min-w-0">
                          Removing {player.name} also removes their entered scores.
                        </span>
                        <DangerSubmit confirmLabel={`Remove ${player.name}`}>
                          Remove bowler
                        </DangerSubmit>
                        <FormStatus className="!mt-0" />
                      </div>
                    </ActionForm>
                  </div>
                </div>
              </details>
            ))}

            {group.players.length === 0 ? (
              <p className="px-3.5 py-5 text-center text-sm text-muted">
                No bowlers assigned to {group.label} yet.
              </p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
