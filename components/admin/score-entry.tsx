"use client";

import { useMemo, useState } from "react";
import { ActionForm, Check, DangerSubmit, FormStatus, StickySave } from "./form-kit";
import { clearWeekScoresAction, saveWeekScoresAction } from "@/lib/actions";

export interface EntryPlayer {
  id: string;
  name: string;
}

export interface EntryTeam {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  players: EntryPlayer[];
}

export interface EntryMatchup {
  id: string;
  game: 1 | 2 | 3;
  team1Id: string;
  team2Id: string;
  team1Score: number | null;
  team2Score: number | null;
}

const GAMES = [1, 2, 3] as const;

/**
 * Week score entry. Scores are typed per bowler per game; team totals, the
 * night's win/loss result and every derived stat follow from those, and update
 * live as you type so a fat-fingered 1500 is obvious before you save.
 */
export function ScoreEntry({
  weekId,
  weekNumber,
  teams,
  byeTeamId,
  matchups,
  initialScores,
  initialStrikes,
  completed,
  notes,
}: {
  weekId: string;
  weekNumber: number;
  teams: EntryTeam[];
  byeTeamId: string | null;
  matchups: EntryMatchup[];
  initialScores: Record<string, number | null>;
  initialStrikes: Record<string, number | null>;
  completed: boolean;
  notes: string;
}) {
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initialScores).map(([k, v]) => [k, v === null ? "" : String(v)]),
    ),
  );
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const m of matchups) {
      out[`t1_${m.id}`] = m.team1Score === null ? "" : String(m.team1Score);
      out[`t2_${m.id}`] = m.team2Score === null ? "" : String(m.team2Score);
    }
    return out;
  });
  const [showStrikes, setShowStrikes] = useState(false);

  const playing = teams.filter((t) => t.id !== byeTeamId);
  const byeTeam = teams.find((t) => t.id === byeTeamId);

  /** Sum of a team's bowlers for one game — blank inputs simply don't count. */
  const teamTotal = (team: EntryTeam, game: number): number | null => {
    const vals = team.players
      .map((p) => scores[`s_${p.id}_${game}`])
      .filter((v) => v !== undefined && v !== "")
      .map(Number)
      .filter((n) => Number.isFinite(n));
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };

  const effective = (matchupId: string, side: 1 | 2, team: EntryTeam | undefined, game: number) => {
    const manual = overrides[`t${side}_${matchupId}`];
    if (manual !== undefined && manual !== "") return Number(manual);
    return team ? teamTotal(team, game) : null;
  };

  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const results = matchups.map((m) => {
    const t1 = byId.get(m.team1Id);
    const t2 = byId.get(m.team2Id);
    const s1 = effective(m.id, 1, t1, m.game);
    const s2 = effective(m.id, 2, t2, m.game);
    const done = s1 !== null && s2 !== null;
    return {
      m,
      t1,
      t2,
      s1,
      s2,
      done,
      winner: !done || s1 === s2 ? null : s1! > s2! ? t1 : t2,
      tie: done && s1 === s2,
    };
  });

  const bowled = results.filter((r) => r.done).length;

  return (
    <div className="space-y-5">
      <ActionForm action={saveWeekScoresAction}>
        <input type="hidden" name="weekId" value={weekId} />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="badge">
              {bowled}/{matchups.length} games resolved
            </span>
            {byeTeam ? <span className="badge badge-bye">Bye: {byeTeam.name}</span> : null}
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-[0.82rem] text-muted">
            <input
              type="checkbox"
              checked={showStrikes}
              onChange={(e) => setShowStrikes(e.target.checked)}
              className="h-4 w-4 accent-red"
            />
            Also enter strike counts
          </label>
        </div>

        {/* ------------------------------------------ per-team score grids */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {playing.map((team) => (
            <div key={team.id} className="panel overflow-hidden">
              <div className="panel-head" style={{ boxShadow: `inset 3px 0 0 ${team.color}` }}>
                <span className="display text-[1rem] text-cream">{team.name}</span>
                <span className="overline">{team.players.length} bowlers</span>
              </div>

              <div className="table-scroll">
                <table className="stat">
                  <thead>
                    <tr>
                      <th className="left">Bowler</th>
                      {GAMES.map((g) => (
                        <th key={g} className="w-16">
                          G{g}
                        </th>
                      ))}
                      <th className="w-16">Series</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.players.map((p) => {
                      const vals = GAMES.map((g) => scores[`s_${p.id}_${g}`]).filter(
                        (v) => v !== undefined && v !== "",
                      );
                      const series = vals.length
                        ? vals.map(Number).reduce((a, b) => a + b, 0)
                        : null;
                      return (
                        <tr key={p.id}>
                          <td className="key left max-w-[10rem] truncate" title={p.name}>
                            {p.name}
                          </td>
                          {GAMES.map((g) => (
                            <td key={g} className="!px-1.5">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={300}
                                name={`s_${p.id}_${g}`}
                                value={scores[`s_${p.id}_${g}`] ?? ""}
                                onChange={(e) =>
                                  setScores((s) => ({ ...s, [`s_${p.id}_${g}`]: e.target.value }))
                                }
                                className="input input-num"
                                placeholder="—"
                                aria-label={`${p.name} game ${g} score`}
                              />
                              {/* Always rendered, only hidden — an input that isn't
                                  submitted would wipe the strike counts already on file. */}
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={12}
                                name={`x_${p.id}_${g}`}
                                defaultValue={
                                  initialStrikes[`x_${p.id}_${g}`] == null
                                    ? ""
                                    : String(initialStrikes[`x_${p.id}_${g}`])
                                }
                                className={[
                                  "input input-num !mt-1 !py-0.5 !text-[0.72rem] !text-muted",
                                  showStrikes ? "" : "hidden",
                                ].join(" ")}
                                placeholder="X"
                                aria-label={`${p.name} game ${g} strikes`}
                              />
                            </td>
                          ))}
                          <td className="num font-semibold text-cream">{series ?? "—"}</td>
                        </tr>
                      );
                    })}
                    {team.players.length === 0 ? (
                      <tr>
                        <td className="left dim" colSpan={5}>
                          No bowlers on this roster yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink-2">
                      <td className="left overline !py-2">Team total</td>
                      {GAMES.map((g) => (
                        <td key={g} className="num font-semibold text-gold !py-2">
                          {teamTotal(team, g) ?? "—"}
                        </td>
                      ))}
                      <td className="num font-semibold text-gold !py-2">
                        {GAMES.map((g) => teamTotal(team, g)).some((v) => v !== null)
                          ? GAMES.reduce((n, g) => n + (teamTotal(team, g) ?? 0), 0)
                          : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------ live results */}
        <div className="panel overflow-hidden mt-5">
          <div className="panel-head">
            <span className="overline">Week {weekNumber} results as entered</span>
            <span className="overline">Winner is calculated from team totals</span>
          </div>
          <div className="table-scroll">
            <table className="stat">
              <thead>
                <tr>
                  <th className="left w-12">Game</th>
                  <th className="left">Matchup</th>
                  <th className="w-20">Score</th>
                  <th className="w-20">Score</th>
                  <th className="left w-40 pl-4">Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.m.id}>
                    <td className="left dim">G{r.m.game}</td>
                    <td className="key left">
                      <span className={r.winner?.id === r.t1?.id ? "text-cream" : ""}>
                        {r.t1?.abbreviation ?? "?"}
                      </span>
                      <span className="text-muted-2 mx-1.5">v</span>
                      <span className={r.winner?.id === r.t2?.id ? "text-cream" : ""}>
                        {r.t2?.abbreviation ?? "?"}
                      </span>
                    </td>
                    <td className="!px-1.5">
                      <input
                        type="number"
                        min={0}
                        name={`t1_${r.m.id}`}
                        value={overrides[`t1_${r.m.id}`] ?? ""}
                        onChange={(e) =>
                          setOverrides((o) => ({ ...o, [`t1_${r.m.id}`]: e.target.value }))
                        }
                        className="input input-num"
                        placeholder={r.t1 ? String(r.s1 ?? "—") : "—"}
                        aria-label={`${r.t1?.name} team total override, game ${r.m.game}`}
                      />
                    </td>
                    <td className="!px-1.5">
                      <input
                        type="number"
                        min={0}
                        name={`t2_${r.m.id}`}
                        value={overrides[`t2_${r.m.id}`] ?? ""}
                        onChange={(e) =>
                          setOverrides((o) => ({ ...o, [`t2_${r.m.id}`]: e.target.value }))
                        }
                        className="input input-num"
                        placeholder={r.t2 ? String(r.s2 ?? "—") : "—"}
                        aria-label={`${r.t2?.name} team total override, game ${r.m.game}`}
                      />
                    </td>
                    <td className="left pl-4">
                      {!r.done ? (
                        <span className="badge">Not bowled</span>
                      ) : r.tie ? (
                        <span className="badge">
                          Tie {r.s1}–{r.s2}
                        </span>
                      ) : (
                        <span className="badge badge-up">
                          {r.winner?.abbreviation} by {Math.abs((r.s1 ?? 0) - (r.s2 ?? 0))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint px-3 py-2 border-t border-line">
            Leave the score boxes above blank to use the totals calculated from the bowlers. Fill
            one in to override it — useful when you have a team score but not the individual lines.
          </p>
        </div>

        {/* ------------------------------------------------------ notes */}
        <div className="panel p-3.5 mt-5">
          <label className="block">
            <span className="label">Week recap (optional)</span>
            <textarea
              name="notes"
              defaultValue={notes}
              className="input"
              rows={2}
              placeholder="Shown on the home page and the schedule for this week."
            />
          </label>
          <div className="mt-2">
            <Check
              name="completed"
              label="Mark this week complete"
              defaultChecked={completed}
              hint="Completed weeks show a Final badge on the schedule."
            />
          </div>
        </div>

        <StickySave label={`Save week ${weekNumber}`} />
      </ActionForm>

      {/* ------------------------------------------------------ danger zone */}
      <ActionForm action={clearWeekScoresAction} className="panel p-3.5">
        <input type="hidden" name="weekId" value={weekId} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="overline">Start this week over</div>
            <p className="hint mt-0.5">
              Clears every score for week {weekNumber}. Rosters and the schedule are untouched.
            </p>
          </div>
          <DangerSubmit confirmLabel={`Clear week ${weekNumber}`}>Clear scores</DangerSubmit>
        </div>
        <FormStatus />
      </ActionForm>
    </div>
  );
}
