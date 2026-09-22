// Read-only: capture every failed request and page error, with URLs.
import { launch } from "./helpers.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ROUTES = ["/", "/standings", "/stats", "/players", "/teams", "/schedule", "/playoffs", "/rules", "/power-rankings", "/nope-404"];

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
const page = await ctx.newPage();

const events = [];
page.on("requestfailed", (r) => events.push({ kind: "requestfailed", url: r.url(), err: r.failure()?.errorText }));
page.on("response", (r) => {
  if (r.status() >= 400) events.push({ kind: "http" + r.status(), url: r.url(), type: r.request().resourceType() });
});
page.on("pageerror", (e) => events.push({ kind: "pageerror", msg: String(e), stack: (e.stack || "").split("\n").slice(0, 4).join(" | ") }));
page.on("console", (m) => {
  if (m.type() === "error") {
    events.push({ kind: "console", text: m.text(), loc: JSON.stringify(m.location()) });
  }
});

for (const r of ROUTES) {
  events.push({ kind: "--- ROUTE", url: r });
  await page.goto(`${BASE}${r}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(1200);
}

for (const e of events) console.log(JSON.stringify(e));

await ctx.close();
await browser.close();
