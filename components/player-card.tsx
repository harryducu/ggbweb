import Link from "next/link";
import { fmtAvg, fmtInt, initials, type PlayerStats } from "@/lib/stats";

/**
 * Player tile. Built to look right both with real photos and before any have
 * been uploaded — the fallback is a monogram on a team-tinted plate, not a
 * grey box with a person icon.
 */
export function PlayerCard({ stats, rank }: { stats: PlayerStats; rank?: number }) {
  const { player, team } = stats;
  const color = team?.color ?? "#3a3a44";

  return (
    <Link
      href={`/players/${player.id}`}
      className="group panel overflow-hidden flex flex-col hover:border-line-2 transition-colors"
    >
      <div className="relative aspect-[4/5] bg-panel-2 overflow-hidden">
        {player.photo ? (
          <img
            src={player.photo}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(90% 70% at 50% 110%, ${color}38, transparent 70%)`,
              }}
            />
            <span className="absolute inset-0 grid place-items-center display text-[2.6rem] text-white/25">
              {initials(player.name)}
            </span>
          </>
        )}

        {rank !== undefined && rank <= 3 ? (
          <span className="absolute top-2 left-2 rank" data-medal={String(rank)}>
            {rank}
          </span>
        ) : null}

        {/* Name plate sits on the photo so the card stays compact. */}
        <div className="absolute inset-x-0 bottom-0 pt-8 pb-2 px-2.5 bg-gradient-to-t from-black/88 to-transparent">
          <div className="display text-[0.98rem] leading-tight text-cream truncate">
            {player.name}
          </div>
          <div className="overline truncate" style={{ color }}>
            {team?.abbreviation ?? "Free agent"}
          </div>
        </div>
      </div>

      <div className="h-[2px] flex-none" style={{ background: color }} aria-hidden />

      <dl className="grid grid-cols-3 divide-x divide-line text-center">
        <Cell label="Avg" value={fmtAvg(stats.average)} strong />
        <Cell label="Pins" value={fmtInt(stats.totalScore)} />
        <Cell label="X" value={fmtInt(stats.strikes)} />
      </dl>
    </Link>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="py-2">
      <dd className={`display num text-[1.05rem] leading-none ${strong ? "text-cream" : ""}`}>
        {value}
      </dd>
      <dt className="overline mt-1">{label}</dt>
    </div>
  );
}
