"use client";

import { ActionForm, Field, FormStatus, SubmitBtn } from "./form-kit";
import { signInAction } from "@/lib/actions";

export function CommissionerLogin({
  logo,
  leagueName,
}: {
  logo: string | null;
  leagueName: string;
}) {
  return (
    <div className="wrap py-14 md:py-20">
      <div className="max-w-sm mx-auto">
        <div className="text-center">
          {logo ? (
            <img
              src={logo}
              alt=""
              width={76}
              height={76}
              className="mx-auto h-19 w-19 object-contain"
            />
          ) : null}
          <div className="overline text-red mt-3">Restricted</div>
          <h1 className="display text-[2.2rem] mt-1">Commissioner</h1>
          <p className="text-muted text-sm mt-2">
            {leagueName} admin. Scores, rankings and rosters are edited here.
          </p>
        </div>

        <div className="panel mt-7 p-5">
          <ActionForm action={signInAction}>
            <Field label="Password">
              <input
                type="password"
                name="password"
                className="input"
                autoComplete="current-password"
                autoFocus
                required
              />
            </Field>
            <FormStatus />
            <div className="mt-3">
              <SubmitBtn pendingLabel="Checking…" className="btn btn-primary w-full">
                Sign in
              </SubmitBtn>
            </div>
          </ActionForm>
        </div>

        <p className="hint text-center mt-4">
          The password lives in <span className="text-muted">.env.local</span> as
          COMMISSIONER_PASSWORD. Change it before the site goes public.
        </p>
      </div>
    </div>
  );
}
