"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/commissioner", label: "Dashboard", hint: "Overview and quick actions" },
  { href: "/commissioner/scores", label: "Enter Scores", hint: "Weekly game scores" },
  { href: "/commissioner/schedule", label: "Schedule", hint: "Weeks, dates, matchups" },
  { href: "/commissioner/power-rankings", label: "Power Rankings", hint: "Order, scores, notes" },
  { href: "/commissioner/stats", label: "Stats", hint: "Season totals and categories" },
  { href: "/commissioner/players", label: "Players", hint: "Rosters and photos" },
  { href: "/commissioner/teams", label: "Teams", hint: "Names, logos, colors" },
  { href: "/commissioner/playoffs", label: "Playoffs", hint: "Bracket and results" },
  { href: "/commissioner/settings", label: "League Settings", hint: "Branding and rules" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Commissioner sections" className="lg:sticky lg:top-20">
      {/* Scroll strip on phones, stacked list on desktop. */}
      <ul className="flex lg:flex-col gap-0 overflow-x-auto lg:overflow-visible border-b lg:border-b-0 border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => {
          const active =
            s.href === "/commissioner" ? pathname === s.href : pathname.startsWith(s.href);
          return (
            <li key={s.href} className="flex-none lg:flex-auto">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "block whitespace-nowrap lg:whitespace-normal px-3 py-2.5 lg:border-l-2 transition-colors",
                  active
                    ? "lg:border-red bg-panel-2 text-cream"
                    : "lg:border-line text-muted hover:text-text hover:bg-white/[0.02]",
                ].join(" ")}
              >
                <span className="block font-display font-bold uppercase tracking-[0.12em] text-[0.74rem]">
                  {s.label}
                </span>
                <span className="hidden lg:block text-[0.72rem] text-muted-2 mt-0.5">{s.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
