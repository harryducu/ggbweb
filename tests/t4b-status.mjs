// Diagnostic: does an accordion form actually show its save confirmation?
// And does a week save really wipe a free agent's scores (knock-on re-check)?
import { BASE, browser, page, restore, league, writeLeague, check, info, summary, hydratedForm } from "./tlib.mjs";

const br = await browser();
const { ctx, page: p } = await page(br, 1280);
restore();

// ---------------------------------------------- A: status message visibility
await p.goto(`${BASE}/commissioner/teams`, { waitUntil: "domcontentloaded" });
await hydratedForm(p);
const d = p.locator("details").first();
await d.locator("summary").click();
const form = d.locator("form", { has: p.locator("input[name=manualWins]") });
await form.locator("input[name=name]").fill("Status Probe FC");

info("statuses before submit:", JSON.stringify(await p.locator("[role=status]").allInnerTexts()));
await form.getByRole("button", { name: /save team/i }).click();

for (const ms of [500, 1000, 2000, 4000, 8000]) {
  await p.waitForTimeout(ms === 500 ? 500 : ms / 2);
  const all = await p.locator("[role=status]").allInnerTexts();
  const inForm = await form.locator("[role=status]").allInnerTexts();
  const visible = await p.locator("[role=status]").filter({ hasText: /./ }).count();
  info(`t+${ms}ms page=${JSON.stringify(all)} inForm=${JSON.stringify(inForm)} nonEmpty=${visible}`);
}
const saved = league().teams.find((t) => t.name === "Status Probe FC");
const finalStatuses = await p.locator("[role=status]").allInnerTexts();
check(
  "accordion save writes data",
  !!saved,
  String(saved?.name),
);
check(
  "accordion save shows a visible confirmation message",
  finalStatuses.some((t) => /saved/i.test(t)),
  JSON.stringify(finalStatuses),
);
const stillOpen = await d.evaluate((el) => el.open);
check("accordion stays open after save", stillOpen === true, String(stillOpen));

// ------------------------------------- B: knock-on wipe, with proof of the save
restore();
{
  const l = league();
  const orphan = l.players[0];
  orphan.teamId = null;
  const w = l.weeks.find((x) => x.weekNumber === 3);
  w.playerScores.push({ playerId: orphan.id, game: 1, score: 111, strikes: 2 });
  writeLeague(l);

  await p.goto(`${BASE}/commissioner/scores?week=3`, { waitUntil: "domcontentloaded" });
  await hydratedForm(p);
  const box = p.locator('input[aria-label$="game 1 score"]').first();
  const who = await box.getAttribute("aria-label");
  await box.fill("222");
  await p.getByRole("button", { name: /save week 3/i }).click();
  await p.waitForTimeout(4000);

  const after = league().weeks.find((x) => x.weekNumber === 3);
  const proof = after.playerScores.find((s) => s.score === 222);
  const orphanScore = after.playerScores.find((s) => s.playerId === orphan.id);
  check("knock-on probe: the save definitely landed", !!proof, `${who} -> ${JSON.stringify(proof)}`);
  check(
    "knock-on: free agent's score survives that save",
    !!orphanScore,
    orphanScore ? JSON.stringify(orphanScore) : `GONE (${orphan.name} had 111/2 in week 3)`,
  );
}

summary("t4b-status");
await ctx.close();
await br.close();
