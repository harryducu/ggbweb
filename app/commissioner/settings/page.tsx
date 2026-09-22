import { readLeague } from "@/lib/store";
import {
  ActionForm,
  DangerSubmit,
  Field,
  ImageField,
  FormStatus,
  SubmitBtn,
} from "@/components/admin/form-kit";
import { resetLeagueAction, saveSettingsAction } from "@/lib/actions";

export const metadata = { title: "League Settings" };

export default async function SettingsAdminPage() {
  const league = await readLeague();
  const s = league.settings;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="display text-[1.6rem]">League Settings</h2>
        <p className="hint mt-1 max-w-2xl">
          Branding, the current week, scoring rules and the rules page. The league name and logo
          appear in the site header, the browser tab and the page titles.
        </p>
      </div>

      <ActionForm action={saveSettingsAction} className="space-y-5">
        {/* ----------------------------------------------------- brand */}
        <section className="panel p-4">
          <div className="overline mb-3">Identity</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Field label="League name">
              <input name="name" className="input" defaultValue={s.name} required />
            </Field>
            <Field label="Tagline" hint="Shown under the name in the header.">
              <input
                name="tagline"
                className="input"
                defaultValue={s.tagline}
                placeholder="Same league, different breed"
              />
            </Field>
            <Field label="Season">
              <input
                name="season"
                className="input"
                defaultValue={s.season}
                placeholder="2026 Season"
              />
            </Field>
            <Field label="Current week" hint="Drives the home page and the schedule highlight.">
              <input
                type="number"
                min={1}
                name="currentWeek"
                className="input num"
                defaultValue={s.currentWeek}
              />
            </Field>
            <div className="sm:col-span-2">
              <ImageField
                name="logo"
                label="League logo"
                current={s.logo}
                removeName="removeLogo"
                hint="Used in the header, the footer and as the browser tab icon."
              />
            </div>
            <div className="sm:col-span-2">
              <Field label="Description" hint="Shown on the home page and in the footer.">
                <textarea
                  name="description"
                  className="input"
                  rows={3}
                  defaultValue={s.description}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- scoring */}
        <section className="panel p-4">
          <div className="overline mb-3">Scoring and format</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Points per win">
              <input
                type="number"
                min={0}
                name="pointsPerWin"
                className="input num"
                defaultValue={s.pointsPerWin}
              />
            </Field>
            <Field label="Points per tie">
              <input
                type="number"
                min={0}
                name="pointsPerTie"
                className="input num"
                defaultValue={s.pointsPerTie}
              />
            </Field>
            <Field label="Games a night">
              <input
                type="number"
                min={1}
                name="gamesPerNight"
                className="input num"
                defaultValue={s.gamesPerNight}
              />
            </Field>
            <Field label="Bowlers per team">
              <input
                type="number"
                min={1}
                name="playersPerTeam"
                className="input num"
                defaultValue={s.playersPerTeam}
              />
            </Field>
          </div>
          <p className="hint mt-2">
            Changing the points values recalculates the standings immediately.
          </p>
        </section>

        {/* ----------------------------------------------------- rules */}
        <section className="panel p-4">
          <div className="overline mb-3">League rules</div>
          <Field label="Rules" hint="One rule per line. Each line becomes a numbered rule.">
            <textarea name="rules" className="input" rows={10} defaultValue={s.rules} />
          </Field>
        </section>

        <div className="sticky bottom-0 z-20 panel bg-ink-2/97 backdrop-blur-sm px-3 py-2.5 flex flex-wrap items-center gap-3">
          <SubmitBtn>Save settings</SubmitBtn>
          <div className="flex-1 min-w-0">
            <FormStatus className="!mt-0" />
          </div>
        </div>
      </ActionForm>

      {/* ------------------------------------------------------ danger zone */}
      <section className="panel p-4 border-loss/40">
        <div className="overline text-loss">Reset everything</div>
        <p className="hint mt-1 mb-3 max-w-2xl">
          Restores the original seven teams, the seven-week schedule, placeholder rosters and the
          example week of scores. Every change you've made — including uploaded photos and logos —
          stops being referenced. There is no undo.
        </p>
        <ActionForm action={resetLeagueAction}>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Type RESET to confirm">
              <input name="confirm" className="input w-40" placeholder="RESET" autoComplete="off" />
            </Field>
            <div className="pb-[1px]">
              <DangerSubmit confirmLabel="Reset the league">Reset league</DangerSubmit>
            </div>
          </div>
          <FormStatus />
        </ActionForm>
      </section>
    </div>
  );
}
