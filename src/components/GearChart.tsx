import type { GearResult } from "../lib/drivetrain";

// One horizontal line per chainring, with a dot for each gear placed along a
// shared axis (speed, gear inches, ratio, …). Makes overlaps and gaps between
// chainrings obvious at a glance.

const PALETTE = ["#0b6bcb", "#c0392b", "#157347", "#b7791f", "#7b3fb0", "#0e8a8a"];

export interface GearChartProps {
  gears: GearResult[];
  value: (g: GearResult) => number;
  format: (v: number) => string;
  axisLabel: string;
  pointLabel: (g: GearResult) => string;
}

export function GearChart({ gears, value, format, axisLabel, pointLabel }: GearChartProps) {
  if (gears.length === 0) return <p className="field-hint">No gears to show.</p>;

  // Group gears by chainring, largest ring on top.
  const byRing = new Map<number, GearResult[]>();
  for (const g of gears) {
    const arr = byRing.get(g.chainring) ?? [];
    arr.push(g);
    byRing.set(g.chainring, arr);
  }
  const groups = [...byRing.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([ring, gs]) => ({
      ring,
      points: gs
        .map((g) => ({ g, v: value(g) }))
        .sort((a, b) => a.v - b.v),
    }));

  const values = gears.map(value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;

  const W = 820;
  const mL = 66;
  const mR = 24;
  const mT = 16;
  const mB = 48;
  const rowH = 50;
  const plotW = W - mL - mR;
  const H = mT + groups.length * rowH + mB;
  const axisY = mT + groups.length * rowH;
  const x = (v: number) => mL + ((v - min) / (max - min)) * plotW;

  const tickCount = 6;
  const tickVals = Array.from(
    { length: tickCount },
    (_, i) => min + (i / (tickCount - 1)) * (max - min),
  );

  return (
    <div className="gear-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Gears by ${axisLabel}`}>
        {/* gridlines + tick labels */}
        {tickVals.map((tv, i) => (
          <g key={`t${i}`}>
            <line x1={x(tv)} y1={mT} x2={x(tv)} y2={axisY} className="gc-grid" />
            <text x={x(tv)} y={axisY + 18} className="gc-tick" textAnchor="middle">
              {format(tv)}
            </text>
          </g>
        ))}
        <text x={mL + plotW / 2} y={H - 8} className="gc-axis-label" textAnchor="middle">
          {axisLabel}
        </text>

        {/* one line per chainring */}
        {groups.map((grp, i) => {
          const y = mT + i * rowH + rowH / 2;
          const color = PALETTE[i % PALETTE.length];
          const xs = grp.points.map((p) => x(p.v));
          const x0 = Math.min(...xs);
          const x1 = Math.max(...xs);
          return (
            <g key={grp.ring}>
              <text x={mL - 12} y={y + 4} className="gc-row-label" textAnchor="end">
                {grp.ring}T
              </text>
              <line x1={x0} y1={y} x2={x1} y2={y} stroke={color} className="gc-row-line" />
              {grp.points.map((p, j) => (
                <g key={j}>
                  <circle cx={x(p.v)} cy={y} r={5} fill={color}>
                    <title>{`${grp.ring} × ${pointLabel(p.g)} — ${format(p.v)} ${axisLabel}`}</title>
                  </circle>
                  <text x={x(p.v)} y={y - 11} className="gc-pt-label" textAnchor="middle">
                    {pointLabel(p.g)}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
