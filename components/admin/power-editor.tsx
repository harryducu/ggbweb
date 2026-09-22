"use client";

import { useState } from "react";
import { ActionForm, StickySave } from "./form-kit";
import { savePowerRankingsAction } from "@/lib/actions";

export interface PowerTeam {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  logo: string | null;
  score: number | null;
  movement: number;
  description: string;
  record: string;
  pins: number;
  standingsRank: number;
}

/**
 * Ranking editor. Order is set by dragging a row or using the arrow buttons —
 * both write to the same hidden `order` field, so keyboard users get the same
 * capability as a mouse.
 */
export function PowerEditor({ teams }: { teams: PowerTeam[] }) {
  const [order, setOrder] = useState<PowerTeam[]>(teams);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  return (
    <ActionForm action={savePowerRankingsAction}>
      <input type="hidden" name="order" value={order.map((t) => t.id).join(",")} />

      <ol className="space-y-2.5">
        {order.map((team, i) => (
          <li
            key={team.id}
            draggable
            onDragStart={() => setDragging(i)}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging !== null) move(dragging, i);
              setDragging(null);
              setOver(null);
            }}
            className={[
              "panel overflow-hidden transition-[border-color,opacity]",
              dragging === i ? "opacity-45" : "",
              over === i && dragging !== null && dragging !== i ? "border-gold" : "",
            ].join(" ")}
            style={{
              boxShadow: `inset 3px 0 0 ${team.color}`,
              background: `linear-gradient(95deg, ${team.color}1f 0%, transparent 45%)`,
            }}
          >
            <div className="flex items-start gap-3 px-3 py-2.5">
              {/* drag handle + keyboard fallback */}
              <div className="flex-none flex flex-col items-center gap-1 pt-0.5">
                <span
                  className="rank cursor-grab active:cursor-grabbing"
                  data-medal={i < 3 ? String(i + 1) : undefined}
                  title="Drag to reorder"
                >
                  {i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="btn btn-sm !px-1.5 !py-0 !text-[0.6rem] disabled:opacity-30"
                    aria-label={`Move ${team.name} up`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === order.length - 1}
                    className="btn btn-sm !px-1.5 !py-0 !text-[0.6rem] disabled:opacity-30"
                    aria-label={`Move ${team.name} down`}
                  >
                    ▼
                  </button>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="display text-[1.1rem] text-cream truncate">{team.name}</span>
                  <span className="hint num">
                    {team.record} · {team.pins.toLocaleString()} pins · #{team.standingsRank} in
                    table
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-[6rem_7rem_minmax(0,1fr)] gap-3">
                  <label className="block">
                    <span className="label">Power score</span>
                    <input
                      type="number"
                      name={`score_${team.id}`}
                      defaultValue={team.score ?? ""}
                      className="input num"
                      placeholder="—"
                      min={0}
                      max={100}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Movement</span>
                    <input
                      type="number"
                      name={`movement_${team.id}`}
                      defaultValue={team.movement}
                      className="input num"
                      placeholder="0"
                    />
                  </label>
                  <label className="block">
                    <span className="label">Commissioner's note</span>
                    <textarea
                      name={`note_${team.id}`}
                      defaultValue={team.description}
                      className="input"
                      rows={2}
                      placeholder="Why they're here this week."
                    />
                  </label>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="hint mt-2">
        Movement is how many places a team moved since last week — positive for up, negative for
        down. Drag a row by its number, or use the arrows.
      </p>

      <StickySave label="Publish rankings" />
    </ActionForm>
  );
}
