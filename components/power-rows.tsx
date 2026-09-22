import Link from "next/link";
import { Crest, Movement } from "./ui";
import { fmtInt, fmtRecord, type PowerRow } from "@/lib/stats";

/**
 * Power ranking row. The team-colored wash and medal chips are lifted from the
 * league's own weekly graphic, so the site and the Instagram post read as one
 * brand. `showNote` is off in the home-page teaser to keep it dense.
 */
export function PowerRankRow({ row, showNote = true }: { row: PowerRow; showNote?: boolean }) {
  const medal = row.position <= 3 ? String(row.position) : undefined;

  return (
    <div
      className="team-bar border-b border-line last:border-b-0"
      style={{
        ["--team" as string]: row.team.color,
        background: `linear-gradient(90deg, ${hexA(row.team.color, 0.17)} 0%, ${hexA(row.team.color, 0.04)} 34%, transparent 62%)`,
      }}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="rank flex-none" data-medal={medal}>
          {row.position}
        </span>

        <Crest team={row.team} size={30} />

        <Link
          href={`/teams/${row.team.id}`}
          className="flex-1 min-w-0 group self-stretch flex flex-col justify-center py-1.5"
        >
          <span className="block display text-[clamp(0.95rem,3.2vw,1.2rem)] text-cream group-hover:text-white transition-colors truncate">
            {row.team.name}
          </span>
          {showNote ? null : (
            <span className="block text-[0.72rem] text-muted-2 num">
              {fmtRecord(row.standing)} · {fmtInt(row.standing?.totalPins)} pins
            </span>
          )}
        </Link>

        {showNote ? (
          <>
            <span className="hidden sm:flex flex-none flex-col items-end w-20">
              <span className="overline">Record</span>
              <span className="num font-semibold text-[0.95rem]">{fmtRecord(row.standing)}</span>
            </span>
            <span className="hidden md:flex flex-none flex-col items-end w-20">
              <span className="overline">Pins</span>
              <span className="num font-semibold text-[0.95rem]">
                {fmtInt(row.standing?.totalPins)}
              </span>
            </span>
            <span className="flex-none flex flex-col items-end w-16">
              <span className="overline">Power</span>
              <span className="display num text-[1.35rem] text-gold leading-none">
                {row.score ?? "—"}
              </span>
            </span>
          </>
        ) : null}

        <span className="flex-none">
          <Movement value={row.movement} />
        </span>
      </div>

      {showNote && row.description ? (
        <p className="px-3 pb-3 -mt-0.5 pl-[3.5rem] text-[0.85rem] leading-relaxed text-muted max-w-3xl">
          {row.description}
        </p>
      ) : null}

      {showNote ? (
        <div className="sm:hidden flex gap-4 px-3 pb-2.5 pl-[3.5rem] -mt-1">
          <span className="text-[0.72rem] text-muted-2 num">Record {fmtRecord(row.standing)}</span>
          <span className="text-[0.72rem] text-muted-2 num">
            {fmtInt(row.standing?.totalPins)} pins
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Hex + alpha → rgba(), so team colors can tint a row without a second token. */
function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full.slice(0, 6) || "666666", 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
