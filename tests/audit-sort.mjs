// Read-only audit: /stats table sorting for every column, both directions.
import { launch, newPage } from "./helpers.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";

const browser = await launch();
const { ctx, page, problems } = await newPage(browser, "desktop", { admin: false });

await page.goto(`${BASE}/stats`, { waitUntil: "networkidle", timeout: 90000 });

const headers = await page.$$eval("table.stat thead th button.sort-btn", (bs) =>
  bs.map((b) => b.textContent.replace(/[⇅▼▲]/g, "").trim()),
);
console.log("SORTABLE COLUMNS:", headers);

function readTable() {
  return page.$$eval("table.stat tbody tr", (trs) =>
    trs.map((tr) => {
      const tds = [...tr.querySelectorAll("td")].map((td) => td.textContent.trim());
      return { idx: tds[0], name: tds[1], team: tds[2], cells: tds.slice(3) };
    }),
  );
}

async function ariaState() {
  return page.$$eval("table.stat thead th", (ths) =>
    ths.map((th) => ({
      label: th.textContent.replace(/[⇅▼▲]/g, "").trim(),
      ariaSort: th.getAttribute("aria-sort"),
      scope: th.getAttribute("scope"),
    })),
  );
}

const parse = (s) => (s === "—" || s === "" ? null : Number(s.replace(/,/g, "")));

const results = [];
for (let c = 0; c < headers.length; c++) {
  const label = headers[c];
  for (const dir of ["first", "second"]) {
    await page.click(`table.stat thead th:nth-child(${4 + c}) button.sort-btn`);
    await page.waitForTimeout(120);
    const rows = await readTable();
    const aria = await ariaState();
    const activeAria = aria.find((a) => a.label === label)?.ariaSort;
    const vals = rows.map((r) => parse(r.cells[c]));
    const nonNull = vals.filter((v) => v !== null);
    const nullsAtEnd = vals.findIndex((v) => v === null) === -1 || vals.slice(vals.findIndex((v) => v === null)).every((v) => v === null);

    let ordered = true;
    let dirSeen = null;
    if (nonNull.length > 1) {
      const asc = nonNull.every((v, i) => i === 0 || nonNull[i - 1] <= v);
      const desc = nonNull.every((v, i) => i === 0 || nonNull[i - 1] >= v);
      ordered = asc || desc;
      dirSeen = desc && !asc ? "descending" : asc && !desc ? "ascending" : "flat";
    }
    // Tie groups must be internally ordered by name (the component's tiebreak).
    const tieProblems = [];
    for (let i = 1; i < rows.length; i++) {
      if (vals[i] !== null && vals[i] === vals[i - 1]) {
        if (rows[i - 1].name.localeCompare(rows[i].name) > 0) {
          tieProblems.push(`${rows[i - 1].name} before ${rows[i].name}`);
        }
      }
    }
    const seqOk = rows.every((r, i) => Number(r.idx) === i + 1);
    const ariaOk =
      dirSeen === "flat" || dirSeen === null ? true : activeAria === dirSeen;

    results.push({ label, dir, dirSeen, activeAria, ordered, nullsAtEnd, tieProblems, seqOk, ariaOk, n: rows.length });
    console.log(
      `${ordered && nullsAtEnd && tieProblems.length === 0 && seqOk && ariaOk ? "PASS" : "FAIL"}  ${label.padEnd(8)} click#${dir === "first" ? 1 : 2}  order=${dirSeen}  aria-sort=${activeAria}  nullsLast=${nullsAtEnd}  rows=${rows.length}  rank1..n=${seqOk}  ties=${tieProblems.length === 0 ? "ok" : tieProblems.join("; ")}`,
    );
  }
}

// Tie detail: Hulgrave vs Petsche on Avg both directions.
console.log("\n--- Avg tie detail (122.33 pair) ---");
for (const dir of [1, 2]) {
  await page.click(`table.stat thead th:nth-child(5) button.sort-btn`);
  await page.waitForTimeout(120);
  const rows = await readTable();
  const pair = rows.filter((r) => r.name === "Jack Hulgrave" || r.name === "Jack Petsche");
  const aria = (await ariaState()).find((a) => a.label === "Avg")?.ariaSort;
  console.log(`  click ${dir}: aria-sort=${aria}`, pair.map((p) => `#${p.idx} ${p.name} ${p.cells[1]}`));
}

console.log("\n--- th scope / aria-sort on /stats ---");
console.log(JSON.stringify(await ariaState(), null, 1));

console.log("\n--- filter chips (team filter) ---");
await page.click("text=All teams");
const chips = await page.$$eval("button.badge", (bs) =>
  bs.map((b) => ({ text: b.textContent.trim(), pressed: b.getAttribute("aria-pressed") })),
);
console.log(JSON.stringify(chips));
await page.click('button.badge:has-text("SG")');
await page.waitForTimeout(150);
console.log("SG filter rows:", (await readTable()).map((r) => r.name));
await page.fill('input[type="search"]', "jack");
await page.waitForTimeout(200);
console.log('search "jack" rows:', (await readTable()).map((r) => r.name));
await page.click("text=All teams");
await page.fill('input[type="search"]', "zzzz");
await page.waitForTimeout(200);
console.log("empty-state row:", (await readTable()).map((r) => r.name || r.idx));

console.log("\nCONSOLE PROBLEMS:", problems.length ? problems : "none");
const failures = results.filter((r) => !(r.ordered && r.nullsAtEnd && r.tieProblems.length === 0 && r.seqOk && r.ariaOk));
console.log("SORT FAILURES:", failures.length);
for (const f of failures) console.log("  ", JSON.stringify(f));

await ctx.close();
await browser.close();
