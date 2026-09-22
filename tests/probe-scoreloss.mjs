/**
 * Does saving a week's scores destroy scores belonging to bowlers the form
 * doesn't render an input for — the bye team's players, and free agents?
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { commissionerCookie } from "./helpers.mjs";

const BASE = "http://localhost:3002";
const FILE = "/private/tmp/claude-501/-Users-harry/2fbc1d08-8165-4f92-8855-2571f27f5437/scratchpad/league-t2/league.json";
const read = () => JSON.parse(readFileSync(FILE, "utf8"));

const names = (l, ids) => ids.map((id) => l.players.find((p) => p.id === id)?.name);
const w3 = (l) => l.weeks.find((w) => w.weekNumber === 3);

const before = read();
const beforeIds = [...new Set(w3(before).playerScores.map((s) => s.playerId))];
console.log("BEFORE save — bowlers with week 3 scores:", names(before, beforeIds).join(", "));

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
await ctx.addCookies([{ ...commissionerCookie(), domain: "localhost" }]);
const page = await ctx.newPage();

await page.goto(`${BASE}/commissioner/scores?week=3`, { waitUntil: "networkidle" });

// Type one score for a rostered bowler on a team that IS playing, then save.
const box = page.locator('input[name^="s_"]').first();
await box.fill("123");
await page.getByRole("button", { name: /save week 3/i }).click();
await page.waitForSelector("text=/game score/i", { timeout: 20000 });
console.log("save status:", (await page.locator('[role="status"]').first().innerText()).trim());

await page.waitForTimeout(1200);
const after = read();
const afterIds = [...new Set(w3(after).playerScores.map((s) => s.playerId))];
console.log("AFTER  save — bowlers with week 3 scores:", names(after, afterIds).join(", "));

const lost = beforeIds.filter((id) => !afterIds.includes(id));
console.log(lost.length ? `\nDATA LOST for: ${names(after, lost).join(", ")}` : "\nNo scores lost.");

await browser.close();
