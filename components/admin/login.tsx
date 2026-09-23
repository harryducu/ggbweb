"use client";

import { ActionForm, Field, FormStatus, SubmitBtn } from "./form-kit";
import { signInAction } from "@/lib/actions";

export function CommissionerLogin({
  logo,
  leagueName,
  missing = [],
}: {
  logo: string | null;
  leagueName: string;
  /** Required environment variables this deployment is missing. */
  missing?: string[];
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

        {missing.length > 0 ? (
          <div role="alert" className="panel mt-7 p-4 border-loss/50 bg-loss/[0.08]">
            <div className="overline text-loss">Sign-in is disabled</div>
            <p className="hint mt-1.5">
              This deployment is missing {missing.join(" and ")}. Rather than fall back to a
              built-in password, which anyone reading the source would know, the panel refuses every
              sign-in until {missing.length === 1 ? "it is" : "they are"} set.
            </p>
            <p className="hint mt-2">
              Set {missing.length === 1 ? "it" : "them"} in the host&apos;s environment settings (on
              Vercel: Settings &rarr; Environment Variables), then redeploy. Locally, put{" "}
              {missing.length === 1 ? "it" : "them"} in{" "}
              <code className="text-muted">.env.local</code>.
            </p>
          </div>
        ) : null}

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
          Access is set by the COMMISSIONER_PASSWORD environment variable.
        </p>
      </div>
    </div>
  );
}
