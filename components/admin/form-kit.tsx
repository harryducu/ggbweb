"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/actions";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/**
 * The action's last result, shared over context rather than a render prop, so
 * server components can compose a form's fields and drop <FormStatus /> wherever
 * the message belongs. (A function child can't cross the server boundary.)
 */
const ResultContext = createContext<ActionResult>(null);

export function useActionResult(): ActionResult {
  return useContext(ResultContext);
}

/** Wraps a server action, giving its children access to the result. */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: Action;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      <ResultContext.Provider value={state}>{children}</ResultContext.Provider>
    </form>
  );
}

/** Renders the surrounding form's success or error message. */
export function FormStatus({ className = "" }: { className?: string }) {
  return <Status state={useActionResult()} className={className} />;
}

function Status({ state, className = "" }: { state: ActionResult; className?: string }) {
  if (!state) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={[
        "mt-2 text-[0.82rem] leading-snug flex items-start gap-1.5",
        state.ok ? "text-win" : "text-loss",
        className,
      ].join(" ")}
    >
      <span aria-hidden className="flex-none">
        {state.ok ? "✓" : "✕"}
      </span>
      <span>{state.message}</span>
    </p>
  );
}

export function SubmitBtn({
  children = "Save",
  pendingLabel = "Saving…",
  className = "btn btn-primary",
}: {
  children?: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Two-step destructive submit. Deliberately inline rather than a browser
 * confirm() dialog — no modal, and the undo path is just clicking Cancel.
 */
export function DangerSubmit({
  children = "Delete",
  confirmLabel = "Yes, delete",
}: {
  children?: ReactNode;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  if (!armed) {
    return (
      <button type="button" className="btn btn-sm btn-danger" onClick={() => setArmed(true)}>
        {children}
      </button>
    );
  }

  return (
    <span className="inline-flex gap-1.5 items-center">
      <button type="submit" className="btn btn-sm btn-danger" disabled={pending}>
        {pending ? "Deleting…" : confirmLabel}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  );
}

/** Sticky save bar for the long grid forms, so Save is always reachable. */
export function StickySave({
  children,
  label = "Save changes",
}: {
  children?: ReactNode;
  label?: string;
}) {
  return (
    <div className="sticky bottom-0 z-20 mt-4 -mx-1 px-1">
      <div className="panel bg-ink-2/97 backdrop-blur-sm px-3 py-2.5 flex flex-wrap items-center gap-3">
        <SubmitBtn>{label}</SubmitBtn>
        {children}
        <div className="flex-1 min-w-0">
          <FormStatus className="!mt-0" />
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint block mt-1">{hint}</span> : null}
    </label>
  );
}

export function Check({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer select-none py-1">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-[3px] h-4 w-4 flex-none accent-red"
      />
      <span>
        <span className="text-[0.88rem]">{label}</span>
        {hint ? <span className="hint block">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Image picker with a live preview and an explicit remove checkbox. */
export function ImageField({
  name,
  label,
  current,
  removeName,
  hint,
  shape = "square",
}: {
  name: string;
  label: string;
  current: string | null;
  removeName: string;
  hint?: string;
  shape?: "square" | "portrait";
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? current;

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex-none border border-line-2 bg-ink-2 overflow-hidden grid place-items-center",
            shape === "portrait" ? "w-16 h-20" : "w-16 h-16",
          ].join(" ")}
        >
          {shown ? (
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[0.72rem] text-muted-2 uppercase tracking-wider">None</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="file"
            name={name}
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
            className="input !p-1.5 text-[0.8rem] file:mr-2 file:border-0 file:bg-panel-3 file:px-2 file:py-1 file:text-[0.72rem] file:uppercase file:tracking-wider file:cursor-pointer"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview((old) => {
                if (old) URL.revokeObjectURL(old);
                return f ? URL.createObjectURL(f) : null;
              });
            }}
          />
          {hint ? <span className="hint block mt-1">{hint}</span> : null}
          {current ? (
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer text-[0.8rem] text-muted">
              <input type="checkbox" name={removeName} className="h-3.5 w-3.5 accent-red" />
              Remove current image
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Color picker paired with the hex value, since team colors drive the UI. */
export function ColorField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-10 flex-none bg-ink-2 border border-line-2 cursor-pointer p-0.5"
          aria-label={`${label} picker`}
        />
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input num"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
