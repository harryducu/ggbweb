/**
 * Deep responsive probe at the exact widths requested, with clipping,
 * sticky-element and scroller checks on top of the baseline sweep.
 *
 *   node tests/probe.mjs <viewportKey> [routeFilter]
 */
import { mkdirSync } from "node:fs";
import {
  ADMIN_ROUTES,
  BASE,
  PUBLIC_ROUTES,
  commissionerCookie,
  launch,
  overflowReport,
  tapTargetReport,
  tinyTextReport,
} from "./helpers.mjs";

export const VP = {
  "320": { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "375": { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "390": { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "414": { viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "768": { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "1024": { viewport: { width: 1024, height: 768 }, hasTouch: false },
  "1280": { viewport: { width: 1280, height: 800 } },
  "1728": { viewport: { width: 1728, height: 1000 } },
  land: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

const SCREENS = new URL("./screens/", import.meta.url).pathname;
mkdirSync(SCREENS, { recursive: true });

/** Elements that clip their own content because of overflow:hidden. */
async function clipReport(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      const hidX = cs.overflowX === "hidden" || cs.overflowX === "clip";
      const hidY = cs.overflowY === "hidden" || cs.overflowY === "clip";
      if (!hidX && !hidY) continue;
      const dx = el.scrollWidth - el.clientWidth;
      const dy = el.scrollHeight - el.clientHeight;
      if (dx <= 2 && dy <= 2) continue;
      // text-overflow:ellipsis truncation is intentional
      if (cs.textOverflow === "ellipsis") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") ?? "").slice(0, 100),
        dx,
        dy,
        w: Math.round(r.width),
        h: Math.round(r.height),
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
      });
    }
    return out.slice(0, 12);
  });
}

/** Horizontal scrollers: are they actually scrollable, and do they overflow the page? */
async function scrollerReport(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.overflowX !== "auto" && cs.overflowX !== "scroll") continue;
      const dx = el.scrollWidth - el.clientWidth;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      out.push({
        cls: (el.getAttribute("class") ?? "").slice(0, 90),
        dx,
        clientW: el.clientWidth,
        scrollW: el.scrollWidth,
        right: Math.round(r.right),
        overflowsPage: r.right > document.documentElement.clientWidth + 1,
      });
    }
    return out;
  });
}

/** Any element whose box escapes the viewport, ignoring ancestor clipping. */
async function escapeReport(page) {
  return page.evaluate(() => {
    const dw = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right <= dw + 1 && r.left >= -1) continue;
      // inside a real scroller -> fine
      let p = el.parentElement;
      let scoped = false;
      while (p) {
        const ov = getComputedStyle(p).overflowX;
        if (ov === "auto" || ov === "scroll") {
          scoped = true;
          break;
        }
        p = p.parentElement;
      }
      if (scoped) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") ?? "").slice(0, 100),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50),
      });
    }
    return out.slice(0, 10);
  });
}

/** Overlap between rendered text boxes that should not intersect. */
async function overlapReport(page) {
  return page.evaluate(() => {
    const boxes = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position === "absolute" || cs.position === "fixed" || cs.position === "sticky") continue;
      const leaf = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!leaf) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      boxes.push({ el, r });
    }
    const hits = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ox > 3 && oy > 5) {
          hits.push({
            a: (a.el.getAttribute("class") ?? a.el.tagName).slice(0, 60),
            b: (b.el.getAttribute("class") ?? b.el.tagName).slice(0, 60),
            ta: a.el.textContent.trim().slice(0, 30),
            tb: b.el.textContent.trim().slice(0, 30),
            ox: Math.round(ox),
            oy: Math.round(oy),
          });
        }
      }
    }
    return hits.slice(0, 8);
  });
}

const key = process.argv[2] ?? "320";
const filter = process.argv[3] ?? "";
const routes = [...PUBLIC_ROUTES, ...ADMIN_ROUTES].filter((r) => r.includes(filter));
const browser = await launch();
const ctx = await browser.newContext({ ...VP[key], reducedMotion: "reduce" });
await ctx.addCookies([commissionerCookie()]);
const page = await ctx.newPage();
const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e)}`));
page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()}`));

console.log(`## ${key} (${VP[key].viewport.width}x${VP[key].viewport.height})`);
for (const route of routes) {
  problems.length = 0;
  // The dev server is shared with other agents and occasionally restarts, so a
  // 5xx or a refused connection gets retried rather than reported as a defect.
  let status;
  let attempt = 0;
  while (attempt < 4) {
    attempt++;
    try {
      const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
      status = res?.status();
      if (status && status < 500) break;
    } catch (e) {
      status = `NAV-FAIL ${e.message.slice(0, 60)}`;
    }
    await new Promise((r) => setTimeout(r, 3000));
    problems.length = 0;
  }
  if (typeof status !== "number" || status >= 500) {
    console.log(`  ${route} UNREACHABLE (${status})`);
    continue;
  }
  const lines = [];
  const of = await overflowReport(page);
  if (of.overflow > 1) {
    lines.push(`PAGE-OVERFLOW ${of.overflow}px (doc ${of.docWidth})`);
    for (const c of of.culprits)
      lines.push(`   <${c.tag}> w=${c.width} right=${c.right} "${c.text}" .${c.cls}`);
  }
  const esc = await escapeReport(page);
  if (esc.length) {
    lines.push(`ESCAPES-VIEWPORT ${esc.length}`);
    for (const e of esc)
      lines.push(`   <${e.tag}> l=${e.left} r=${e.right} w=${e.w} "${e.text}" .${e.cls}`);
  }
  const clip = await clipReport(page);
  if (clip.length) {
    lines.push(`CLIPPED ${clip.length}`);
    for (const c of clip)
      lines.push(`   <${c.tag}> dx=${c.dx} dy=${c.dy} box=${c.w}x${c.h} "${c.text}" .${c.cls}`);
  }
  const sc = await scrollerReport(page);
  const bad = sc.filter((s) => s.overflowsPage);
  if (bad.length) {
    lines.push(`SCROLLER-OVERFLOWS-PAGE ${bad.length}`);
    for (const s of bad) lines.push(`   right=${s.right} dx=${s.dx} .${s.cls}`);
  }
  if (VP[key].hasTouch) {
    const taps = await tapTargetReport(page);
    if (taps.length) {
      lines.push(`TAP ${taps.length}`);
      for (const t of taps) lines.push(`   <${t.tag}> ${t.w}x${t.h} "${t.label}" .${t.cls}`);
    }
    const tiny = await tinyTextReport(page);
    if (tiny.length) {
      lines.push(`TINY ${tiny.length}`);
      for (const t of tiny) lines.push(`   ${t.px}px "${t.text}" .${t.cls}`);
    }
  }
  const ovl = await overlapReport(page);
  if (ovl.length) {
    lines.push(`OVERLAP ${ovl.length}`);
    for (const o of ovl) lines.push(`   ${o.ox}x${o.oy} "${o.ta}" vs "${o.tb}" | .${o.a} | .${o.b}`);
  }
  if (problems.length) lines.push(...problems.map((p) => `JS ${p}`));

  if (lines.length) {
    console.log(`  ${route} [${status}]`);
    for (const l of lines) console.log(`    ${l}`);
  } else {
    console.log(`  ${route} [${status}] ok`);
  }
}
await ctx.close();
await browser.close();
