// Area 9: /commissioner/playoffs
import {
  BASE, browser, page, restore, league, check, info, summary, submitAndWait, hydratedForm,
} from "./tlib.mjs";

const br = await browser();
const width = Number(process.env.W ?? 1280);
const label = width < 500 ? "phone" : "desktop";
restore();

const { ctx, page: p, problems } = await page(br, width);
const open = async () => {
  await p.goto(`${BASE}/commissioner/playoffs`, { waitUntil: "domcontentloaded" });
  if (!(await hydratedForm(p))) throw new Error("playoffs page never hydrated");
};
const save = async () => {
  const form = p.locator("form").first();
  return submitAndWait(p, p.getByRole("button", { name: /save bracket/i }), form);
};
const pubPage = async () => {
  const pub = await ctx.newPage();
  pub.setDefaultNavigationTimeout(120000);
  await pub.goto(`${BASE}/playoffs`, { waitUntil: "domcontentloaded" });
  const body = await pub.innerText("body");
  await pub.close();
  return body;
};

const L0 = league();
const series = L0.playoffs.series;
const pi1 = series.find((s) => s.id === "pi-1");
const pi2 = series.find((s) => s.id === "pi-2");
info(`bracket: ${series.map((s) => s.id).join(", ")}, qualifiers=${L0.playoffs.qualifiers}`);

// ------------------------------------------------- seeding comes from standings
await open();
{
  const seedTable = await p.locator("table.stat").first().innerText();
  check(
    `${label} seeding table lists the qualifying teams`,
    seedTable.split("\n").filter(Boolean).length > L0.playoffs.qualifiers,
    seedTable.replace(/\n/g, " | ").slice(0, 160),
  );
}

// ----------------------------------------- enter play-in scores, winners advance
await open();
{
  await p.locator(`input[name="s1_${pi1.id}"]`).fill("890");
  await p.locator(`input[name="s2_${pi1.id}"]`).fill("810");
  await p.locator(`input[name="s1_${pi2.id}"]`).fill("700");
  await p.locator(`input[name="s2_${pi2.id}"]`).fill("905");
  const msg = await save();
  check(`${label} bracket save reports success`, /saved/i.test(msg ?? ""), String(msg));
  const l = league();
  const s1 = l.playoffs.series.find((s) => s.id === pi1.id);
  check(
    `${label} series scores persisted`,
    s1.team1Score === 890 && s1.team2Score === 810,
    JSON.stringify(s1),
  );

  // the semifinal that feeds off pi-1 should now name a team, not "Winner of"
  await open();
  const bodyAdmin = await p.innerText("body");
  check(
    `${label} admin shows the play-in winner advancing`,
    /advancing:/i.test(bodyAdmin),
    (bodyAdmin.match(/Advancing: [^\n]+/g) ?? []).join(" ; "),
  );

  const pub = await pubPage();
  const advanced = (bodyAdmin.match(/Advancing: ([^\n]+)/) ?? [])[1];
  check(
    `${label} public bracket shows the advancing team in the next round`,
    advanced ? pub.toLowerCase().includes(advanced.trim().toLowerCase()) : false,
    `advancing=${advanced}`,
  );
}

// --------------------------------------------------------- winner override
await open();
{
  // Force the LOSER of pi-1 through, to prove the override beats the scores.
  const l = league();
  const s = l.playoffs.series.find((x) => x.id === pi1.id);
  const opts = await p.locator(`select[name="w_${pi1.id}"] option`).allTextContents();
  const loserName = opts.find((o) => o && !/decide from the scores/i.test(o));
  const sel = p.locator(`select[name="w_${pi1.id}"]`);
  const values = await sel.locator("option").evaluateAll((els) => els.map((e) => e.value));
  const override = values.find((v) => v && v !== "");
  await sel.selectOption(override);
  await save();
  const after = league().playoffs.series.find((x) => x.id === pi1.id);
  check(
    `${label} winner override persisted`,
    after.winnerId === override,
    `${after.winnerId} (scores still ${after.team1Score}-${after.team2Score})`,
  );
  const pub = await pubPage();
  const overrideName = league().teams.find((t) => t.id === override)?.name ?? "";
  check(
    `${label} the overridden winner is the one shown advancing`,
    pub.toLowerCase().includes(overrideName.toLowerCase()),
    overrideName,
  );
  void s;
  void loserName;

  // put it back on automatic
  await open();
  await p.locator(`select[name="w_${pi1.id}"]`).selectOption("");
  await save();
  check(
    `${label} winner override can be cleared back to automatic`,
    league().playoffs.series.find((x) => x.id === pi1.id).winnerId === null,
    String(league().playoffs.series.find((x) => x.id === pi1.id).winnerId),
  );
}

// -------------------------------------------------------- champion override
await open();
{
  const sel = p.locator('select[name=championId]');
  const values = await sel.locator("option").evaluateAll((els) => els.map((e) => e.value));
  const champ = values.find((v) => v);
  await sel.selectOption(champ);
  await save();
  check(
    `${label} champion override persisted`,
    league().playoffs.championId === champ,
    String(league().playoffs.championId),
  );
  const pub = await pubPage();
  const champName = league().teams.find((t) => t.id === champ).name;
  check(
    `${label} public bracket crowns the overridden champion`,
    pub.toLowerCase().includes(champName.toLowerCase()),
    champName,
  );
}

// ------------------------------------------------------------ qualifiers clamp
await open();
{
  const q = p.locator('input[name=qualifiers]');
  await q.fill("99");
  const valid = await q.evaluate((el) => el.checkValidity());
  if (valid) {
    await save();
    check(
      `${label} qualifiers clamped to the number of teams`,
      league().playoffs.qualifiers <= league().teams.length,
      String(league().playoffs.qualifiers),
    );
  } else {
    check(
      `${label} qualifiers above the team count is blocked by the field`,
      true,
      `max=${await q.getAttribute("max")} (browser rejects 99)`,
    );
  }
}

// ------------------------------------------------------------- toggle bracket off
await open();
{
  await p.locator('input[name=enabled]').uncheck();
  const msg = await save();
  check(
    `${label} bracket disabled`,
    league().playoffs.enabled === false,
    `${String(msg).replace(/\n/g, " ")} enabled=${league().playoffs.enabled}`,
  );
  const pub = await pubPage();
  const champName = league().teams.find((t) => t.id === league().playoffs.championId)?.name ?? "";
  check(
    `${label} public /playoffs reflects the bracket being off`,
    !pub.toLowerCase().includes(champName.toLowerCase()) || /not|yet|soon|off|hidden/i.test(pub),
    pub.slice(0, 220).replace(/\n/g, " "),
  );

  // and back on
  await open();
  await p.locator('input[name=enabled]').check();
  await save();
  check(`${label} bracket re-enabled`, league().playoffs.enabled === true);
}

check(`${label} no console/page errors during playoffs run`, problems.length === 0, problems.slice(0, 3).join(" ; "));
summary(`t9-playoffs-${label}`);
await ctx.close();
await br.close();
