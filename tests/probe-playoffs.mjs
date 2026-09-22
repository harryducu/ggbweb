/** Does the playoff form round-trip scores, the winner override and champion? */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { commissionerCookie } from "./helpers.mjs";

const BASE = "http://localhost:3002";
const FILE = "/private/tmp/claude-501/-Users-harry/2fbc1d08-8165-4f92-8855-2571f27f5437/scratchpad/league-t2/league.json";
const read = () => JSON.parse(readFileSync(FILE, "utf8"));

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
await ctx.addCookies([{ ...commissionerCookie(), domain: "localhost" }]);
const page = await ctx.newPage();
await page.goto(`${BASE}/commissioner/playoffs`, { waitUntil: "networkidle" });

const before = read();
const teams = Object.fromEntries(before.teams.map((t) => [t.id, t.abbreviation]));
console.log("BEFORE:", before.playoffs.series.map((s) =>
  `${s.id}[${s.team1Score ?? "-"}/${s.team2Score ?? "-"} w=${s.winnerId ?? "-"}]`).join(" "));

// Play-in 1: enter scores. Play-in 2: set a winner by hand, no scores.
await page.locator('input[name="s1_pi-1"]').fill("900");
await page.locator('input[name="s2_pi-1"]').fill("850");
const overrideTeam = before.teams.find((t) => t.abbreviation === "GT").id;
await page.locator('select[name="w_pi-2"]').selectOption(overrideTeam);
const champTeam = before.teams.find((t) => t.abbreviation === "SG").id;
await page.locator('select[name="championId"]').selectOption(champTeam);

await page.getByRole("button", { name: /save bracket/i }).click();
await page.waitForSelector("text=/bracket saved/i", { timeout: 20000 });
await page.waitForTimeout(1200);

const after = read();
console.log("AFTER :", after.playoffs.series.map((s) =>
  `${s.id}[${s.team1Score ?? "-"}/${s.team2Score ?? "-"} w=${s.winnerId ? teams[s.winnerId] : "-"}]`).join(" "));
console.log("champion:", after.playoffs.championId ? teams[after.playoffs.championId] : "-");

const pi1 = after.playoffs.series.find((s) => s.id === "pi-1");
const pi2 = after.playoffs.series.find((s) => s.id === "pi-2");
const results = {
  "scores persisted": pi1.team1Score === 900 && pi1.team2Score === 850,
  "winner override persisted": pi2.winnerId === overrideTeam,
  "champion persisted": after.playoffs.championId === champTeam,
};
for (const [k, v] of Object.entries(results)) console.log(`  ${v ? "PASS" : "FAIL"}  ${k}`);

// Reload and confirm the form shows what was saved.
await page.reload({ waitUntil: "networkidle" });
console.log("  form redisplays winner override:",
  (await page.locator('select[name="w_pi-2"]').inputValue()) === overrideTeam ? "PASS" : "FAIL");
console.log("  form redisplays scores:",
  (await page.locator('input[name="s1_pi-1"]').inputValue()) === "900" ? "PASS" : "FAIL");

// And that the public bracket advances the override winner.
await page.goto(`${BASE}/playoffs`, { waitUntil: "networkidle" });
const txt = await page.locator("main").innerText();
console.log("  public bracket names the play-in winner:",
  txt.includes(before.teams.find((t) => t.id === overrideTeam).name) ? "PASS" : "FAIL");

await browser.close();
