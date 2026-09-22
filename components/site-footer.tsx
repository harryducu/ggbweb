import Link from "next/link";
import type { LeagueSettings } from "@/lib/types";

export function SiteFooter({ settings }: { settings: LeagueSettings }) {
  return (
    <footer className="mt-16 border-t border-line bg-ink-2">
      <div className="wrap py-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-md">
            <div className="display text-cream text-xl">{settings.name}</div>
            <p className="mt-2 text-sm text-muted-2 leading-relaxed">{settings.description}</p>
          </div>
          <div className="flex gap-10">
            <div>
              <div className="overline mb-2">League</div>
              <ul className="space-y-1.5 text-sm text-muted">
                <li>
                  <Link href="/standings" className="hover:text-cream">
                    Standings
                  </Link>
                </li>
                <li>
                  <Link href="/schedule" className="hover:text-cream">
                    Schedule
                  </Link>
                </li>
                <li>
                  <Link href="/playoffs" className="hover:text-cream">
                    Playoffs
                  </Link>
                </li>
                <li>
                  <Link href="/rules" className="hover:text-cream">
                    Rules
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="overline mb-2">People</div>
              <ul className="space-y-1.5 text-sm text-muted">
                <li>
                  <Link href="/players" className="hover:text-cream">
                    Players
                  </Link>
                </li>
                <li>
                  <Link href="/teams" className="hover:text-cream">
                    Teams
                  </Link>
                </li>
                <li>
                  <Link href="/stats" className="hover:text-cream">
                    Stats
                  </Link>
                </li>
                <li>
                  <Link href="/commissioner" className="hover:text-cream">
                    Commissioner
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-9 pt-5 border-t border-line flex flex-wrap items-center justify-between gap-3">
          <span className="overline">Let the good rolls</span>
          <span className="overline">Bowling · Friends · Competition · Tradition</span>
        </div>
      </div>
    </footer>
  );
}
