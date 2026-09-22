// Shared helpers for the commissioner-portal functional audit.
import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

export const BASE = process.env.BASE ?? "http://localhost:3001";
export const DATA =
  "/private/tmp/claude-501/-Users-harry/2fbc1d08-8165-4f92-8855-2571f27f5437/scratchpad/league-test/league.json";
export const PRISTINE =
  "/private/tmp/claude-501/-Users-harry/2fbc1d08-8165-4f92-8855-2571f27f5437/scratchpad/league-pristine.json";

export function league() {
  return JSON.parse(readFileSync(DATA, "utf8"));
}
export function restore() {
  copyFileSync(PRISTINE, DATA);
}
export function writeLeague(l) {
  writeFileSync(DATA, JSON.stringify(l, null, 2));
}

export function cookie() {
  const env = readFileSync("/Users/harry/goodguys-bowling/.env.local", "utf8");
  const secret = /SESSION_SECRET=(.*)/.exec(env)[1].trim();
  const expiresAt = Date.now() + 3600e3;
  return {
    name: "gg_commish",
    value: `${expiresAt}.${createHmac("sha256", secret).update(String(expiresAt)).digest("hex")}`,
    domain: "localhost",
    path: "/",
  };
}

export const WIDTHS = { desktop: 1280, phone: 390 };

export async function browser() {
  return chromium.launch({ channel: "chrome" });
}

export async function page(br, width = 1280, { admin = true, cookieValue } = {}) {
  const ctx = await br.newContext({
    viewport: { width, height: width < 500 ? 844 : 900 },
    isMobile: width < 500,
    hasTouch: width < 500,
    reducedMotion: "reduce",
  });
  if (admin) {
    const c = cookie();
    if (cookieValue) c.value = cookieValue;
    await ctx.addCookies([c]);
  }
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  p.setDefaultNavigationTimeout(120000);
  const problems = [];
  p.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 200)}`);
  });
  p.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  return { ctx, page: p, problems };
}

/**
 * Waits until React has hydrated by proving a client-only interaction works.
 * Everything in the admin panel is useActionState-driven, so a fill that lands
 * before hydration is silently discarded when React takes over.
 */
export async function hydrated(p, probe) {
  await p.waitForLoadState("domcontentloaded");
  const start = Date.now();
  while (Date.now() - start < 60000) {
    if (await probe()) return true;
    await p.waitForTimeout(200);
  }
  return false;
}

/**
 * Hydration probe that doesn't disturb state: React attaches its internal
 * fiber/props keys to DOM nodes as it hydrates them.
 */
export async function hydratedScores(p) {
  await p.locator("form").first().waitFor();
  return hydrated(p, () =>
    p.evaluate(() => {
      const forms = [...document.querySelectorAll("form")];
      return (
        forms.length > 0 &&
        forms.every((el) => Object.keys(el).some((k) => k.startsWith("__react")))
      );
    }),
  );
}
export const hydratedForm = hydratedScores;

/** All visible status messages on the page, newest-last. */
export async function statuses(p) {
  return p.locator("[role=status]").allInnerTexts();
}

/**
 * Submits by clicking `locator` and waits until a [role=status] inside
 * `scope` appears or changes. Returns its text.
 */
export async function submitAndWait(p, clickLocator, scope, { timeout = 15000 } = {}) {
  const before = await scope.locator("[role=status]").allInnerTexts();
  await clickLocator.click();
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const now = await scope.locator("[role=status]").allInnerTexts();
    if (JSON.stringify(now) !== JSON.stringify(before) && now.length) return now.join(" | ");
    await p.waitForTimeout(120);
  }
  return null;
}

const results = [];
export function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
export function info(...a) {
  console.log("      ·", ...a);
}
export function summary(label) {
  const bad = results.filter((r) => !r.pass);
  console.log(`\n===== ${label}: ${results.length - bad.length}/${results.length} passed =====`);
  for (const b of bad) console.log(`  FAIL: ${b.name} — ${b.detail}`);
}
