// Focused: decimal power score, and whether the drag handlers work at all.
import { BASE, browser, page, restore, league, check, info, summary, hydratedForm } from "./tlib.mjs";

const br = await browser();
const { ctx, page: p } = await page(br, 1280);
const open = async () => {
  await p.goto(`${BASE}/commissioner/power-rankings`, { waitUntil: "domcontentloaded" });
  await hydratedForm(p);
};
restore();
await open();

const order = (await p.locator("input[name=order]").inputValue()).split(",");
const first = order[0];

// ---------------------------------------------- A: integer power score saves
{
  const box = p.locator(`input[name="score_${first}"]`);
  await box.fill("92");
  await p.locator(`textarea[name="note_${first}"]`).fill("integer probe");
  await p.getByRole("button", { name: /publish rankings/i }).click();
  await p.waitForTimeout(3500);
  const t = league().teams.find((x) => x.id === first);
  check("integer power score publishes", t.powerScore === 92 && /integer probe/.test(t.powerRankingDescription), JSON.stringify(t.powerScore));
}

// ---------------------------------------------- B: decimal power score blocked
restore();
await open();
{
  const box = p.locator(`input[name="score_${first}"]`);
  await box.fill("92.5");
  const valid = await box.evaluate((el) => el.checkValidity());
  const vmsg = await box.evaluate((el) => el.validationMessage);
  const step = await box.getAttribute("step");
  info(`score input: step=${step} checkValidity=${valid} msg="${vmsg}"`);
  await p.locator(`textarea[name="note_${first}"]`).fill("decimal probe");
  await p.getByRole("button", { name: /publish rankings/i }).click();
  await p.waitForTimeout(3500);
  const t = league().teams.find((x) => x.id === first);
  const statuses = await p.locator("[role=status]").allInnerTexts();
  check(
    "decimal power score (92.5) is accepted and saved",
    t.powerScore === 92.5,
    `saved=${JSON.stringify(t.powerScore)} note=${JSON.stringify(t.powerRankingDescription)} validity="${vmsg}" statuses=${JSON.stringify(statuses)}`,
  );
  check(
    "a blocked publish tells the user something went wrong",
    t.powerScore === 92.5 || statuses.length > 0,
    `statuses=${JSON.stringify(statuses)} (nothing saved, nothing said)`,
  );
}

// ---------------------------------------------- C: drag handlers, synthetically
restore();
await open();
{
  const before = (await p.locator("input[name=order]").inputValue()).split(",");
  const moved = await p.evaluate(() => {
    const items = [...document.querySelectorAll("ol > li")];
    const dt = new DataTransfer();
    const fire = (el, type) =>
      el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    fire(items[0], "dragstart");
    fire(items[3], "dragover");
    fire(items[3], "drop");
    fire(items[0], "dragend");
    return true;
  });
  await p.waitForTimeout(400);
  const after = (await p.locator("input[name=order]").inputValue()).split(",");
  check(
    "drag handlers reorder when real HTML5 drag events are delivered",
    after[3] === before[0] && after[0] === before[1],
    `${before.slice(0, 4)} -> ${after.slice(0, 4)} (moved=${moved})`,
  );

  // and the reordered list can then be published
  await p.getByRole("button", { name: /publish rankings/i }).click();
  await p.waitForTimeout(3500);
  const l = league();
  check(
    "a drag-reordered list publishes in the new order",
    after.every((id, i) => l.teams.find((t) => t.id === id).powerRanking === i + 1),
    JSON.stringify(after.map((id) => [id, l.teams.find((t) => t.id === id).powerRanking])),
  );
}

summary("t6b-power");
await ctx.close();
await br.close();
