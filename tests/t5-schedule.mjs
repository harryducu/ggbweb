// Area 5: /commissioner/schedule
import {
  BASE, browser, page, restore, league, check, info, summary, submitAndWait, hydratedForm,
} from "./tlib.mjs";

const br = await browser();
const width = Number(process.env.W ?? 1280);
const label = width < 500 ? "phone" : "desktop";
restore();

const { ctx, page: p, problems } = await page(br, width);
const open = async () => {
  await p.goto(`${BASE}/commissioner/schedule`, { waitUntil: "domcontentloaded" });
  if (!(await hydratedForm(p))) throw new Error("schedule page never hydrated");
};
const weekPanel = (n) =>
  p.locator("details", { has: p.getByText(new RegExp(`^Week ${n}\\b`)) }).first();

const L0 = league();
const teams = L0.teams;
const lastWeekNo = Math.max(...L0.weeks.map((w) => w.weekNumber));

// ----------------------------------------------------------------- add a week
await open();
{
  const form = p.locator("form", { has: p.getByRole("button", { name: /add week/i }) });
  await form.locator("input[name=date]").fill("2026-11-30");
  await form.locator("select[name=byeTeamId]").selectOption(teams[2].id);
  const msg = await submitAndWait(p, form.getByRole("button", { name: /add week/i }), form);
  const w = league().weeks.find((x) => x.weekNumber === lastWeekNo + 1);
  check(`${label} add week reports success`, /added/i.test(msg ?? ""), String(msg));
  check(
    `${label} week added with date + bye`,
    !!w && w.date === "2026-11-30" && w.byeTeamId === teams[2].id && w.matchups.length === 0,
    JSON.stringify(w && { n: w.weekNumber, d: w.date, bye: w.byeTeamId }),
  );
}
const NEW = lastWeekNo + 1;
const newWeekId = league().weeks.find((x) => x.weekNumber === NEW).id;

// ------------------------------------------------------- edit number/date/bye
await open();
{
  const d = weekPanel(NEW);
  await d.locator("summary").click();
  const form = d.locator("form", { has: p.locator("input[name=weekNumber]") });
  await form.locator("input[name=weekNumber]").fill(String(NEW + 5));
  await form.locator("input[name=date]").fill("2026-12-07");
  await form.locator("select[name=byeTeamId]").selectOption("");
  await form.locator("textarea[name=notes]").fill("Snow night — lanes 3 and 4 closed.");
  await form.locator("input[name=completed]").check();
  await submitAndWait(p, form.getByRole("button", { name: /save week/i }), form);
  const w = league().weeks.find((x) => x.id === newWeekId);
  check(
    `${label} week number/date/bye/notes/completed persisted`,
    w.weekNumber === NEW + 5 && w.date === "2026-12-07" && w.byeTeamId === null &&
      /Snow night/.test(w.notes) && w.completed === true,
    JSON.stringify({ n: w.weekNumber, d: w.date, bye: w.byeTeamId, c: w.completed }),
  );
  check(
    `${label} weeks stay sorted by number after a renumber`,
    league().weeks.every((x, i, a) => i === 0 || a[i - 1].weekNumber <= x.weekNumber),
    JSON.stringify(league().weeks.map((x) => x.weekNumber)),
  );
  const pub = await ctx.newPage();
  pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/schedule`, { waitUntil: "domcontentloaded" });
  check(
    `${label} public schedule shows the recap note`,
    (await pub.innerText("body")).toLowerCase().includes("snow night"),
    "",
  );
  await pub.close();
}
const EDITED = NEW + 5;

// ------------------------------------------------------------- add a matchup
await open();
{
  const d = weekPanel(EDITED);
  await d.locator("summary").click();
  // The "Game 1" add row is the form whose first select has an "Add team…" option.
  const addForm = d.locator("form", { has: p.locator('select[aria-label="Add matchup, first team"]') }).first();
  await addForm.locator('select[name=team1Id]').selectOption(teams[0].id);
  await addForm.locator('select[name=team2Id]').selectOption(teams[1].id);
  const msg = await submitAndWait(p, addForm.getByRole("button", { name: /\+ add/i }), addForm);
  const w = league().weeks.find((x) => x.id === newWeekId);
  check(`${label} add matchup reports success`, /added/i.test(msg ?? ""), String(msg));
  check(
    `${label} matchup persisted into game 1`,
    w.matchups.length === 1 && w.matchups[0].game === 1 &&
      w.matchups[0].team1Id === teams[0].id && w.matchups[0].team2Id === teams[1].id,
    JSON.stringify(w.matchups),
  );
}

// --------------------------------------------------- same-team matchup rejected
await open();
{
  const d = weekPanel(EDITED);
  await d.locator("summary").click();
  const addForm = d.locator("form", { has: p.locator('select[aria-label="Add matchup, first team"]') }).first();
  await addForm.locator('select[name=team1Id]').selectOption(teams[3].id);
  await addForm.locator('select[name=team2Id]').selectOption(teams[3].id);
  const msg = await submitAndWait(p, addForm.getByRole("button", { name: /\+ add/i }), addForm);
  const w = league().weeks.find((x) => x.id === newWeekId);
  check(
    `${label} a team cannot bowl itself`,
    /can't bowl against itself/i.test(msg ?? "") && w.matchups.length === 1,
    `${String(msg).replace(/\n/g, " ")} matchups=${w.matchups.length}`,
  );

  // and with a team left unpicked
  const addForm2 = d.locator("form", { has: p.locator('select[aria-label="Add matchup, first team"]') }).first();
  await addForm2.locator('select[name=team1Id]').selectOption(teams[4].id);
  await addForm2.locator('select[name=team2Id]').selectOption("");
  const msg2 = await submitAndWait(p, addForm2.getByRole("button", { name: /\+ add/i }), addForm2);
  check(
    `${label} a matchup with one team missing is rejected`,
    /pick both teams/i.test(msg2 ?? "") && league().weeks.find((x) => x.id === newWeekId).matchups.length === 1,
    String(msg2).replace(/\n/g, " "),
  );
}

// ------------------------------------------------------------- edit a matchup
await open();
{
  const d = weekPanel(EDITED);
  await d.locator("summary").click();
  const editForm = d.locator("form", { has: p.locator('select[aria-label="Home team"]') }).first();
  await editForm.locator('select[name=team2Id]').selectOption(teams[5].id);
  const msg = await submitAndWait(p, editForm.getByRole("button", { name: /^save$/i }), editForm);
  const w = league().weeks.find((x) => x.id === newWeekId);
  check(
    `${label} matchup edit persisted`,
    /updated/i.test(msg ?? "") && w.matchups[0].team2Id === teams[5].id,
    `${String(msg).replace(/\n/g, " ")} ${JSON.stringify(w.matchups[0])}`,
  );

  // editing into a self-matchup must also be rejected
  const editForm2 = d.locator("form", { has: p.locator('select[aria-label="Home team"]') }).first();
  await editForm2.locator('select[name=team2Id]').selectOption(teams[0].id);
  const msg2 = await submitAndWait(p, editForm2.getByRole("button", { name: /^save$/i }), editForm2);
  check(
    `${label} editing a matchup into a self-matchup is rejected`,
    /itself/i.test(msg2 ?? "") && league().weeks.find((x) => x.id === newWeekId).matchups[0].team2Id === teams[5].id,
    String(msg2).replace(/\n/g, " "),
  );
}

// ----------------------------------------------------------- delete a matchup
await open();
{
  const d = weekPanel(EDITED);
  await d.locator("summary").click();
  const forms = await d.locator("form").all();
  const delForm = forms.find(async () => true) && d.locator("form", { has: p.getByRole("button", { name: /^remove$/i }) }).first();
  const resolved = (await delForm.count()) ? delForm : null;
  if (!resolved) {
    check(`${label} matchup delete form present`, false, "no Remove form found");
  } else {
    const fh = await resolved.elementHandle();
    await resolved.getByRole("button", { name: /^remove$/i }).click();
    const btn = p.locator("button", { hasText: /remove matchup/i }).first();
    await btn.click();
    await p.waitForTimeout(2500);
    check(
      `${label} matchup deleted`,
      league().weeks.find((x) => x.id === newWeekId).matchups.length === 0,
      JSON.stringify(league().weeks.find((x) => x.id === newWeekId).matchups),
    );
    void fh;
  }
}

// -------------------------------------------------------------- delete a week
await open();
{
  const d = weekPanel(EDITED);
  await d.locator("summary").click();
  const forms = await d.locator("form").all();
  const delForm = forms[forms.length - 1];
  await delForm.getByRole("button", { name: /delete week/i }).click();
  await delForm.getByRole("button", { name: new RegExp(`delete week ${EDITED}`, "i") }).click();
  await p.waitForTimeout(3000);
  check(
    `${label} week deleted`,
    !league().weeks.find((x) => x.id === newWeekId),
    JSON.stringify(league().weeks.map((x) => x.weekNumber)),
  );
  check(
    `${label} the other weeks are untouched`,
    league().weeks.length === L0.weeks.length,
    `${league().weeks.length} vs ${L0.weeks.length}`,
  );
}

check(`${label} no console/page errors during schedule run`, problems.length === 0, problems.join(" ; "));
summary(`t5-schedule-${label}`);
await ctx.close();
await br.close();
