import Link from "next/link";
import { SiteNav } from "./site-nav";
import type { LeagueSettings } from "@/lib/types";

export function SiteHeader({
  settings,
  isCommissioner,
}: {
  settings: LeagueSettings;
  isCommissioner: boolean;
}) {
  return (
    <header>
      {/* Masthead: the league's identity, always at full strength. */}
      <div className="relative border-b border-line bg-ink-2 overflow-hidden">
        {/* Suggestion of a lane and pin deck behind the mark — texture, not a photo. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            background:
              "radial-gradient(60% 120% at 12% 50%, rgba(225,29,46,0.16), transparent 60%), repeating-linear-gradient(90deg, rgba(201,154,91,0.05) 0 1px, transparent 1px 58px)",
          }}
        />
        <div className="wrap relative flex items-center justify-between gap-4 py-3.5">
          <Link href="/" className="flex items-center gap-3 min-w-0 group">
            {settings.logo ? (
              <img
                src={settings.logo}
                alt=""
                width={52}
                height={52}
                className="h-11 w-11 md:h-13 md:w-13 object-contain flex-none"
              />
            ) : null}
            <span className="min-w-0">
              <span className="block display text-[clamp(1.05rem,3.6vw,1.6rem)] text-cream group-hover:text-white transition-colors truncate">
                {settings.name}
              </span>
              <span className="block overline mt-0.5 truncate">
                {settings.tagline ? `${settings.tagline} • ` : ""}
                {settings.season}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 flex-none">
            <span className="hidden sm:inline-flex badge badge-live">
              Week {settings.currentWeek}
            </span>
            <Link
              href="/commissioner"
              className="btn btn-ghost btn-sm"
              title={isCommissioner ? "You are signed in" : "Commissioner sign in"}
            >
              {isCommissioner ? "◆ Commissioner" : "Commissioner"}
            </Link>
          </div>
        </div>
      </div>

      <SiteNav />
    </header>
  );
}
