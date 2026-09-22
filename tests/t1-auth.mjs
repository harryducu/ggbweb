// Area 1 (login/logout/gate) + Area 10 (server-action auth).
import { BASE, browser, page, restore, league, check, info, summary, submitAndWait } from "./tlib.mjs";

const PW = "strike300";
restore();
const br = await browser();

for (const [label, width] of [
  ["desktop", 1280],
  ["phone", 390],
]) {
  // ---------- no cookie: login screen, no data leak
  {
    const { ctx, page: p } = await page(br, width, { admin: false });
    for (const route of ["/commissioner", "/commissioner/scores", "/commissioner/settings"]) {
      await p.goto(BASE + route, { waitUntil: "domcontentloaded" });
      const html = await p.content();
      const gated =
        (await p.locator('input[name=password]').count()) === 1 &&
        html.includes("Commissioner");
      const leaked = [
        "Drew Taylor",
        "Two Fingers One Thumb",
        "Enter Scores",
        "Manage Teams",
        "Sign out",
      ].filter((s) => html.includes(s));
      check(`${label} ${route} gated behind login`, gated);
      check(`${label} ${route} leaks no league data`, leaked.length === 0, leaked.join(","));
    }
    await ctx.close();
  }

  // ---------- wrong password
  {
    const { ctx, page: p } = await page(br, width, { admin: false });
    await p.goto(BASE + "/commissioner", { waitUntil: "domcontentloaded" });
    await p.fill('input[name=password]', "nope-wrong");
    const msg = await submitAndWait(p, p.getByRole("button", { name: /sign in/i }), p.locator("form"));
    check(`${label} wrong password rejected with message`, /not right/i.test(msg ?? ""), String(msg));
    const cls = await p.locator("[role=status]").first().getAttribute("class");
    check(`${label} wrong-password message styled as error`, /text-loss/.test(cls ?? ""), cls ?? "");
    check(
      `${label} wrong password grants no access`,
      (await p.locator('input[name=password]').count()) === 1,
    );

    // ---------- empty password
    await p.fill('input[name=password]', "");
    await p.getByRole("button", { name: /sign in/i }).click();
    await p.waitForTimeout(700);
    const stillLogin = (await p.locator('input[name=password]').count()) === 1;
    check(`${label} empty password does not sign in`, stillLogin);

    // ---------- correct password
    await p.fill('input[name=password]', PW);
    await p.getByRole("button", { name: /sign in/i }).click();
    await p.waitForURL(/\/commissioner$/, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(600);
    const inHtml = await p.content();
    check(
      `${label} correct password grants access`,
      inHtml.includes("Sign out") && (await p.locator('input[name=password]').count()) === 0,
    );
    const ck = (await ctx.cookies()).find((c) => c.name === "gg_commish");
    check(`${label} session cookie set httpOnly`, !!ck && ck.httpOnly === true, JSON.stringify(ck));

    // ---------- sign out
    await p.getByRole("button", { name: /^sign out$/i }).click();
    await p.waitForTimeout(1200);
    const afterOut = await ctx.cookies();
    await p.goto(BASE + "/commissioner", { waitUntil: "domcontentloaded" });
    check(
      `${label} sign out returns to login`,
      (await p.locator('input[name=password]').count()) === 1,
      (await p.title()) ?? "",
    );
    check(
      `${label} sign out clears cookie`,
      !afterOut.find((c) => c.name === "gg_commish" && c.value),
      JSON.stringify(afterOut.map((c) => c.name)),
    );
    await ctx.close();
  }
}

// ---------- Area 10: tampered cookie
{
  const good = (await import("./tlib.mjs")).cookie().value;
  const flipped = good.slice(0, -1) + (good.at(-1) === "a" ? "b" : "a");
  const { ctx, page: p } = await page(br, 1280, { cookieValue: flipped });
  await p.goto(BASE + "/commissioner/teams", { waitUntil: "domcontentloaded" });
  check(
    "tampered cookie signature: page gated",
    (await p.locator('input[name=password]').count()) === 1,
  );
  await ctx.close();
}
{
  const good = (await import("./tlib.mjs")).cookie();
  // Expiry in the past, signature valid for that expiry.
  const { createHmac } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const secret = /SESSION_SECRET=(.*)/
    .exec(readFileSync("/Users/harry/goodguys-bowling/.env.local", "utf8"))[1]
    .trim();
  const past = Date.now() - 1000;
  const expired = `${past}.${createHmac("sha256", secret).update(String(past)).digest("hex")}`;
  const { ctx, page: p } = await page(br, 1280, { cookieValue: expired });
  await p.goto(BASE + "/commissioner", { waitUntil: "domcontentloaded" });
  check(
    "expired-but-signed cookie: page gated",
    (await p.locator('input[name=password]').count()) === 1,
  );
  await ctx.close();
  void good;
}

// ---------- Area 10: server action refuses to write with cookie removed / tampered
for (const mode of ["removed", "tampered"]) {
  const { ctx, page: p } = await page(br, 1280);
  await p.goto(BASE + "/commissioner/teams", { waitUntil: "domcontentloaded" });
  await p.locator("details").first().click();
  const nameBox = p.locator('form:has(input[name=manualWins]) input[name=name]').first();
  await nameBox.waitFor();
  const before = league().teams.find((t) => t.sortOrder === 0).name;
  await nameBox.fill("HACKED-" + mode);

  const cookies = await ctx.cookies();
  await ctx.clearCookies();
  if (mode === "tampered") {
    const c = cookies.find((x) => x.name === "gg_commish");
    await ctx.addCookies([{ ...c, value: c.value.slice(0, -2) + "ff" }]);
  }

  const form = p.locator('form:has(input[name=manualWins])').first();
  const msg = await submitAndWait(p, form.getByRole("button", { name: /save team/i }), form);
  const after = league().teams.find((t) => t.sortOrder === 0).name;
  check(
    `action with ${mode} cookie: refused with message`,
    /not authorized/i.test(msg ?? ""),
    String(msg),
  );
  check(`action with ${mode} cookie: no write happened`, after === before, `${before} -> ${after}`);
  await ctx.close();
}

// ---------- unauthenticated POST straight at a server action
{
  const { ctx, page: p } = await page(br, 1280);
  await p.goto(BASE + "/commissioner/teams", { waitUntil: "domcontentloaded" });
  const actionId = await p.evaluate(() => {
    const el = document.querySelector("form input[name^='$ACTION_ID_']");
    return el ? el.name.replace("$ACTION_ID_", "") : null;
  });
  info("harvested action id:", actionId);
  await ctx.close();
}

summary("t1-auth");
await br.close();
