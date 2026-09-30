# Good Guys Bowling League — working notes

Read `README.md` first; it is the real documentation. This file is the short list of
things that are easy to get wrong, and the state of play.

Live: **https://ggbweb-pi.vercel.app** · repo `github.com/harryducu/ggbweb` · deploys
from `main` on every push.

## League facts that contradict a reasonable guess

- **7 teams, 28 bowlers.** An early brief said 6 and 24. It was wrong; the graphics and
  spreadsheet say 7. Playoffs take the top 6.
- **A night is 9 separate games, not 3 three-game matches.** Six teams bowl, one byes.
  Each bowling team faces **three different opponents**, one game against each. A record
  like "3-0" means three games won that night.
- **Standings rank by win percentage, not points.** Byes leave teams on different game
  counts, so points would put a 3-3 team above a 2-1 team. The Points column is shown but
  is not the sort key.
- **Rosters were reconstructed, not supplied.** The source workbook has no player-to-team
  column; rosters were solved from each team's total pins. This is the one inferred part
  of the data.
- **The schedule was deliberately changed** from the original sheet. Six matchups across
  weeks 3, 5 and 7 were swapped to remove two repeated pairings in week 5. Weeks 1-2 are
  exactly as bowled. Do not "restore" the spreadsheet version.
- **The current week is a manual setting** (`settings.currentWeek`). Nothing reads the
  calendar; week dates are display only. Entering scores does not advance it.

## Environment

- **Never run a plain `next build` while a dev server is running** — they share `.next`
  and the dev server ends up serving 500s. Use `NEXT_DIST_DIR=.next-build npm run build`.
- `LEAGUE_DATA_DIR` points the league file somewhere else — use it to give tests a
  throwaway copy instead of touching real data.
- **Production data lives in Vercel Blob, not in the repo.** Editing `data/league.json`
  locally does not change the live site, and vice versa.
- Playwright must launch with `channel: "chrome"`; the cached chromium build is
  version-mismatched. `node tests/audit-responsive.mjs` sweeps every route and viewport.
- Harry runs `git push` himself — it is blocked for Claude here, and so is granting the
  permission. Hand him the command.

## Mistakes already made here; do not repeat them

- Tailwind grids need an explicit `grid-cols-1` base. A grid with only `lg:grid-cols-2`
  gets an `auto` track that inflates to min-content and overflows the page on phones.
- A diagnostic that writes must snapshot and restore, never null out.
- A form that renders inputs for only some records must declare which it covered, or
  saving deletes the rest. This wiped bye-team and free-agent scores once.
- Atomic writes need a random temp suffix, not just the pid.
- `readLeague` must not call `mutateLeague` — that deadlocks the write chain.
- Never ship a default password or signing key. A missing env var fails closed and names
  itself.

## Outstanding

- **Player photos** — the last placeholder; bowlers show initials.
- **Backfilling weeks 1-2** — Harry intends to. Needs a "totals carry through week N"
  control first, or the entered scores are ignored: totals are tagged `throughWeek: 2`
  and only later weeks accumulate. Roughly 144 scores.
- Admin panel testing never finished. Stats overrides, league settings, the reset and
  clear confirmation gates, and the edge-case battery are unverified.
- Minor: Stats page team-abbreviation links are 31px wide on a phone.
