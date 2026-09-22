"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/standings", label: "Standings" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/players", label: "Players" },
  { href: "/teams", label: "Teams" },
  { href: "/stats", label: "Stats" },
  { href: "/playoffs", label: "Playoffs" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-30 border-b border-line bg-ink/92 backdrop-blur-sm"
    >
      <div className="wrap">
        {/* Horizontal scroll strip: reads as a tab bar on desktop, swipes on
            phones. Beats a hamburger for eight short destinations. */}
        <ul className="flex items-stretch gap-0 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <li key={link.href} className="flex-none">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative block px-3 py-3 whitespace-nowrap font-display font-bold uppercase tracking-[0.13em] text-[0.74rem] transition-colors",
                    active ? "text-cream" : "text-muted hover:text-text",
                  ].join(" ")}
                >
                  {link.label}
                  <span
                    className={[
                      "absolute left-2 right-2 -bottom-px h-[2px] transition-opacity",
                      active ? "bg-red opacity-100" : "opacity-0",
                    ].join(" ")}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
