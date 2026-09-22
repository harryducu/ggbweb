import { chromium, devices } from "playwright";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

export const BASE = process.env.BASE ?? "http://localhost:3000";

/** Every public route, plus the dynamic ones with a real id. */
export const PUBLIC_ROUTES = [
  "/",
  "/standings",
  "/power-rankings",
  "/schedule",
  "/players",
  "/teams",
  "/stats",
  "/playoffs",
  "/rules",
  "/teams/back-alley-bowljobs",
  "/teams/sunday-guys",
  "/players/charlie-dixon",
  "/players/matthew-kurc",
  "/nope-404",
];

export const ADMIN_ROUTES = [
  "/commissioner",
  "/commissioner/scores",
  "/commissioner/scores?week=5",
  "/commissioner/schedule",
  "/commissioner/power-rankings",
  "/commissioner/stats",
  "/commissioner/players",
  "/commissioner/teams",
  "/commissioner/playoffs",
  "/commissioner/settings",
];

export const VIEWPORTS = {
  "iphone-se": { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
  "iphone-13": devices["iPhone 13"],
  "pixel-7": devices["Pixel 7"],
  "ipad-mini": devices["iPad Mini"],
  laptop: { viewport: { width: 1280, height: 800 } },
  desktop: { viewport: { width: 1728, height: 1000 } },
};

/**
 * Mints a valid commissioner session cookie by signing it the same way
 * lib/auth.ts does, so tests can reach the admin panel without a login step.
 */
export function commissionerCookie() {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const secret = /SESSION_SECRET=(.*)/.exec(env)[1].trim();
  const expiresAt = Date.now() + 3600e3;
  return {
    name: "gg_commish",
    value: `${expiresAt}.${createHmac("sha256", secret).update(String(expiresAt)).digest("hex")}`,
    domain: "localhost",
    path: "/",
  };
}

/** Uses the Chrome installed on this machine — no browser download required. */
export async function launch() {
  return chromium.launch({ channel: "chrome" });
}

export async function newPage(browser, viewportName, { admin = true } = {}) {
  const ctx = await browser.newContext({
    ...VIEWPORTS[viewportName],
    reducedMotion: "reduce",
  });
  if (admin) await ctx.addCookies([commissionerCookie()]);
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e)}`));
  page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()}`));
  return { ctx, page, problems };
}

/**
 * Horizontal page overflow plus the specific elements causing it. The design
 * rule is that wide content (tables, brackets) scrolls inside its own
 * container and the page body never scrolls sideways.
 */
export async function overflowReport(page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - docWidth;
    const culprits = [];
    if (overflow > 0) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right <= docWidth + 1) continue;
        // Ignore anything inside a deliberate horizontal scroller.
        let p = el.parentElement;
        let scoped = false;
        while (p) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === "auto" || ov === "scroll" || ov === "hidden") {
            scoped = true;
            break;
          }
          p = p.parentElement;
        }
        if (scoped) continue;
        culprits.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute("class") ?? "").slice(0, 110),
          right: Math.round(r.right),
          width: Math.round(r.width),
          text: (el.textContent ?? "").trim().slice(0, 50),
        });
      }
    }
    // Keep only the outermost offenders.
    const trimmed = culprits.filter(
      (c, i) => !culprits.some((o, j) => j !== i && o.width > c.width && o.right >= c.right),
    );
    return { docWidth, overflow, culprits: trimmed.slice(0, 8) };
  });
}

/**
 * Controls too small to hit reliably. Pure 44x44 is too blunt here: a numeric
 * score box in a grid is legitimately narrow, and a dense stat table row is
 * legitimately short. So flag anything under 36px tall, or small in both
 * directions.
 */
export async function tapTargetReport(page) {
  return page.evaluate(() => {
    const small = [];
    const sel = "a, button, input, select, textarea, summary, [role=button]";
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      if (r.height >= 36 && (r.width >= 36 || r.height >= 44)) continue;
      // Inline links inside prose are text, not controls.
      const inProse = el.closest("p, li, dd") && el.tagName === "A";
      if (inProse) continue;
      // The skip link is 1x1 until focused, by design.
      if (el.classList.contains("sr")) continue;
      small.push({
        tag: el.tagName.toLowerCase(),
        w: Math.round(r.width),
        h: Math.round(r.height),
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
        cls: (el.getAttribute("class") ?? "").slice(0, 70),
      });
    }
    const seen = new Set();
    return small.filter((s) => {
      const k = `${s.tag}|${s.label}|${s.w}x${s.h}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });
}

/** Text rendering below ~12px is hard to read on a phone. */
export async function tinyTextReport(page) {
  return page.evaluate(() => {
    const tiny = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!el.childNodes.length) continue;
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 2,
      );
      if (!hasText) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px >= 11.5) continue;
      tiny.push({
        px: Math.round(px * 10) / 10,
        text: el.textContent.trim().slice(0, 45),
        cls: (el.getAttribute("class") ?? "").slice(0, 60),
      });
    }
    const seen = new Set();
    return tiny.filter((t) => {
      if (seen.has(t.cls)) return false;
      seen.add(t.cls);
      return true;
    });
  });
}

export async function readLeagueFile() {
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(new URL("../data/league.json", import.meta.url), "utf8"));
}
