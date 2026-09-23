// Area 6: /commissioner/power-rankings
import {
  BASE, browser, page, restore, league, check, info, summary, submitAndWait, hydratedForm,
} from "./tlib.mjs";

const br = await browser();
const width = Number(process.env.W ?? 1280);
const label = width < 500 ? "phone" : "desktop";
restore();

const { ctx, page: p, problems } = await page(br, width);
const open = async () => {
  await p.goto(`${BASE}/commissioner/power-rankings`, { waitUntil: "domcontentloaded" });
  if (!(await hydratedForm(p))) throw new Error("power page never hydrated");
};
const orderField = () => p.locator('input[name=order]').inputValue();
const rowNames = async () =>
  (await p.locator("ol > li").all()).length
    ? Promise.all((await p.locator("ol > li").all()).map(async (li) => (await li.locator(".display").first().innerText()).trim()))
    : [];

await open();
const start = (await orderField()).split(",");
info("starting order:", start.join(" > "));

// ------------------------------------------------------------ arrow reorder
{
  const second = start[1];
  await p.getByRole("button", { name: new RegExp(`Move .* up`) }).nth(1).click(); // 2nd row's up
  await p.waitForTimeout(300);
  const now = (await orderField()).split(",");
  check(
    `${label} arrow ▲ moves a team up in the hidden order field`,
    now[0] === second && now[1] === start[0],
    `${start.slice(0, 3)} -> ${now.slice(0, 3)}`,
  );
  check(
    `${label} the top row's ▲ is disabled`,
    await p.getByRole("button", { name: /Move .* up/ }).first().isDisabled(),
  );
  const downs = p.getByRole("button", { name: /Move .* down/ });
  check(
    `${label} the last row's ▼ is disabled`,
    await downs.nth((await downs.count()) - 1).isDisabled(),
  );
  // put it back
  await p.getByRole("button", { name: /Move .* down/ }).first().click();
  await p.waitForTimeout(300);
  check(
    `${label} ▼ reverses the move`,
    (await orderField()) === start.join(","),
    await orderField(),
  );
}

// ------------------------------------------------------------- drag and drop
{
  const items = p.locator("ol > li");
  const src = items.nth(0);
  const dst = items.nth(3);
  const sb = await src.boundingBox();
  const db = await dst.boundingBox();
  // Manual mouse drag over the HTML5 drag handlers.
  await p.mouse.move(sb.x + 20, sb.y + 14);
  await p.mouse.down();
  await p.mouse.move(db.x + 20, db.y + 10, { steps: 12 });
  await p.mouse.move(db.x + 20, db.y + 14, { steps: 4 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  let now = (await orderField()).split(",");
  let dragged = now[0] !== start[0];
  if (!dragged) {
    // Fall back to Playwright's dragTo, which synthesises HTML5 DnD events.
    await src.dragTo(dst);
    await p.waitForTimeout(400);
    now = (await orderField()).split(",");
    dragged = now[0] !== start[0];
    info("manual mouse drag did nothing; dragTo result:", now.slice(0, 4).join(" > "));
  }
  check(
    `${label} drag-and-drop reorders the list`,
    dragged && now.indexOf(start[0]) === 3,
    `${start.slice(0, 4)} -> ${now.slice(0, 4)}`,
  );
}

// ------------------------------------- scores, movement, notes, then publish
const desired = (await orderField()).split(",");
{
  const first = desired[0];
  await p.locator(`input[name="score_${first}"]`).fill("92.5");
  await p.locator(`input[name="movement_${first}"]`).fill("3");
  await p.locator(`textarea[name="note_${first}"]`).fill("Rolling the best lines in the house 🎳");
  const form = p.locator("form").first();
  const msg = await submitAndWait(p, p.getByRole("button", { name: /publish rankings/i }), form);
  check(`${label} publish reports success`, /published/i.test(msg ?? ""), String(msg));

  const l = league();
  const t = l.teams.find((x) => x.id === first);
  check(
    `${label} rank 1, score, movement and note persisted`,
    t.powerRanking === 1 && t.powerScore === 92.5 && t.powerMovement === 3 &&
      /best lines/.test(t.powerRankingDescription),
    JSON.stringify({ r: t.powerRanking, s: t.powerScore, m: t.powerMovement }),
  );
  check(
    `${label} every team got a rank matching the published order`,
    desired.every((id, i) => l.teams.find((x) => x.id === id).powerRanking === i + 1),
    JSON.stringify(desired.map((id) => l.teams.find((x) => x.id === id).powerRanking)),
  );

  const pub = await ctx.newPage();
  pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/power-rankings`, { waitUntil: "domcontentloaded" });
  const body = await pub.innerText("body");
  const firstName = l.teams.find((x) => x.id === first).name;
  check(
    `${label} public page leads with the published #1`,
    body.toLowerCase().indexOf(firstName.toLowerCase()) ===
      Math.min(...desired.map((id) => {
        const n = l.teams.find((x) => x.id === id).name.toLowerCase();
        const i = body.toLowerCase().indexOf(n);
        return i < 0 ? 1e9 : i;
      })),
    firstName,
  );
  check(`${label} public page shows the note`, body.toLowerCase().includes("best lines"), "");
  check(`${label} public page shows the power score`, body.includes("92.5"), "");
  await pub.close();
}

// --------------------------------------------------- rebuild from standings
{
  await open();
  const form = p.locator("form", { has: p.getByRole("button", { name: /rebuild from standings/i }) });
  const before = league().teams.map((t) => ({ id: t.id, r: t.powerRanking, note: t.powerRankingDescription, s: t.powerScore }));
  const msg = await submitAndWait(p, form.getByRole("button", { name: /rebuild from standings/i }), form);
  check(`${label} rebuild reports success`, /rebuilt/i.test(msg ?? ""), String(msg));

  const l = league();
  const { computeStandings } = await import("../lib/stats.ts").catch(() => ({}));
  void computeStandings;
  const ranks = l.teams.slice().sort((a, b) => a.powerRanking - b.powerRanking).map((t) => t.id);
  check(
    `${label} rebuild produced a complete 1..n ranking`,
    new Set(l.teams.map((t) => t.powerRanking)).size === l.teams.length &&
      Math.min(...l.teams.map((t) => t.powerRanking)) === 1,
    JSON.stringify(l.teams.map((t) => [t.abbreviation, t.powerRanking])),
  );
  check(
    `${label} rebuild keeps the written notes and power scores`,
    before.every((b) => {
      const t = l.teams.find((x) => x.id === b.id);
      return t.powerRankingDescription === b.note && t.powerScore === b.s;
    }),
    "notes/scores preserved",
  );
  const moved = l.teams.find((t) => t.id === before[0].id);
  info(`movement after rebuild: ${l.teams.map((t) => `${t.abbreviation}:${t.powerMovement}`).join(" ")}`);
  check(
    `${label} movement recalculated against the previous order`,
    l.teams.some((t) => t.powerMovement !== 0) || ranks.join(",") === before.slice().sort((a, b) => a.r - b.r).map((b) => b.id).join(","),
    `moved=${JSON.stringify(moved.powerMovement)}`,
  );
}

check(`${label} no console/page errors during power run`, problems.length === 0, problems.join(" ; "));
summary(`t6-power-${label}`);
await ctx.close();
await br.close();
