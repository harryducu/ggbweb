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

Loaded from `BOWLING_LEAGUE_REAL.xlsx` — all 28 bowlers, their season totals, and
the seven team records after week 2. Current week is 3.

**Rosters were reconstructed, not supplied.** The workbook has no player-to-team
column, so each team's roster was solved from its Total Score: the twenty bowlers
with six games played partition into the five teams that bowled both weeks with
exact sums, and the eight with three games split into the two teams that have had
a bye. Five of the seven rosters come out uniquely determined; the Osama Pin Laden
/ Goop Troop split was confirmed by the commissioner. **Worth a once-over** on the
Teams page — it is the one part of the data that is inferred rather than read.

**Standings are ranked by win percentage**, matching the workbook's own Standings
sheet. Points would be wrong here: byes leave teams on different game counts, so a
3-3 team would outrank a 2-1 team. The Points column is still shown, just not used
for ordering.

Season totals are stored as manual overrides, because the workbook records totals
only — there are no game-by-game scores to derive them from. Enter game scores
under Enter Scores and the derived values take over; clear the overrides in Teams
and Stats when you no longer need them.

Two discrepancies in the source workbook, left as-is rather than papered over:

- **Pocket Pounders** posts 1434 pins, but its four bowlers sum to 1404 — a 30-pin
  gap. The team total is shown as the workbook states it.
- **Week 5 repeats two pairings** (2F1T plays Pocket Pounders twice, Goop Troop
  plays Osama Pin Laden twice). The season-wide total still works out exactly —
  all 21 pairs meet three times — so it may be intentional. Fix it under Schedule
  if not.

Still to add: team logos and player photos. Until then teams show a colour plate
or short code and players show their initials, both by design.

## Deploying to Vercel

The commissioner panel **cannot save** on Vercel until you add storage. Vercel gives each
request a read-only filesystem, so writing `data/league.json` throws, and anything that did
get written would be thrown away on the next deploy. The admin panel detects this and shows
a red banner explaining it.

To fix it, once:

1. Vercel dashboard → your project → **Storage** → **Create** → **Blob**.
2. Connect the store to the project.
3. Redeploy.

That injects `BLOB_READ_WRITE_TOKEN`, which is the only signal the app needs — it switches
to Blob storage automatically, for both the league document and uploaded photos and logos.
On first load it seeds the store from the workbook data baked into `lib/seed.ts`.

Also set `COMMISSIONER_PASSWORD` and `SESSION_SECRET` as environment variables in Vercel;
`.env.local` is not deployed.

Note that once Blob is live, production data lives in Blob, not in the repo's
`data/league.json`. Editing that file locally will not change the deployed site.

## How season totals accumulate

Each bowler and team carries a set of season totals from the spreadsheet, tagged with the
week they run **through** (week 2). Scores entered for any later week are **added on top** —
so entering week 3 moves the averages, records and pin totals rather than being ignored.
You never have to re-enter the carried-over numbers.

Clear a bowler's or team's carried-over values to calculate them purely from entered game
scores instead. A blank box always means "calculate it".

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
