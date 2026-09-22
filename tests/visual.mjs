/**
 * Focused visual + interaction checks, with screenshots for every claim.
 *
 *   node tests/visual.mjs
 */
import { mkdirSync } from "node:fs";
import { BASE, commissionerCookie, launch } from "./helpers.mjs";

const DIR = new URL("./screens/", import.meta.url).pathname;
mkdirSync(DIR, { recursive: true });

const browser = await launch();
const log = (...a) => console.log(...a);

async function ctxFor(w, h) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    isMobile: w < 900,
    hasTouch: w < 900,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  await ctx.addCookies([commissionerCookie()]);
  return ctx;
}

async function go(page, route) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (r && r.status() < 500) {
        await page.evaluate(() => document.fonts.ready);
        return true;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

const shot = (page, name, opts = {}) => page.screenshot({ path: DIR + name, ...opts });

/* ============================================== 1. nav strip at 320 ======= */
{
  const ctx = await ctxFor(320, 568);
  const page = await ctx.newPage();
  await go(page, "/");
  const nav = await page.evaluate(() => {
    const ul = document.querySelector('nav[aria-label="Main"] ul');
    const links = [...ul.querySelectorAll("a")];
    return {
      clientW: ul.clientWidth,
      scrollW: ul.scrollWidth,
      scrollable: ul.scrollWidth > ul.clientWidth + 1,
      navRect: document.querySelector('nav[aria-label="Main"]').getBoundingClientRect().toJSON(),
      links: links.map((a) => ({
        label: a.textContent.trim(),
        left: Math.round(a.getBoundingClientRect().left),
        right: Math.round(a.getBoundingClientRect().right),
        h: Math.round(a.getBoundingClientRect().height),
      })),
    };
  });
  log("NAV-320", JSON.stringify(nav));
  await shot(page, "nav-strip-320-start.png", { clip: { x: 0, y: 0, width: 320, height: 140 } });

  // scroll the strip fully right and confirm the last link becomes visible
  const end = await page.evaluate(async () => {
    const ul = document.querySelector('nav[aria-label="Main"] ul');
    ul.scrollLeft = ul.scrollWidth;
    await new Promise((r) => requestAnimationFrame(r));
    const last = ul.querySelector("li:last-child a");
    const r = last.getBoundingClientRect();
    return {
      scrollLeft: ul.scrollLeft,
      lastLabel: last.textContent.trim(),
      lastLeft: Math.round(r.left),
      lastRight: Math.round(r.right),
      visible: r.left >= -1 && r.right <= document.documentElement.clientWidth + 1,
    };
  });
  log("NAV-320-SCROLL-END", JSON.stringify(end));
  await shot(page, "nav-strip-320-end.png", { clip: { x: 0, y: 0, width: 320, height: 140 } });

  // active underline tracking: visit each route, compare underline box to link box
  for (const route of ["/", "/schedule", "/stats", "/playoffs"]) {
    await go(page, route);
    const u = await page.evaluate(() => {
      const a = document.querySelector('nav[aria-label="Main"] a[aria-current="page"]');
      if (!a) return { none: true };
      const ul = document.querySelector('nav[aria-label="Main"] ul');
      ul.scrollLeft = 0;
      const bar = a.querySelector("span");
      const ar = a.getBoundingClientRect();
      const br = bar.getBoundingClientRect();
      const bs = getComputedStyle(bar);
      return {
        label: a.textContent.trim(),
        linkVisibleInStrip:
          ar.left >= ul.getBoundingClientRect().left - 1 &&
          ar.right <= ul.getBoundingClientRect().right + 1,
        linkLeft: Math.round(ar.left),
        linkRight: Math.round(ar.right),
        barLeft: Math.round(br.left),
        barRight: Math.round(br.right),
        barOpacity: bs.opacity,
        barBg: bs.backgroundColor,
        barVisibleY: Math.round(br.top),
        navBottom: Math.round(
          document.querySelector('nav[aria-label="Main"]').getBoundingClientRect().bottom,
        ),
      };
    });
    log(`NAV-ACTIVE ${route}`, JSON.stringify(u));
  }
  await ctx.close();
}

/* ========================= 2. /schedule anchor vs sticky header ========== */
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [844, 390],
]) {
  const ctx = await ctxFor(w, h);
  const page = await ctx.newPage();
  await go(page, "/schedule");
  const res = await page.evaluate(async () => {
    const out = {};
    const nav = document.querySelector('nav[aria-label="Main"]');
    location.hash = "#week-3";
    await new Promise((r) => setTimeout(r, 400));
    const sec = document.getElementById("week-3");
    const secTop = sec.getBoundingClientRect().top;
    const navR = nav.getBoundingClientRect();
    out.navTop = Math.round(navR.top);
    out.navBottom = Math.round(navR.bottom);
    out.navHeight = Math.round(navR.height);
    out.weekTop = Math.round(secTop);
    out.headingCovered = secTop < navR.bottom;
    out.gap = Math.round(secTop - navR.bottom);
    out.scrollMt = getComputedStyle(sec).scrollMarginTop;
    // is the week heading itself readable?
    const h2 = sec.querySelector("h2");
    out.h2Top = Math.round(h2.getBoundingClientRect().top);
    out.h2Covered = h2.getBoundingClientRect().top < navR.bottom;
    return out;
  });
  log(`ANCHOR ${w}x${h}`, JSON.stringify(res));
  await shot(page, `schedule-anchor-week3-${w}.png`);
  await ctx.close();
}

/* ============================ 3. sticky nav on a short viewport ========== */
{
  const ctx = await ctxFor(844, 390);
  const page = await ctx.newPage();
  for (const route of ["/", "/schedule", "/stats"]) {
    await go(page, route);
    const r = await page.evaluate(async () => {
      window.scrollTo(0, 1200);
      await new Promise((r) => setTimeout(r, 250));
      const nav = document.querySelector('nav[aria-label="Main"]');
      const nr = nav.getBoundingClientRect();
      return {
        scrollY: Math.round(window.scrollY),
        navTop: Math.round(nr.top),
        navH: Math.round(nr.height),
        vh: window.innerHeight,
        pctOfViewport: Math.round((nr.height / window.innerHeight) * 100),
        stuck: Math.abs(nr.top) < 2,
      };
    });
    log(`STICKY-NAV-LANDSCAPE ${route}`, JSON.stringify(r));
  }
  await shot(page, "sticky-nav-landscape-844.png");
  await ctx.close();
}

/* =================== 4. sticky save bar coverage in the admin panel ====== */
for (const [w, h] of [
  [320, 568],
  [844, 390],
]) {
  const ctx = await ctxFor(w, h);
  const page = await ctx.newPage();
  for (const route of [
    "/commissioner/scores",
    "/commissioner/power-rankings",
    "/commissioner/stats",
    "/commissioner/playoffs",
    "/commissioner/teams",
  ]) {
    if (!(await go(page, route))) continue;
    const r = await page.evaluate(async () => {
      const bar = [...document.querySelectorAll("div")].find(
        (d) => getComputedStyle(d).position === "sticky" && getComputedStyle(d).bottom === "0px",
      );
      if (!bar) return { noBar: true };
      // scroll so the bar is mid-form (worst case: sticky, form still long)
      window.scrollTo(0, Math.round(document.body.scrollHeight * 0.55));
      await new Promise((r) => setTimeout(r, 250));
      const br = bar.getBoundingClientRect();
      const covered = [];
      for (const el of document.querySelectorAll(
        "input, textarea, select, button, a, td, label, p, h2, h3",
      )) {
        if (bar.contains(el)) continue;
        const r2 = el.getBoundingClientRect();
        if (r2.width === 0 || r2.height === 0) continue;
        const ox = Math.min(br.right, r2.right) - Math.max(br.left, r2.left);
        const oy = Math.min(br.bottom, r2.bottom) - Math.max(br.top, r2.top);
        if (ox > 3 && oy > 3)
          covered.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute("class") ?? "").slice(0, 55),
            label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 32),
            oy: Math.round(oy),
          });
      }
      // at the very bottom of the page, does the bar still hide the last row?
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 250));
      const br2 = bar.getBoundingClientRect();
      const coveredAtBottom = [];
      for (const el of document.querySelectorAll("input, textarea, button, a")) {
        if (bar.contains(el)) continue;
        const r3 = el.getBoundingClientRect();
        if (r3.width === 0 || r3.height === 0) continue;
        const ox = Math.min(br2.right, r3.right) - Math.max(br2.left, r3.left);
        const oy = Math.min(br2.bottom, r3.bottom) - Math.max(br2.top, r3.top);
        if (ox > 3 && oy > 3)
          coveredAtBottom.push({
            tag: el.tagName.toLowerCase(),
            label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 32),
            oy: Math.round(oy),
          });
      }
      return {
        barH: Math.round(br.height),
        barTop: Math.round(br.top),
        vh: window.innerHeight,
        barPctViewport: Math.round((br.height / window.innerHeight) * 100),
        coveredMidScroll: covered.slice(0, 6),
        coveredCount: covered.length,
        coveredAtBottom: coveredAtBottom.slice(0, 6),
      };
    });
    log(`STICKY-SAVE ${w} ${route}`, JSON.stringify(r));
    const slug = route.replace(/\//g, "_");
    await shot(page, `stickysave${slug}-${w}.png`);
  }
  await ctx.close();
}

/* =========================== 5. targeted screenshots of reported defects = */
{
  const shots = [
    ["/commissioner/scores", 320, "commissioner-scores-320.png", true],
    ["/commissioner/scores", 375, "commissioner-scores-375.png", true],
    ["/commissioner/power-rankings", 320, "commissioner-power-rankings-320.png", true],
    ["/commissioner/schedule", 320, "commissioner-schedule-320.png", true],
    ["/commissioner/players", 320, "commissioner-players-320.png", true],
    ["/commissioner/teams", 320, "commissioner-teams-320.png", true],
    ["/commissioner/stats", 320, "commissioner-stats-320.png", true],
    ["/stats", 320, "stats-320.png", true],
    ["/stats", 768, "stats-768.png", true],
    ["/schedule", 320, "schedule-320.png", true],
    ["/playoffs", 320, "playoffs-320.png", true],
    ["/playoffs", 1024, "playoffs-1024.png", true],
    ["/standings", 320, "standings-320.png", true],
    ["/players", 320, "players-320.png", true],
    ["/", 320, "home-320.png", true],
    ["/teams", 320, "teams-320.png", true],
    ["/rules", 320, "rules-320.png", true],
    ["/teams/back-alley-bowljobs", 320, "team-detail-320.png", true],
    ["/players/charlie-dixon", 320, "player-detail-320.png", true],
    ["/commissioner/settings", 320, "commissioner-settings-320.png", true],
  ];
  for (const [route, w, name, full] of shots) {
    const ctx = await ctxFor(w, w < 500 ? 568 : 1024);
    const page = await ctx.newPage();
    if (await go(page, route)) {
      await new Promise((r) => setTimeout(r, 300));
      await shot(page, name, { fullPage: full });
      log("SHOT", name);
    }
    await ctx.close();
  }
}

await browser.close();
log("done");
