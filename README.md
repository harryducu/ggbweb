# Good Guys Bowling League

A league website for Monday night bowling: 7 teams, 4 bowlers each, 3 games a night,
one bye per team across a 7-week regular season, top 6 into a single-elimination bracket.

Everything the site shows comes from one JSON file that the commissioner edits through a
web panel. There is no code to touch to run the season.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

The first run creates `data/league.json` from the seed. Delete that file to reload the
workbook data from scratch at any time.

```bash
npm run build && npm start   # production
npm run typecheck            # tsc, no emit
```

## The commissioner panel

`/commissioner`, password from `COMMISSIONER_PASSWORD`. Sessions last 12 hours and the
cookie is signed with `SESSION_SECRET`.

Both are required — there are no built-in defaults. If either is missing the panel
refuses every sign-in and says which variable is unset, rather than falling back to a
credential that anyone reading this repository would know. Set them in `.env.local`
locally and in the host's environment settings in production.

| Section | What it does |
| --- | --- |
| Dashboard | What still needs doing, week-by-week progress |
| Enter Scores | Each bowler's three game scores for a week, with live team totals |
| Schedule | Weeks, dates, bye teams, matchups |
| Power Rankings | Drag the order, set power scores and movement, write the weekly note |
| Stats | Season totals per bowler, plus adding new stat categories |
| Players | Add/edit/remove bowlers, change teams, upload photos |
| Teams | Names, short codes, colors, logos, display order |
| Playoffs | Bracket scores; seeds come from the standings automatically |
| League Settings | Name, tagline, season, logo, current week, scoring, rules |

### Scores are the only weekly chore

Enter the game scores and everything else follows: standings, points, win %, total pins,
team averages, individual averages, the Top 5 leaderboard, form pips, the trend charts and
the playoff seeding.

Every bowled game also gets its own box score at `/games/<matchup id>`: who bowled, what
each of them shot in that game, their series for the night and their season average. Any
game score on the home page, the schedule or a team page opens it. A game with only a
typed-in team total says so rather than showing an empty table.

Two escape hatches exist for when you only have summary numbers:

- **Team record override** (Teams → a team) sets wins/losses/ties/pins directly.
- **Player stat override** (Stats) sets games/average/total/strikes directly.

A blank box always means "calculate it from the game scores". Anything you type wins over
the calculated value, and the admin screens label rows that are overridden.

## Data

`data/league.json` is the whole league — teams, players, weeks, matchups, scores, playoffs
and settings. Back it up like any other document; it is small and human-readable.
Writes are serialized and go through a temp file plus rename, so an interrupted save can't
truncate it.

Uploaded photos and logos live in `public/uploads/` (`players/`, `teams/`, `league/`).
`public/brand/logo.png` is the bundled league logo.

Models are defined in `lib/types.ts`; everything derived lives in `lib/stats.ts`, which is
pure and has no knowledge of React.

### Integrity check

With a commissioner session active, `GET /api/selftest` verifies the league file: schedule
shape, that wins equal losses, that player pins reconcile with team pins, that points match
records, that the bracket resolves, and that the store round-trips a write.

## Notes on the data

Loaded from `BOWLING_LEAGUE_REAL.xlsx` — all 28 bowlers, their season totals, and the
seven team records after week 2. Current week is 3. Verified cell by cell against the
workbook: every team record, every player stat, and both bowled weeks match exactly.

**Rosters were reconstructed, not supplied.** The workbook has no player-to-team
column, so each roster was solved from its team's Total Score: the twenty bowlers with
six games played partition into the five teams that bowled both weeks with exact sums,
and the eight with three games split into the two teams that had a bye. Five of the
seven rosters came out uniquely determined; the Osama Pin Laden / Goop Troop split was
confirmed by the commissioner. **This is the one inferred part of the data** — worth a
once-over on the Teams page.

**Standings rank by win percentage**, matching the workbook's own Standings sheet.
Points would be wrong here: byes leave teams on different game counts, so a 3-3 team
would outrank a 2-1 team. The Points column is still shown, just not used for ordering.

Season totals are stored as carry-over baselines, because the workbook records totals
only — there are no game-by-game scores to derive them from.

### The schedule was corrected

The original sheet left week 5 with two repeated pairings: 2 Fingers met Pocket
Pounders twice and Goop Troop met Osama twice on the same night. That was not a typo in
week 5 — with every pairing required to meet exactly three times, the other six weeks
consumed the rest of the fixtures and left week 5 no other option.

Six matchups across weeks 3, 5 and 7 were swapped to clear it. Weeks 4 and 6 kept their
fixtures, weeks 1 and 2 were untouched, and byes stayed on the same nights. Audited
afterwards on both the local copy and the live site: all 7 weeks have 9 games in 3
rounds of 3, every team faces three different opponents every night, every team byes
once and plays 18 games, and all 21 pairings meet exactly 3 times.

Team crests are cropped from the league's power-rankings graphic and bundled in
`public/brand/teams/`. A stored league picks them up on read, and only for a team that
has no logo, so an upload through the panel is never overwritten.

One discrepancy in the source workbook is left as-is: **Pocket Pounders** posts 1434
pins while its four bowlers sum to 1404. The team total is shown as the workbook states
it.

Still to add: player photos. Until then bowlers show their initials, by design.

## Deploying to Vercel

Live at https://ggbweb-pi.vercel.app, deployed from `main` on every push.

Vercel gives each request a read-only filesystem, so the league file cannot live on
disk there — every commissioner save would fail, and anything written would vanish on
the next deploy. Storage therefore sits behind `lib/storage.ts`: the filesystem
locally, Vercel Blob in production.

To set up a fresh deployment:

1. **Storage** → **Create Database** → **Blob**, then **Connect to Project**.
2. Set `COMMISSIONER_PASSWORD` and `SESSION_SECRET` under **Settings → Environment
   Variables**. There are no defaults; a missing variable disables sign-in entirely.
3. Redeploy. Environment variables only reach a new build.

The Dashboard shows a storage panel with what the running deployment can actually
see — platform, driver, how it is authenticating, the store's access mode — plus a
**Test saving** button that writes a value and reads it back.

### Things that are easy to get wrong here

- **Blob no longer uses a static token.** A connected store contributes
  `BLOB_STORE_ID`, and Vercel injects a short-lived, auto-rotating
  `VERCEL_OIDC_TOKEN` that the SDK pairs with it. `BLOB_READ_WRITE_TOKEN` only exists
  for older stores and for code running off-platform. Either is accepted.
- **A store's access mode is fixed at creation.** This one is private, so uploaded
  crests and photos are streamed back out through `/api/blob/...` rather than linked
  directly — a private blob URL is not fetchable by a browser. That route is
  deliberately unauthenticated, since these are a public league's images, and is
  limited to the `uploads/` prefix so the league document cannot be pulled through it.
- **Production data lives in Blob, not in the repo.** Editing `data/league.json`
  locally does not change the deployed site, and vice versa. They are separate
  leagues.
- **Never run a plain `next build` while a dev server is running** — they share
  `.next` and the build leaves the dev server serving 500s. Use
  `NEXT_DIST_DIR=.next-build npm run build`.

## How season totals accumulate

Each bowler and team carries season totals from the spreadsheet, tagged with the week
they run **through** (week 2). Scores entered for any later week are **added on top**, so
entering week 3 moves the averages, records and pin totals rather than being ignored.
The carried-over numbers never need re-entering.

Clear a bowler's or team's carried-over values to calculate them purely from entered game
scores instead. A blank box always means "calculate it".

**Backfilling weeks 1-2 needs one thing first.** Scores entered for a week at or before
the carry-through week are deliberately ignored, so typing week 1 and 2 results in today
would change nothing. Doing that properly means exposing a "totals carry through week N"
control so it can be set to zero, which does not exist yet. Until then, start at week 3;
every number already on the site is correct without the earlier detail.

## Testing

```bash
node tests/audit-responsive.mjs              # every route at every viewport
node tests/audit-responsive.mjs iphone-se    # or one viewport
```

Flags horizontal page overflow, undersized tap targets, unreadable text, and
console/network errors. `tests/helpers.mjs` has the shared harness, including
`commissionerCookie()` for driving the admin panel. Playwright runs against the
Chrome already installed on the machine, so there is no browser download.

Set `LEAGUE_DATA_DIR` to run against a throwaway copy of the data:

```bash
LEAGUE_DATA_DIR=/tmp/league-test PORT=3001 npm run dev
```

## Design

Tokens are in `app/globals.css`. The palette comes from the league logo — near-black lane,
signal red, cream, Lite gold — and each team carries its own color, which drives its bar,
row tint and crest plate across every page. Type is Barlow Condensed (heavy, italic, upper)
for headings against Barlow for everything else, with tabular figures in every table.

Deliberately avoided: rounded cards, gradient backgrounds, glassmorphism, drop shadows,
decorative icons and animation. Borders are 1px, radii are 2px, and the tables are dense on
purpose.
