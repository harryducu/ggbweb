/**
 * Fast overflow-only sweep across every requested width, one browser, one
 * context per width. Cheap enough to cover 9 widths x 24 routes.
 *
 *   node tests/widths.mjs
 */
import { ADMIN_ROUTES, BASE, PUBLIC_ROUTES, commissionerCookie, launch } from "./helpers.mjs";

const WIDTHS = [
  ["320", 320, 568, true],
  ["375", 375, 667, true],
  ["390", 390, 844, true],
  ["414", 414, 896, true],
  ["768", 768, 1024, true],
  ["844x390", 844, 390, true],
  ["1024", 1024, 768, false],
  ["1280", 1280, 800, false],
  ["1728", 1728, 1000, false],
];

const routes = [...PUBLIC_ROUTES, ...ADMIN_ROUTES];
const browser = await launch();

for (const [label, width, height, touch] of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    isMobile: touch,
    hasTouch: touch,
    reducedMotion: "reduce",
  });
  await ctx.addCookies([commissionerCookie()]);
  const page = await ctx.newPage();
  console.log(`\n## ${label} (${width}x${height})`);
  for (const route of routes) {
    let ok = false;
    for (let a = 0; a < 3 && !ok; a++) {
      try {
        const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (res && res.status() < 500) ok = true;
      } catch {
        /* retry */
      }
      if (!ok) await new Promise((r) => setTimeout(r, 2000));
    }
    if (!ok) {
      console.log(`  ${route} UNREACHABLE`);
      continue;
    }
    // let fonts/layout settle
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const dw = document.documentElement.clientWidth;
      const over = document.documentElement.scrollWidth - dw;
      const esc = [];
      if (over > 1) {
        for (const el of document.querySelectorAll("body *")) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) continue;
          if (b.right <= dw + 1) continue;
          let p = el.parentElement;
          let scoped = false;
          while (p) {
            const ov = getComputedStyle(p).overflowX;
            if (ov === "auto" || ov === "scroll" || ov === "hidden" || ov === "clip") {
              scoped = true;
              break;
            }
            p = p.parentElement;
          }
          if (scoped) continue;
          esc.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute("class") ?? "").slice(0, 90),
            w: Math.round(b.width),
            right: Math.round(b.right),
            text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 45),
          });
        }
      }
      // horizontal scrollers that spill past the viewport
      const spill = [];
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.overflowX !== "auto" && cs.overflowX !== "scroll") continue;
        const b = el.getBoundingClientRect();
        if (b.right > dw + 1 || b.left < -1)
          spill.push({ cls: (el.getAttribute("class") ?? "").slice(0, 70), right: Math.round(b.right) });
      }
      const trimmed = esc.filter(
        (c, i) => !esc.some((o, j) => j !== i && o.w > c.w && o.right >= c.right),
      );
      return { over, dw, esc: trimmed.slice(0, 5), spill };
    });
    if (r.over > 1 || r.spill.length) {
      console.log(`  ${route}  overflow=${r.over}px doc=${r.dw}`);
      for (const c of r.esc)
        console.log(`     <${c.tag}> w=${c.w} right=${c.right} "${c.text}" .${c.cls}`);
      for (const s of r.spill) console.log(`     SPILL-SCROLLER right=${s.right} .${s.cls}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log("\ndone");
