import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { readLeague } from "@/lib/store";
import { isCommissioner } from "@/lib/auth";

const sans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await readLeague();
  return {
    title: {
      default: `${settings.name} — ${settings.season}`,
      template: `%s · ${settings.name}`,
    },
    description: settings.description,
    icons: settings.logo ? { icon: settings.logo } : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const league = await readLeague();
  const admin = await isCommissioner();

  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>
        <a
          href="#main"
          className="sr focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:px-3 focus:py-2 focus:bg-red focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader settings={league.settings} isCommissioner={admin} />
        <main id="main">{children}</main>
        <SiteFooter settings={league.settings} />
      </body>
    </html>
  );
}
