"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface StatsRow {
  id: string;
  name: string;
  photo: string | null;
  teamId: string | null;
  teamName: string;
  teamAbbr: string;
  teamColor: string;
  games: number;
  average: number | null;
  totalScore: number;
  strikes: number;
  highGame: number | null;
  lowGame: number | null;
  extras: Record<string, number | null>;
}

export interface StatsColumn {
  key: string;
  label: string;
  /** Sorting direction that reads as "best first". */
  lowerIsBetter?: boolean;
  digits?: number;
}

export interface TeamOption {
  id: string;
  name: string;
  abbr: string;
  color: string;
}

const CORE: StatsColumn[] = [
  { key: "games", label: "GP" },
  { key: "average", label: "Avg", digits: 1 },
  { key: "totalScore", label: "Total" },
  { key: "strikes", label: "Strikes" },
  { key: "highGame", label: "High" },
  { key: "lowGame", label: "Low", lowerIsBetter: true },
];

export function StatsTable({
  rows,
  extraColumns,
  teams,
}: {
  rows: StatsRow[];
  extraColumns: StatsColumn[];
  teams: TeamOption[];
}) {
  const columns = useMemo(() => [...CORE, ...extraColumns], [extraColumns]);
  const [sortKey, setSortKey] = useState<string>("average");
  const [desc, setDesc] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const valueOf = (row: StatsRow, key: string): number | null => {
    if (key in row) return row[key as keyof StatsRow] as number | null;
    return row.extras[key] ?? null;
  };

  const sorted = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (teamFilter !== "all" && r.teamId !== teamFilter) return false;
      if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const av = valueOf(a, sortKey);
      const bv = valueOf(b, sortKey);
      // Bowlers with no value for the sorted column always sink to the bottom,
      // whichever direction the column is sorted.
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av === bv) return a.name.localeCompare(b.name);
      return desc ? bv - av : av - bv;
    });
  }, [rows, sortKey, desc, teamFilter, query]);

  const toggle = (col: StatsColumn) => {
    if (col.key === sortKey) {
      setDesc((d) => !d);
      return;
    }
    setSortKey(col.key);
    setDesc(!col.lowerIsBetter);
  };

  // Leaders in the active column get gold numerals — identifies the best
  // performers without giant hero cards.
  const bestValue = useMemo(() => {
    const vals = sorted.map((r) => valueOf(r, sortKey)).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    const col = columns.find((c) => c.key === sortKey);
    return col?.lowerIsBetter ? Math.min(...vals) : Math.max(...vals);
  }, [sorted, sortKey, columns]);

  const fmt = (v: number | null, digits = 0) =>
    v === null ? "—" : digits ? v.toFixed(digits) : Math.round(v).toLocaleString();

  return (
    <div className="space-y-3">
      {/* -------------------------------------------------------- controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          <FilterChip active={teamFilter === "all"} onClick={() => setTeamFilter("all")}>
            All teams
          </FilterChip>
          {teams.map((t) => (
            <FilterChip
              key={t.id}
              active={teamFilter === t.id}
              color={t.color}
              onClick={() => setTeamFilter(t.id)}
              title={t.name}
            >
              {t.abbr}
            </FilterChip>
          ))}
        </div>
        <label className="flex-none w-full sm:w-48">
          <span className="sr">Search bowlers</span>
          <input
            type="search"
            className="input"
            placeholder="Search bowler…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {/* ----------------------------------------------------------- table */}
      <div className="panel overflow-hidden">
        <div className="table-scroll">
          <table className="stat">
            <thead>
              <tr>
                <th className="left w-8">#</th>
                <th className="left">Bowler</th>
                <th className="left">Team</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    aria-sort={col.key === sortKey ? (desc ? "descending" : "ascending") : "none"}
                  >
                    <button
                      type="button"
                      className="sort-btn"
                      data-active={col.key === sortKey}
                      onClick={() => toggle(col)}
                      title={`Sort by ${col.label}`}
                    >
                      {col.label}
                      <span aria-hidden className="text-[0.6rem]">
                        {col.key === sortKey ? (desc ? "▼" : "▲") : "⇅"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const v = valueOf(row, sortKey);
                const isBest = bestValue !== null && v === bestValue && v !== null;
                const medal = i < 3 && v !== null ? String(i + 1) : undefined;
                return (
                  <tr
                    key={row.id}
                    className="team-bar"
                    style={{ ["--team" as string]: row.teamColor }}
                  >
                    <td className="num">
                      {medal ? (
                        <span className="rank !w-5 !h-5 !text-[0.7rem]" data-medal={medal}>
                          {i + 1}
                        </span>
                      ) : (
                        <span className="dim">{i + 1}</span>
                      )}
                    </td>
                    <td className="key left">
                      <Link
                        href={`/players/${row.id}`}
                        className="hover:text-cream transition-colors truncate"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="left dim">
                      {row.teamId ? (
                        <Link
                          href={`/teams/${row.teamId}`}
                          className="hover:text-cream"
                          title={row.teamName}
                        >
                          {row.teamAbbr}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    {columns.map((col) => {
                      const cv = valueOf(row, col.key);
                      const highlight = col.key === sortKey && isBest;
                      return (
                        <td
                          key={col.key}
                          className={[
                            col.key === sortKey ? "font-semibold" : "",
                            highlight ? "text-gold" : cv === null ? "dim" : "",
                          ].join(" ")}
                        >
                          {fmt(cv, col.digits)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {sorted.length === 0 ? (
                <tr>
                  <td className="left dim" colSpan={3 + columns.length}>
                    No bowlers match that filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="hint">
        Tap any column heading to sort. Gold numbers mark the league leader in the sorted column.
        Blank cells mean the stat has not been entered yet.
      </p>
    </div>
  );
}

function FilterChip({
  active,
  color,
  onClick,
  children,
  title,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className="badge cursor-pointer transition-colors"
      style={
        active
          ? {
              color: "#fff",
              background: color ?? "var(--color-red)",
              borderColor: color ?? "var(--color-red)",
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
