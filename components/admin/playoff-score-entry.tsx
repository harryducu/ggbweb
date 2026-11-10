"use client";

import { useState } from "react";
import { ActionForm, StickySave } from "./form-kit";
import { savePlayoffScoresAction } from "@/lib/actions";
import type { EntryTeam } from "./score-entry";

/**
 * Bowler scores for one playoff series or tiebreaker. Same grid as the weekly
 * entry, but saved onto the series so none of it counts toward season stats.
 */
export function PlayoffScoreEntry({
  seriesId,
  label,
  bestOf,
  teams,
  initialScores,
  initialStrikes,
}: {
  seriesId: string;
  label: string;
  bestOf: number;
  teams: EntryTeam[];
  initialScores: Record<string, number | null>;
  initialStrikes: Record<string, number | null>;
}) {
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initialScores).map(([k, v]) => [k, v === null ? "" : String(v)]),
    ),
  );
  const [showStrikes, setShowStrikes] = useState(false);
  const GAMES = Array.from({ length: bestOf }, (_, i) => i + 1);
  const need = Math.floor(bestOf / 2) + 1;

  const teamTotal = (team: EntryTeam, game: number): number | null => {
    const vals = team.players
      .map((p) => scores[`s_${p.id}_${game}`])
      .filter((v) => v !== undefined && v !== "")
      .map(Number)
      .filter((n) => Number.isFinite(n));
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };

  const seriesTotal = (team: EntryTeam): number | null => {
    const games = GAMES.map((g) => teamTotal(team, g));
    return games.some((v) => v !== null) ? games.reduce<number>((n, v) => n + (v ?? 0), 0) : null;
  };

  /** Games won by each side so far — the series result for best-of rounds. */
  const [a, b] = teams;
  const wins = [0, 0];
  for (const g of GAMES) {
    const x = a ? teamTotal(a, g) : null;
    const y = b ? teamTotal(b, g) : null;
    if (x === null || y === null || x === y) continue;
    wins[x > y ? 0 : 1]++;
  }
  const summary =
    bestOf === 1
      ? teams.map((t) => `${t.abbreviation} ${seriesTotal(t) ?? "—"}`).join("  ·  ")
      : `${a?.abbreviation} ${wins[0]} – ${wins[1]} ${b?.abbreviation} · best of ${bestOf}, first to ${need}`;

  return (
    <ActionForm action={savePlayoffScoresAction}>
      <input type="hidden" name="seriesId" value={seriesId} />
      <input
        type="hidden"
        name="coveredPlayerIds"
        value={teams.flatMap((t) => t.players.map((p) => p.id)).join(",")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <span className="badge">{summary}</span>
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {teams.map((team) => (
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
                    <th className="w-16">Pins</th>
                  </tr>
                </thead>
                <tbody>
                  {team.players.map((p) => {
                    const vals = GAMES.map((g) => scores[`s_${p.id}_${g}`]).filter(
                      (v) => v !== undefined && v !== "",
                    );
                    const series = vals.length ? vals.map(Number).reduce((a, b) => a + b, 0) : null;
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
                            {/* Always submitted, only hidden, so saved strike
                                counts aren't wiped when the box is unchecked. */}
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
                      <td className="left dim" colSpan={bestOf + 2}>
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
                      {seriesTotal(team) ?? "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>

      <p className="hint mt-3">
        Fill in only the games that were bowled. Each game goes to the team with more pins
        {bestOf > 1 ? `, and the first to ${need} game wins takes the series` : ""}. A result typed
        under Manage Playoffs, or a winner set by hand there, takes priority.
      </p>

      <StickySave label={`Save ${label} scores`} />
    </ActionForm>
  );
}
