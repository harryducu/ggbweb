// Area 3: /commissioner/players
import {
  BASE, browser, page, restore, league, writeLeague, check, info, summary, submitAndWait,
  hydratedForm,
} from "./tlib.mjs";
import { existsSync } from "node:fs";

const FIX = "/private/tmp/claude-501/-Users-harry/2fbc1d08-8165-4f92-8855-2571f27f5437/scratchpad/fix";
const br = await browser();
const width = Number(process.env.W ?? 1280);
const label = width < 500 ? "phone" : "desktop";
restore();

const { ctx, page: p, problems } = await page(br, width);
const open = async () => {
  await p.goto(`${BASE}/commissioner/players`, { waitUntil: "domcontentloaded" });
  if (!(await hydratedForm(p))) throw new Error("players page never hydrated");
};

const L0 = league();
const teamA = L0.teams[0];
const teamB = L0.teams[1];
const NAME = `Testy McTest ${label}`;

// ------------------------------------------------------------------ add bowler
await open();
{
  const form = p.locator("form", { has: p.getByRole("button", { name: /add bowler/i }) });
  await form.locator("input[name=name]").fill(NAME);
  await form.locator("select[name=teamId]").selectOption(teamA.id);
  const msg = await submitAndWait(p, form.getByRole("button", { name: /add bowler/i }), form);
  check(`${label} add bowler reports success`, /added/i.test(msg ?? ""), String(msg));
  const pl = league().players.find((x) => x.name === NAME);
  check(`${label} bowler persisted with team + defaults`, !!pl && pl.teamId === teamA.id && pl.active === true, JSON.stringify(pl));
  check(
    `${label} new bowler gets a slot in every stat category`,
    pl && Object.keys(pl.additionalStats).length === league().settings.playerStatFields.length,
    JSON.stringify(pl?.additionalStats),
  );
}
const NEWID = league().players.find((x) => x.name === NAME).id;
info("new player id:", NEWID);

// -------------------------------------------- edit name / nickname / move team
await open();
{
  const row = p.locator("details", { has: p.getByText(NAME, { exact: true }) }).first();
  await row.locator("summary").click();
  const form = row.locator("form", { has: p.locator('input[name=nickname]') });
  await form.locator("input[name=name]").fill(NAME + " Jr");
  await form.locator("input[name=nickname]").fill("The Arm");
  await form.locator("select[name=teamId]").selectOption(teamB.id);
  const msg = await submitAndWait(p, form.getByRole("button", { name: /save bowler/i }), form);
  check(`${label} edit bowler reports success`, /saved/i.test(msg ?? ""), String(msg));
  const pl = league().players.find((x) => x.id === NEWID);
  check(
    `${label} name, nickname and team move persisted`,
    pl.name === NAME + " Jr" && pl.nickname === "The Arm" && pl.teamId === teamB.id,
    JSON.stringify(pl),
  );
  check(`${label} bowler id is stable across a rename`, pl.id === NEWID, pl.id);

  const pub = await ctx.newPage();
  pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/players/${NEWID}`, { waitUntil: "domcontentloaded" });
  const body = await pub.innerText("body");
  check(
    `${label} public profile shows new name + nickname + team`,
    body.includes(NAME + " Jr") && body.includes("The Arm") && body.toUpperCase().includes(teamB.name.toUpperCase()),
    body.slice(0, 200).replace(/\n/g, " "),
  );
  await pub.close();
}

// ------------------------------------------------------------------- photo up
await open();
{
  const row = p.locator("details", { has: p.getByText(NAME + " Jr", { exact: true }) }).first();
  await row.locator("summary").click();
  const form = row.locator("form", { has: p.locator('input[name=nickname]') });
  await form.locator('input[type=file][name=photo]').setInputFiles(`${FIX}/tiny.png`);
  const msg = await submitAndWait(p, form.getByRole("button", { name: /save bowler/i }), form);
  const pl = league().players.find((x) => x.id === NEWID);
  check(`${label} photo upload accepted`, /saved/i.test(msg ?? "") && !!pl.photo, `${msg} ${pl.photo}`);
  check(
    `${label} uploaded file exists on disk under public/uploads/players`,
    !!pl.photo && existsSync("/Users/harry/goodguys-bowling/public" + pl.photo),
    String(pl.photo),
  );
  const res = await p.request.get(BASE + pl.photo);
  check(`${label} uploaded photo is served`, res.status() === 200, String(res.status()));
}

// --------------------------------------------------------------- remove photo
await open();
{
  const old = league().players.find((x) => x.id === NEWID).photo;
  const row = p.locator("details", { has: p.getByText(NAME + " Jr", { exact: true }) }).first();
  await row.locator("summary").click();
  const form = row.locator("form", { has: p.locator('input[name=nickname]') });
  await form.locator('input[name=removePhoto]').check();
  await submitAndWait(p, form.getByRole("button", { name: /save bowler/i }), form);
  const pl = league().players.find((x) => x.id === NEWID);
  check(`${label} remove photo clears the field`, pl.photo === null, String(pl.photo));
  check(
    `${label} remove photo deletes the file from disk`,
    !existsSync("/Users/harry/goodguys-bowling/public" + old),
    String(old),
  );
}

// ---------------------------------------------------------------- deactivate
await open();
{
  const row = p.locator("details", { has: p.getByText(NAME + " Jr", { exact: true }) }).first();
  await row.locator("summary").click();
  const form = row.locator("form", { has: p.locator('input[name=nickname]') });
  await form.locator('input[name=active]').uncheck();
  await submitAndWait(p, form.getByRole("button", { name: /save bowler/i }), form);
  const pl = league().players.find((x) => x.id === NEWID);
  check(`${label} deactivate persisted`, pl.active === false, JSON.stringify(pl.active));
  await open();
  const listed = await p.locator("details", { has: p.getByText(NAME + " Jr", { exact: true }) }).first().innerText();
  check(`${label} admin list flags the bowler inactive`, /inactive/i.test(listed), listed.replace(/\n/g, " ").slice(0, 120));
  const pub = await ctx.newPage();
  pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/players`, { waitUntil: "domcontentloaded" });
  const shown = (await pub.innerText("body")).includes(NAME + " Jr");
  info(`${label} inactive bowler on public /players roster: ${shown}`);
  await pub.close();
}

// -------------------------------- delete a bowler who has scores on file
{
  // give the bowler scores in week 1 and week 2
  const l = league();
  for (const wn of [1, 2]) {
    const w = l.weeks.find((x) => x.weekNumber === wn);
    w.playerScores.push({ playerId: NEWID, game: 1, score: 140, strikes: 3 });
  }
  writeLeague(l);
  const before = league().weeks.flatMap((w) => w.playerScores).filter((s) => s.playerId === NEWID).length;
  check(`${label} fixture: bowler has ${before} scores before delete`, before === 2, String(before));

  await open();
  const row = p.locator("details", { has: p.getByText(NAME + " Jr", { exact: true }) }).first();
  await row.locator("summary").click();
  const form = row.locator("form", { has: p.getByText(/also removes their entered scores/i) });
  await form.getByRole("button", { name: /remove bowler/i }).click(); // arm
  const msg = await submitAndWait(p, form.getByRole("button", { name: new RegExp(`Remove ${NAME} Jr`, "i") }), form);
  const l2 = league();
  const gone = !l2.players.find((x) => x.id === NEWID);
  const scoresGone = l2.weeks.flatMap((w) => w.playerScores).filter((s) => s.playerId === NEWID).length === 0;
  check(`${label} delete bowler reports success`, /removed/i.test(msg ?? ""), String(msg));
  check(`${label} bowler deleted from JSON`, gone);
  check(`${label} deleting a bowler also removes their scores`, scoresGone);
  const pub = await ctx.newPage();
  pub.setDefaultNavigationTimeout(120000);
  const res = await pub.goto(`${BASE}/players/${NEWID}`, { waitUntil: "domcontentloaded" });
  check(`${label} deleted bowler's profile 404s`, res.status() === 404, String(res.status()));
  await pub.close();
}

// -------------------------------------- required-field + duplicate-name handling
await open();
{
  const form = p.locator("form", { has: p.getByRole("button", { name: /add bowler/i }) });
  await form.locator("input[name=name]").fill("   ");
  const msg = await submitAndWait(p, form.getByRole("button", { name: /add bowler/i }), form, { timeout: 6000 });
  const added = league().players.filter((x) => x.name.trim() === "").length;
  check(
    `${label} whitespace-only name rejected`,
    (msg === null || /needs a name/i.test(msg)) && added === 0,
    `msg=${msg} blanks=${added}`,
  );

  // duplicate name -> distinct slug id
  await form.locator("input[name=name]").fill("Drew Taylor");
  await submitAndWait(p, form.getByRole("button", { name: /add bowler/i }), form);
  const dupes = league().players.filter((x) => x.name === "Drew Taylor");
  check(
    `${label} duplicate bowler name gets a unique id`,
    dupes.length === 2 && new Set(dupes.map((d) => d.id)).size === 2,
    JSON.stringify(dupes.map((d) => d.id)),
  );
}

check(`${label} no console/page errors during players run`, problems.length === 0, problems.join(" ; "));
summary(`t3-players-${label}`);
await ctx.close();
await br.close();
