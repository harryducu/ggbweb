// Read-only accessibility + metadata audit across every public route.
import { launch, newPage, PUBLIC_ROUTES } from "./helpers.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";

const ROUTES = [
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

const browser = await launch();
const { ctx, page, problems } = await newPage(browser, "desktop", { admin: false });

/* ---------------------------------------------------- contrast utilities */
const contrastScript = `
(() => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (s) => {
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
  const bgOf = (el) => {
    let n = el;
    let acc = null;
    while (n && n.nodeType === 1) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        acc = acc === null ? { rgb: c.rgb, a: c.a } : acc;
        if (c.a >= 0.999) return acc.a >= 0.999 ? acc.rgb : over(acc.rgb, c.rgb, acc.a);
      }
      n = n.parentElement;
    }
    return acc ? (acc.a >= 0.999 ? acc.rgb : over(acc.rgb, [9, 9, 11], acc.a)) : [9, 9, 11];
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const fgp = parse(cs.color);
    if (!fgp) continue;
    const bg = bgOf(el);
    const fg = fgp.a >= 0.999 ? fgp.rgb : over(fgp.rgb, bg, fgp.a);
    const px = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // WCAG "large text": >=18.66px normal, or >=14px bold.
    const large = px >= 18.66 || (px >= 14 && weight >= 700);
    const need = large ? 3.0 : 4.5;
    const cr = ratio(fg, bg);
    if (cr >= need) continue;
    const key = cs.color + "|" + px + "|" + weight + "|" + (el.getAttribute("class") || "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ratio: Math.round(cr * 100) / 100,
      need,
      px: Math.round(px * 10) / 10,
      weight,
      large,
      color: cs.color,
      cls: (el.getAttribute("class") || "").slice(0, 70),
      text: el.textContent.trim().slice(0, 45),
    });
  }
  return out.sort((a, b) => a.ratio - b.ratio);
})()
`;

const report = {};
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 90000 });

  const meta = await page.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content ?? null,
    lang: document.documentElement.lang,
  }));

  const headings = await page.$$eval("h1,h2,h3,h4,h5,h6", (hs) =>
    hs.map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim().slice(0, 40) })),
  );
  const h1s = headings.filter((h) => h.level === 1);
  const skips = [];
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      skips.push(`h${headings[i - 1].level} -> h${headings[i].level} (${headings[i].text})`);
    }
  }

  const imgs = await page.$$eval("img", (is) =>
    is.map((i) => ({ src: (i.getAttribute("src") || "").slice(0, 50), alt: i.getAttribute("alt") })),
  );
  const imgsNoAlt = imgs.filter((i) => i.alt === null);

  const inputs = await page.$$eval("input,select,textarea", (els) =>
    els.map((el) => {
      const id = el.id;
      const labelled =
        (id && document.querySelector(`label[for="${id}"]`)) ||
        el.closest("label") ||
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.getAttribute("title");
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type"),
        labelled: Boolean(labelled),
        name: el.getAttribute("name") || el.getAttribute("placeholder") || "",
      };
    }),
  );
  const unlabelled = inputs.filter((i) => !i.labelled);

  const ths = await page.$$eval("table th", (els) =>
    els.map((th) => ({ text: th.textContent.trim().slice(0, 14), scope: th.getAttribute("scope") })),
  );
  const thsNoScope = ths.filter((t) => t.scope === null);

  const tablesNoCaption = await page.$$eval("table", (ts) =>
    ts.filter((t) => !t.querySelector("caption") && !t.getAttribute("aria-label") && !t.getAttribute("aria-labelledby")).length,
  );

  const landmarks = await page.evaluate(() => ({
    main: document.querySelectorAll("main").length,
    nav: document.querySelectorAll("nav").length,
    header: document.querySelectorAll("body > header").length,
    footer: document.querySelectorAll("footer").length,
    skipLink: document.querySelector('a[href="#main"]')?.textContent?.trim() ?? null,
  }));

  const contrast = await page.evaluate(contrastScript);

  report[route] = { meta, h1Count: h1s.length, h1: h1s.map((h) => h.text), skips, headings: headings.length, imgsNoAlt, unlabelled, thTotal: ths.length, thsNoScope: thsNoScope.length, tablesNoCaption, landmarks, contrast };

  console.log("=".repeat(72));
  console.log(route);
  console.log("  title:", JSON.stringify(meta.title));
  console.log("  desc :", meta.desc ? meta.desc.slice(0, 70) + "…" : "(none)");
  console.log(`  lang=${meta.lang}  h1=${h1s.length} ${JSON.stringify(h1s.map((h) => h.text))}  headings=${headings.length}`);
  console.log("  heading skips:", skips.length ? skips : "none");
  console.log(`  imgs=${imgs.length} missing-alt=${imgsNoAlt.length}`, imgsNoAlt.length ? imgsNoAlt : "");
  console.log(`  inputs=${inputs.length} unlabelled=${unlabelled.length}`, unlabelled.length ? unlabelled : "");
  console.log(`  th=${ths.length} without-scope=${thsNoScope.length}  tables-without-caption/label=${tablesNoCaption}`);
  console.log("  landmarks:", JSON.stringify(landmarks));
  console.log(`  contrast failures (unique styles): ${contrast.length}`);
  for (const c of contrast.slice(0, 8)) {
    console.log(`     ${c.ratio}:1 (needs ${c.need}) ${c.px}px w${c.weight}${c.large ? " LARGE" : ""} ${c.color} .${c.cls} — ${JSON.stringify(c.text)}`);
  }
}

/* ------------------------------------------------- keyboard / focus check */
console.log("\n" + "=".repeat(72));
console.log("KEYBOARD TAB ORDER + FOCUS VISIBILITY  (/standings)");
await page.goto(`${BASE}/standings`, { waitUntil: "load", timeout: 90000 });
const tabStops = [];
for (let i = 0; i < 22; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").trim().slice(0, 34),
      href: el.getAttribute("href"),
      outlineWidth: cs.outlineWidth,
      outlineStyle: cs.outlineStyle,
      outlineColor: cs.outlineColor,
      y: Math.round(r.top),
      x: Math.round(r.left),
    };
  });
  if (!info) break;
  tabStops.push(info);
}
for (const [i, t] of tabStops.entries()) {
  const ring = t.outlineStyle !== "none" && parseFloat(t.outlineWidth) > 0;
  console.log(`  ${String(i + 1).padStart(2)} ${ring ? "ring" : "NO-RING"} ${t.tag} ${JSON.stringify(t.text)} -> ${t.href ?? ""} @(${t.x},${t.y}) outline=${t.outlineWidth} ${t.outlineStyle} ${t.outlineColor}`);
}
const noRing = tabStops.filter((t) => !(t.outlineStyle !== "none" && parseFloat(t.outlineWidth) > 0));
console.log("  tab stops without a visible focus ring:", noRing.length);
// DOM order vs visual order (monotonic-ish top coordinate within the page flow)
let regressions = 0;
for (let i = 1; i < tabStops.length; i++) {
  if (tabStops[i].y < tabStops[i - 1].y - 40) regressions++;
}
console.log("  backward vertical jumps in tab order:", regressions);

console.log("\nCONSOLE/NETWORK PROBLEMS:", problems.length ? problems : "none");

/* --------------------------------------------------------- title/desc uniqueness */
console.log("\n" + "=".repeat(72));
console.log("TITLE / DESCRIPTION UNIQUENESS");
const titles = {};
const descs = {};
for (const [r, v] of Object.entries(report)) {
  titles[v.meta.title] = (titles[v.meta.title] || []).concat(r);
  descs[v.meta.desc] = (descs[v.meta.desc] || []).concat(r);
}
console.log("distinct titles:", Object.keys(titles).length, "/", ROUTES.length);
for (const [t, rs] of Object.entries(titles)) if (rs.length > 1) console.log("  DUPLICATE TITLE:", JSON.stringify(t), rs);
console.log("distinct descriptions:", Object.keys(descs).length, "/", ROUTES.length);
for (const [d, rs] of Object.entries(descs)) if (rs.length > 1) console.log(`  DUPLICATE DESC (${rs.length} routes):`, JSON.stringify((d || "").slice(0, 60)), rs);

await ctx.close();
await browser.close();
