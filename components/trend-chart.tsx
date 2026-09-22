import { fmtAvg } from "@/lib/stats";

export interface TrendPoint {
  label: string;
  value: number | null;
}

/**
 * Weekly average trend, drawn as inline SVG. No chart library, no animation —
 * one line, a reference average, and honest gaps for bye weeks.
 */
export function TrendChart({
  points,
  reference,
  referenceLabel = "Season avg",
  height = 180,
}: {
  points: TrendPoint[];
  reference?: number | null;
  referenceLabel?: string;
  height?: number;
}) {
  const filled = points.filter((p): p is { label: string; value: number } => p.value !== null);
  if (filled.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted">
        No games bowled yet — the trend line appears after the first week of scores.
      </div>
    );
  }

  const W = 640;
  const H = height;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 26;

  const values = filled.map((p) => p.value);
  if (reference !== null && reference !== undefined) values.push(reference);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Pad the domain to a round 10 so the gridlines land on readable numbers.
  const min = Math.max(0, Math.floor((rawMin - 8) / 10) * 10);
  const max = Math.ceil((rawMax + 8) / 10) * 10;
  const span = Math.max(max - min, 10);

  const x = (i: number) =>
    points.length <= 1 ? padL : padL + (i * (W - padL - padR)) / (points.length - 1);
  const y = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB);

  // Break the path at bye weeks instead of drawing a straight line through them.
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let run: Array<{ x: number; y: number }> = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length) segments.push(run);
      run = [];
      return;
    }
    run.push({ x: x(i), y: y(p.value) });
  });
  if (run.length) segments.push(run);

  const ticks = [min, min + span / 2, max];

  return (
    <div className="px-1 pt-2 pb-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Weekly average, ${fmtAvg(rawMin)} to ${fmtAvg(rawMax)}`}
      >
        <g className="chart-grid">
          {ticks.map((t) => (
            <line key={t} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
          ))}
        </g>

        {ticks.map((t) => (
          <text
            key={`l${t}`}
            x={padL - 7}
            y={y(t) + 3.5}
            textAnchor="end"
            fontSize="10"
            fill="var(--color-muted-2)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(t)}
          </text>
        ))}

        {reference !== null && reference !== undefined ? (
          <>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(reference)}
              y2={y(reference)}
              stroke="var(--color-red)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.75"
            />
            <text
              x={W - padR}
              y={y(reference) - 5}
              textAnchor="end"
              fontSize="9.5"
              fill="var(--color-red)"
              style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              {referenceLabel} {fmtAvg(reference)}
            </text>
          </>
        ) : null}

        {segments.map((seg, si) => (
          <g key={si}>
            {seg.length > 1 ? (
              <>
                <path
                  className="chart-area"
                  d={`M ${seg[0].x} ${H - padB} ${seg.map((p) => `L ${p.x} ${p.y}`).join(" ")} L ${seg[seg.length - 1].x} ${H - padB} Z`}
                />
                <path
                  className="chart-line"
                  d={`M ${seg.map((p) => `${p.x} ${p.y}`).join(" L ")}`}
                />
              </>
            ) : null}
            {seg.map((p, i) => (
              <circle key={i} className="chart-dot" cx={p.x} cy={p.y} r="3" />
            ))}
          </g>
        ))}

        {points.map((p, i) => (
          <text
            key={`x${i}`}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill={p.value === null ? "var(--color-muted-2)" : "var(--color-muted)"}
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
