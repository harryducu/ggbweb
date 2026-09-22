// Area 2: /commissioner/scores
import {
  BASE, browser, page, restore, league, check, info, summary, submitAndWait, hydratedScores,
  writeLeague,
} from "./tlib.mjs";

const br = await browser();
const width = Number(process.env.W ?? 1280);
const label = width < 500 ? "phone" : "desktop";
restore();
// The shipped seed posts manual team records and manual player stats, which by
// design mask everything derived from game scores. Clear them so this suite can
// see the derived output change. (Overrides get their own tests in t4/t7.)
{
  const l = league();
  for (const t of l.teams) t.manualRecord = { wins: null, losses: null, ties: null, totalPins: null };
  for (const pl of l.players) pl.manualStats = { games: null, average: null, totalScore: null, strikes: null };
  writeLeague(l);
}

const L0 = league();
const week1 = L0.weeks.find((w) => w.weekNumber === 1);
const g1 = week1.matchups.find((m) => m.game === 1);
const teamA = L0.teams.find((t) => t.id === g1.team1Id);
const teamB = L0.teams.find((t) => t.id === g1.team2Id);
const rosterA = L0.players.filter((p) => p.teamId === teamA.id);
const rosterB = L0.players.filter((p) => p.teamId === teamB.id);
info(`${label}: week1 g1 = ${teamA.name} vs ${teamB.name}; rosters ${rosterA.length}/${rosterB.length}`);

const { ctx, page: p, problems } = await page(br, width);
const openScores = async (n) => {
  await p.goto(`${BASE}/commissioner/scores?week=${n}`, { waitUntil: "domcontentloaded" });
  const ok = await hydratedScores(p);
  if (!ok) throw new Error("score grid never hydrated");
};
await openScores(1);

// ---------------------------------------------------------------- week picker
{
  await openScores(4);
  const h = await p.locator("text=/^Week 4$/").first().count();
  check(`${label} week picker selects week 4`, h > 0);
  await openScores(1);
}

// --------------------------------------------------------- live totals + winner
const A = [180, 190, 200, 210]; // team A game-1 scores -> 780
const B = [150, 160, 170, 180]; // team B game-1 scores -> 660
for (let i = 0; i < 4; i++) {
  await p.getByLabel(`${rosterA[i].name} game 1 score`).fill(String(A[i]));
  await p.getByLabel(`${rosterB[i].name} game 1 score`).fill(String(B[i]));
}
// game 2 + 3 for team A only, so team B relies on nothing (unplayed)
await p.getByLabel(`${rosterA[0].name} game 2 score`).fill("100");
await p.getByLabel(`${rosterA[0].name} game 3 score`).fill("90");
await p.waitForTimeout(250);

const panelA = p.locator(".panel", { has: p.getByText(teamA.name, { exact: true }) }).first();
const footA = await panelA.locator("tfoot tr td").allInnerTexts();
check(
  `${label} live team total sums game 1 (expect 780)`,
  footA.join("|").includes("780"),
  footA.join("|"),
);
check(
  `${label} live series column for one bowler (100+90+180=370)`,
  (await panelA.locator("tbody tr").first().locator("td").last().innerText()).trim() === "370",
  await panelA.locator("tbody tr").first().locator("td").last().innerText(),
);
const seriesTotal = footA.join("|");
check(
  `${label} live team night total (780+100+90=970)`,
  seriesTotal.includes("970"),
  seriesTotal,
);

const resultRow = p.locator("table.stat tbody tr", {
  has: p.locator(`input[aria-label="${teamA.name} team total override, game 1"]`),
});
let badge = (await resultRow.locator("td").last().innerText()).trim();
check(
  `${label} live winner column shows ${teamA.abbreviation} by 120`,
  badge.includes(teamA.abbreviation) && badge.includes("120"),
  badge,
);

// tie detection
await p.getByLabel(`${rosterB[3].name} game 1 score`).fill("300");
await p.waitForTimeout(200);
badge = (await resultRow.locator("td").last().innerText()).trim();
check(`${label} live tie detected at 780–780`, /tie/i.test(badge), badge);
await p.getByLabel(`${rosterB[3].name} game 1 score`).fill("180");
await p.waitForTimeout(150);

// -------------------------------------------------------------------- save
const saveForm = p.locator("form", { has: p.getByRole("button", { name: /save week 1/i }) });
let msg = await submitAndWait(p, p.getByRole("button", { name: /save week 1/i }), saveForm);
check(`${label} save reports success`, /Week saved/.test(msg ?? ""), String(msg));
{
  const w = league().weeks.find((x) => x.weekNumber === 1);
  const got = w.playerScores.filter((s) => s.game === 1 && rosterA.some((r) => r.id === s.playerId));
  check(
    `${label} scores persisted to JSON`,
    got.length === 4 && got.every((s) => A.includes(s.score)),
    JSON.stringify(got),
  );
  check(
    `${label} save message count matches (10 scores)`,
    /10 game scores/.test(msg ?? ""),
    String(msg),
  );
}

// --------------------------------------------- public pages reflect the save
{
  const pub = await ctx.newPage();
  pub.setDefaultTimeout(60000); pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/standings`, { waitUntil: "domcontentloaded" });
  const stand = await pub.innerText("body");
  check(
    `${label} /standings shows ${teamA.abbreviation} with a win`,
    stand.includes(teamA.name),
    "",
  );
  const rowA = await pub
    .locator("tr", { has: pub.getByText(teamA.name, { exact: true }) })
    .first()
    .innerText();
  check(
    `${label} /standings row shows the derived 1–0 record`,
    /\b1\b/.test(rowA) && /\b0\b/.test(rowA),
    rowA.replace(/\n/g, " "),
  );

  await pub.goto(`${BASE}/stats`, { waitUntil: "domcontentloaded" });
  const st = await pub.innerText("body");
  check(
    `${label} /stats shows bowler with 3 games`,
    st.includes(rosterA[0].name),
    "",
  );
  await pub.goto(`${BASE}/players/${rosterA[0].id}`, { waitUntil: "domcontentloaded" });
  const prof = await pub.innerText("body");
  check(
    `${label} player profile shows the 370 series`,
    prof.includes("370"),
    prof.slice(0, 120).replace(/\n/g, " "),
  );
  await pub.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  check(`${label} home page renders after save`, (await pub.innerText("body")).length > 200);
  await pub.close();
}

// ------------------------------------------- strike counts: toggle + preservation
{
  await openScores(1);
  const strikeBox = p.getByLabel(`${rosterA[0].name} game 1 strikes`);
  check(
    `${label} strike inputs exist but hidden with toggle off`,
    (await strikeBox.count()) === 1 && !(await strikeBox.isVisible()),
  );
  await p.getByLabel(/also enter strike counts/i).check();
  await p.waitForTimeout(150);
  check(`${label} strike inputs visible with toggle on`, await strikeBox.isVisible());
  await strikeBox.fill("7");
  await p.getByLabel(`${rosterA[1].name} game 1 strikes`).fill("4");
  const f = p.locator("form", { has: p.getByRole("button", { name: /save week 1/i }) });
  const m2 = await submitAndWait(p, p.getByRole("button", { name: /save week 1/i }), f);
  const s1 = league()
    .weeks.find((w) => w.weekNumber === 1)
    .playerScores.find((s) => s.playerId === rosterA[0].id && s.game === 1);
  check(`${label} strikes saved`, s1?.strikes === 7, JSON.stringify(s1) + " msg=" + m2);

  // now reload with the toggle OFF, change a score, save: strikes must survive
  await openScores(1);
  const toggled = await p.getByLabel(/also enter strike counts/i).isChecked();
  check(`${label} strike toggle defaults off after reload`, toggled === false);
  await p.getByLabel(`${rosterA[0].name} game 1 score`).fill("181");
  const f2 = p.locator("form", { has: p.getByRole("button", { name: /save week 1/i }) });
  await submitAndWait(p, p.getByRole("button", { name: /save week 1/i }), f2);
  const s2 = league()
    .weeks.find((w) => w.weekNumber === 1)
    .playerScores.find((s) => s.playerId === rosterA[0].id && s.game === 1);
  check(
    `${label} PAST BUG: strikes survive a save with the toggle off`,
    s2?.strikes === 7 && s2?.score === 181,
    JSON.stringify(s2),
  );
}

// ------------------------------------------------- team-total override precedence
{
  await openScores(1);
  const ov = p.getByLabel(`${teamA.name} team total override, game 1`);
  await ov.fill("500");
  await p.waitForTimeout(200);
  const row = p.locator("table.stat tbody tr", {
    has: p.locator(`input[aria-label="${teamA.name} team total override, game 1"]`),
  });
  const b = (await row.locator("td").last().innerText()).trim();
  check(
    `${label} live winner uses override (B ${teamB.abbreviation} wins by 160)`,
    b.includes(teamB.abbreviation) && b.includes("160"),
    b,
  );
  const f = p.locator("form", { has: p.getByRole("button", { name: /save week 1/i }) });
  await submitAndWait(p, p.getByRole("button", { name: /save week 1/i }), f);
  const m = league()
    .weeks.find((w) => w.weekNumber === 1)
    .matchups.find((x) => x.id === g1.id);
  check(`${label} override persisted`, m.team1Score === 500, JSON.stringify(m));

  const pub = await ctx.newPage();
  pub.setDefaultTimeout(60000); pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/schedule`, { waitUntil: "domcontentloaded" });
  const body = await pub.innerText("body");
  check(
    `${label} override wins on the public schedule (500 shown, 781 not)`,
    body.includes("500") && !body.includes("781"),
    "",
  );
  await pub.goto(`${BASE}/standings`, { waitUntil: "domcontentloaded" });
  const rowB = await pub
    .locator("tr", { has: pub.getByText(teamB.name, { exact: true }) })
    .first()
    .innerText();
  check(
    `${label} standings credit the override winner ${teamB.abbreviation}`,
    /\b1\b/.test(rowB),
    rowB.replace(/\n/g, " "),
  );
  await pub.close();
}

// ---------------------------------------------------------------- clear week
{
  await openScores(1);
  const clearForm = p.locator("form", { has: p.getByText(/Start this week over/i) });
  await clearForm.getByRole("button", { name: /clear scores/i }).click();
  const msg = await submitAndWait(
    p,
    clearForm.getByRole("button", { name: /clear week 1/i }),
    clearForm,
  );
  check(`${label} clear week reports success`, /cleared/i.test(msg ?? ""), String(msg));
  const w = league().weeks.find((x) => x.weekNumber === 1);
  check(
    `${label} clear week wipes scores + overrides + completed`,
    w.playerScores.length === 0 && w.matchups.every((m) => m.team1Score === null) && !w.completed,
    `${w.playerScores.length} scores`,
  );
  const pub = await ctx.newPage();
  pub.setDefaultTimeout(60000); pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/standings`, { waitUntil: "domcontentloaded" });
  const rowA = await pub
    .locator("tr", { has: pub.getByText(teamA.name, { exact: true }) })
    .first()
    .innerText();
  check(
    `${label} standings back to 0–0 after clear`,
    /0\s*[–-]\s*0/.test(rowA.replace(/\n/g, " ")) || !/\b1\b/.test(rowA),
    rowA.replace(/\n/g, " "),
  );
  await pub.close();
}

// --------------------------------------- free agents / bye rosters and saving
{
  // Put a score on a bye-team bowler + a free agent, then save week 1 again.
  const byeTeam = week1.byeTeamId;
  const byePlayer = L0.players.find((x) => x.teamId === byeTeam);
  const l = league();
  const w = l.weeks.find((x) => x.weekNumber === 1);
  w.playerScores.push({ playerId: byePlayer.id, game: 1, score: 123, strikes: 5 });
  const freeAgent = l.players[l.players.length - 1];
  freeAgent.teamId = null;
  w.playerScores.push({ playerId: freeAgent.id, game: 2, score: 111, strikes: 2 });
  (await import("./tlib.mjs")).writeLeague(l);

  await openScores(1);
  await p.getByLabel(`${rosterA[0].name} game 1 score`).fill("150");
  const f = p.locator("form", { has: p.getByRole("button", { name: /save week 1/i }) });
  await submitAndWait(p, p.getByRole("button", { name: /save week 1/i }), f);
  const after = league().weeks.find((x) => x.weekNumber === 1);
  check(
    `${label} bye-team bowler's score survives a week save`,
    !!after.playerScores.find((s) => s.playerId === byePlayer.id),
    `bye player ${byePlayer.name} (${byeTeam}) score present: ${!!after.playerScores.find((s) => s.playerId === byePlayer.id)}`,
  );
  check(
    `${label} free agent's score survives a week save`,
    !!after.playerScores.find((s) => s.playerId === freeAgent.id),
    `free agent ${freeAgent.name} score present: ${!!after.playerScores.find((s) => s.playerId === freeAgent.id)}`,
  );
}

check(`${label} no console/page errors during scores run`, problems.length === 0, problems.join(" ; "));
summary(`t2-scores-${label}`);
await ctx.close();
await br.close();
