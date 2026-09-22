import Link from "next/link";
import type { ReactNode } from "react";
import type { Player, Team } from "@/lib/types";
import { initials } from "@/lib/stats";

/* -------------------------------------------------------------- team crest */

/**
 * Below this size a four-character short code renders too small to read, so the
 * crest becomes a plain colour plate. The team name always sits beside it, so
 * the plate still does its real job: a colour cue.
 */
const CREST_LABEL_MIN = 28;

export function Crest({ team, size = 28 }: { team: Team | undefined; size?: number }) {
  const showLabel = size >= CREST_LABEL_MIN;
  const fontSize = Math.max(11, size * 0.34);

  if (!team) {
    return (
      <span className="crest" style={{ width: size, height: size, fontSize }} aria-hidden>
        {showLabel ? "?" : ""}
      </span>
    );
  }

  return (
    <span
      className="crest"
      style={{
        width: size,
        height: size,
        fontSize,
        background: team.logo ? undefined : team.color,
        borderColor: team.logo ? undefined : team.color,
      }}
      title={team.name}
      aria-hidden={!showLabel}
    >
      {team.logo ? (
        <img src={team.logo} alt="" width={size} height={size} />
      ) : showLabel ? (
        team.abbreviation.slice(0, 4)
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------ player photo */

export function Avatar({
  player,
  size = 36,
}: {
  player: Pick<Player, "name" | "photo">;
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
    >
      {player.photo ? (
        <img src={player.photo} alt="" width={size} height={size} />
      ) : (
        initials(player.name)
      )}
    </span>
  );
}

/* ------------------------------------------------------------- team inline */

export function TeamName({
  team,
  size = 24,
  href = true,
  abbr = false,
  bold = true,
}: {
  team: Team | undefined;
  size?: number;
  href?: boolean;
  abbr?: boolean;
  bold?: boolean;
}) {
  const body = (
    <span className="inline-flex items-center gap-2 min-w-0">
      <Crest team={team} size={size} />
      <span className={`truncate ${bold ? "font-semibold" : ""}`}>
        {team ? (abbr ? team.abbreviation : team.name) : "TBD"}
      </span>
    </span>
  );
  if (!team || !href) return body;
  return (
    <Link href={`/teams/${team.id}`} className="hover:text-cream transition-colors min-w-0">
      {body}
    </Link>
  );
}

/* ------------------------------------------------------------ section head */

export function SectionHead({
  overline,
  title,
  href,
  hrefLabel = "View all",
  children,
}: {
  overline?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        {overline ? <div className="overline">{overline}</div> : null}
        <h2 className="display">{title}</h2>
      </div>
      {children ??
        (href ? (
          <Link href={href} className="section-link">
            {hrefLabel} →
          </Link>
        ) : null)}
    </div>
  );
}

export function PageTitle({
  overline,
  title,
  lede,
  right,
}: {
  overline: string;
  title: string;
  lede?: string;
  right?: ReactNode;
}) {
  return (
    <header className="pt-8 pb-6 md:pt-12 md:pb-8 border-b border-line">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="overline text-red">{overline}</div>
          <h1 className="display mt-1 text-[clamp(2rem,7vw,3.5rem)]">{title}</h1>
          {lede ? <p className="mt-3 max-w-2xl text-muted text-[0.95rem]">{lede}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ pieces */

export function Pips({ form, limit = 6 }: { form: Array<"W" | "L" | "T">; limit?: number }) {
  const recent = form.slice(-limit);
  if (recent.length === 0) return <span className="text-muted-2">—</span>;
  return (
    <span className="inline-flex gap-[3px]" title={`Last ${recent.length} games`}>
      {recent.map((r, i) => (
        <span key={i} className={`pip pip-${r}`}>
          {r}
        </span>
      ))}
    </span>
  );
}

export function Movement({ value }: { value: number }) {
  if (!value) {
    return (
      <span className="badge" title="No change from last week">
        —
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={`badge ${up ? "badge-up" : "badge-down"}`}
      title={`${up ? "Up" : "Down"} ${Math.abs(value)} from last week`}
    >
      {up ? "▲" : "▼"} {Math.abs(value)}
    </span>
  );
}

export function StatLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-3 py-2.5">
      <span className="block overline">{label}</span>
      <span className="block display num text-[1.4rem] leading-none mt-1">{value}</span>
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="panel grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-line">
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-muted text-sm">{children}</p>
    </div>
  );
}
