/**
 * Sweeps every route at every viewport and reports layout problems:
 * horizontal page overflow, undersized tap targets, unreadably small text,
 * and any console or network error.
 *
 *   node tests/audit-responsive.mjs [viewport ...]
 */
import {
  ADMIN_ROUTES,
  BASE,
  PUBLIC_ROUTES,
  VIEWPORTS,
  launch,
  newPage,
  overflowReport,
  tapTargetReport,
  tinyTextReport,
} from "./helpers.mjs";

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWPORTS);
const routes = [...PUBLIC_ROUTES, ...ADMIN_ROUTES];
const browser = await launch();
let failures = 0;

for (const name of names) {
  const isPhone = Boolean(VIEWPORTS[name].isMobile ?? VIEWPORTS[name].viewport?.width < 500);
  const { ctx, page, problems } = await newPage(browser, name);
  console.log(`\n### ${name} (${VIEWPORTS[name].viewport.width}px)`);

  for (const route of routes) {
    problems.length = 0;
    let status = "ERR";
    try {
      const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 20000 });
      status = res?.status() ?? "?";
    } catch (e) {
      console.log(`  ${route} -> navigation failed: ${e.message}`);
      failures++;
      continue;
    }

    const of = await overflowReport(page);
    const lines = [];
    if (of.overflow > 1) {
      lines.push(`h-overflow ${of.overflow}px`);
      for (const c of of.culprits) {
        lines.push(`    <${c.tag}> w=${c.width} right=${c.right} "${c.text}" .${c.cls}`);
      }
    }
    if (isPhone) {
      const taps = await tapTargetReport(page);
      if (taps.length) {
        lines.push(`${taps.length} tap targets under 44px`);
        for (const t of taps.slice(0, 6)) {
          lines.push(`    <${t.tag}> ${t.w}x${t.h} "${t.label}"`);
        }
      }
      const tiny = await tinyTextReport(page);
      if (tiny.length) {
        lines.push(`${tiny.length} text nodes under 11.5px`);
        for (const t of tiny.slice(0, 4)) lines.push(`    ${t.px}px "${t.text}"`);
      }
    }
    if (problems.length) lines.push(...problems.map((p) => `js: ${p}`));

    if (lines.length) {
      failures++;
      console.log(`  ${route}  [${status}]`);
      for (const l of lines) console.log(`    ${l}`);
    } else {
      console.log(`  ${route}  [${status}] ok`);
    }
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${failures} route/viewport combinations with findings`);
