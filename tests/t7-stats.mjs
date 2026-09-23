// Area 7: /commissioner/stats
import {
  BASE, browser, page, restore, league, check, info, summary, submitAndWait, hydratedForm,
} from "./tlib.mjs";

const br = await browser();
const width = Number(process.env.W ?? 1280);
const label = width < 500 ? "phone" : "desktop";
restore();

const { ctx, page: p, problems } = await page(br, width);
const open = async () => {
  await p.goto(`${BASE}/commissioner/stats`, { waitUntil: "domcontentloaded" });
  if (!(await hydratedForm(p))) throw new Error("stats page never hydrated");
};
const L0 = league();
const target = L0.players[0];

// ------------------------------------------------- manual overrides set/clear
await open();
{
  const before = L0.players.find((x) => x.id === target.id).manualStats;
  await p.locator(`input[name="games_${target.id}"]`).fill("12");
  await p.locator(`input[name="average_${target.id}"]`).fill("176.4");
  await p.locator(`input[name="total_${target.id}"]`).fill("2117");
  await p.locator(`input[name="strikes_${target.id}"]`).fill("33");
  const form = p.locator("form", { has: p.getByRole("button", { name: /save all stats/i }) });
  const msg = await submitAndWait(p, p.getByRole("button", { name: /save all stats/i }), form);
  check(`${label} save stats reports success`, /saved/i.test(msg ?? ""), String(msg));
  const m = league().players.find((x) => x.id === target.id).manualStats;
  check(
    `${label} manual games/average/total/strikes persisted`,
    m.games === 12 && m.average === 176.4 && m.totalScore === 2117 && m.strikes === 33,
    JSON.stringify(m),
  );
  check(
    `${label} throughWeek preserved across a stats save`,
    m.throughWeek === before.throughWeek,
    `${before.throughWeek} -> ${m.throughWeek}`,
  );
  check(
    `${label} a decimal average is accepted (step allows it)`,
    m.average === 176.4,
    String(m.average),
  );

  const pub = await ctx.newPage();
  pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/stats`, { waitUntil: "domcontentloaded" });
  const row = await pub.locator("tr", { has: pub.getByText(target.name, { exact: true }) }).first().innerText();
  check(`${label} public /stats shows the posted total`, row.includes("2,117") || row.includes("2117"), row.replace(/\n/g, " "));
  await pub.close();
}

// clear them again
await open();
{
  for (const n of ["games", "average", "total", "strikes"]) {
    await p.locator(`input[name="${n}_${target.id}"]`).fill("");
  }
  const form = p.locator("form", { has: p.getByRole("button", { name: /save all stats/i }) });
  await submitAndWait(p, p.getByRole("button", { name: /save all stats/i }), form);
  const m = league().players.find((x) => x.id === target.id).manualStats;
  check(
    `${label} clearing the overrides returns to calculated`,
    m.games === null && m.average === null && m.totalScore === null && m.strikes === null,
    JSON.stringify(m),
  );
}

// ------------------------------------------------------------ add a category
await open();
{
  const form = p.locator("form", { has: p.getByRole("button", { name: /add category/i }) });
  await form.locator("input[name=label]").fill("Splits Converted");
  const msg = await submitAndWait(p, form.getByRole("button", { name: /add category/i }), form);
  const f = league().settings.playerStatFields.find((x) => x.label === "Splits Converted");
  check(`${label} add category reports success`, /added/i.test(msg ?? ""), String(msg));
  check(
    `${label} category stored with a key and default flags`,
    !!f && f.showOnStatsPage === true && f.lowerIsBetter === false,
    JSON.stringify(f),
  );
  check(
    `${label} every bowler gets a slot for the new category`,
    league().players.every((pl) => f.key in pl.additionalStats),
    "",
  );

  // set a value for it and check the public column
  await open();
  await p.locator(`input[name="x_${f.key}_${target.id}"]`).fill("9");
  const sform = p.locator("form", { has: p.getByRole("button", { name: /save all stats/i }) });
  await submitAndWait(p, p.getByRole("button", { name: /save all stats/i }), sform);
  check(
    `${label} category value persisted`,
    league().players.find((x) => x.id === target.id).additionalStats[f.key] === 9,
    JSON.stringify(league().players.find((x) => x.id === target.id).additionalStats),
  );

  const pub = await ctx.newPage();
  pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/stats`, { waitUntil: "domcontentloaded" });
  const head = await pub.locator("thead").first().innerText();
  check(
    `${label} new category is a column on public /stats`,
    head.toLowerCase().includes("splits converted"),
    head.replace(/\n/g, " | "),
  );
  const col = pub.locator("thead th", { hasText: /splits converted/i }).first();
  const sortable = (await col.locator("button").count()) > 0 || (await col.evaluate((el) => el.tagName === "TH" && !!el.querySelector("button,[role=button]")));
  check(`${label} that column is sortable`, sortable, `buttons in th: ${await col.locator("button").count()}`);
  if (sortable) {
    await col.locator("button").first().click();
    await pub.waitForTimeout(400);
    const firstRow = await pub.locator("tbody tr").first().innerText();
    check(
      `${label} sorting by the new column puts the 9 on top`,
      firstRow.includes(target.name) || firstRow.includes("9"),
      firstRow.replace(/\n/g, " "),
    );
  }
  await pub.goto(`${BASE}/players/${target.id}`, { waitUntil: "domcontentloaded" });
  check(
    `${label} new category shows on the player profile`,
    (await pub.innerText("body")).toLowerCase().includes("splits converted"),
    "",
  );
  await pub.close();
}

// ---------------------------------- duplicate label -> key collision probe
await open();
{
  const fieldsBefore = league().settings.playerStatFields.map((f) => f.key);
  const form = p.locator("form", { has: p.getByRole("button", { name: /add category/i }) });
  await form.locator("input[name=label]").fill("Splits Converted");
  await submitAndWait(p, form.getByRole("button", { name: /add category/i }), form);
  const fields = league().settings.playerStatFields;
  const keys = fields.map((f) => f.key);
  check(
    `${label} a second category with the same name gets a DISTINCT key`,
    new Set(keys).size === keys.length,
    `before=${JSON.stringify(fieldsBefore)} after=${JSON.stringify(keys)}`,
  );
}

// -------------------------------------------------------- remove a category
await open();
{
  const fields = league().settings.playerStatFields;
  const victim = fields[fields.length - 1];
  const badge = p.locator("form", { has: p.locator(`input[name=key][value="${victim.key}"]`) }).first();
  const bh = await badge.elementHandle();
  await badge.getByRole("button", { name: "✕" }).click();
  await p.locator("button", { hasText: /^remove$/i }).first().click();
  await p.waitForTimeout(3000);
  const after = league().settings.playerStatFields.map((f) => f.key);
  check(
    `${label} category removed from settings`,
    !after.includes(victim.key) || after.filter((k) => k === victim.key).length < fields.filter((f) => f.key === victim.key).length,
    `${JSON.stringify(fields.map((f) => f.key))} -> ${JSON.stringify(after)}`,
  );
  check(
    `${label} removing a category drops it from every bowler`,
    league().players.every((pl) => !(victim.key in pl.additionalStats)) ||
      after.includes(victim.key),
    "",
  );
  void bh;
}

// ------------------------------------------------ clear-all-scores gate
await open();
{
  // wrong confirmation text
  const form = p.locator("form", { has: p.locator("input[name=confirm]") });
  await form.locator("input[name=confirm]").fill("clear");
  await form.getByRole("button", { name: /clear all scores/i }).click();
  const msg = await submitAndWait(p, form.getByRole("button", { name: /clear every score/i }), form);
  check(
    `${label} lowercase "clear" is rejected by the gate`,
    /type clear/i.test(msg ?? ""),
    String(msg).replace(/\n/g, " "),
  );

  // empty confirmation
  await open();
  const form2 = p.locator("form", { has: p.locator("input[name=confirm]") });
  await form2.getByRole("button", { name: /clear all scores/i }).click();
  const msg2 = await submitAndWait(p, form2.getByRole("button", { name: /clear every score/i }), form2);
  check(`${label} empty confirmation is rejected`, /type clear/i.test(msg2 ?? ""), String(msg2).replace(/\n/g, " "));

  // real thing
  await open();
  const form3 = p.locator("form", { has: p.locator("input[name=confirm]") });
  await form3.locator("input[name=confirm]").fill("CLEAR");
  await form3.getByRole("button", { name: /clear all scores/i }).click();
  const msg3 = await submitAndWait(p, form3.getByRole("button", { name: /clear every score/i }), form3);
  const l = league();
  check(`${label} CLEAR wipes every score`, /cleared/i.test(msg3 ?? ""), String(msg3).replace(/\n/g, " "));
  check(
    `${label} all game scores gone`,
    l.weeks.every((w) => w.playerScores.length === 0 && w.matchups.every((m) => m.team1Score === null)),
    "",
  );
  check(
    `${label} manual overrides + power scores reset`,
    l.players.every((pl) => pl.manualStats.totalScore === null) &&
      l.teams.every((t) => t.manualRecord.wins === null && t.powerScore === null),
    "",
  );
  check(
    `${label} schedule and rosters survive, as the copy promises`,
    l.weeks.length === L0.weeks.length && l.players.length === L0.players.length &&
      l.teams.length === L0.teams.length && l.weeks.every((w) => w.matchups.length > 0),
    `${l.weeks.length}w ${l.players.length}p ${l.teams.length}t`,
  );
  const notesKept = l.weeks.some((w) => w.notes && w.notes.length > 0);
  const hadNotes = L0.weeks.some((w) => w.notes && w.notes.length > 0);
  info(`week recaps before=${hadNotes} after=${notesKept} (copy does not mention clearing recaps)`);
}

check(`${label} no console/page errors during stats run`, problems.length === 0, problems.join(" ; "));
summary(`t7-stats-${label}`);
await ctx.close();
await br.close();
