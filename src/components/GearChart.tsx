import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GearResult } from "../lib/drivetrain";
import { kmhToMph } from "../lib/units";
import { useUnits, speedUnitLabel } from "../units-context";

// One horizontal line per chainring, with a dot for each gear placed along a
// shared axis (speed, gear inches, ratio, …). The axis metric is chosen from a
// dropdown built into the chart. The first/last gridlines align with the lowest
// and highest gear so their values can be read straight off the axis.
//
// The chart takes one or more *series* (drivetrain configs). With a single
// series it draws one row per chainring in the palette colours (matching the
// drivetrain diagram). When comparing two configs their gears share one axis so
// range, overlap and gaps line up; the second config is drawn with hollow dots
// and a dashed line, behind a faint band, so it's clearly the other drivetrain.

// One colour per chainring line (largest ring first). Shared with the
// drivetrain diagram so the selected gear matches the chart.
export const PALETTE = ["#0b6bcb", "#c0392b", "#157347", "#b7791f", "#7b3fb0", "#0e8a8a"];

export interface AxisOption {
  value: string;
  label: string;
}

export interface GearSeries {
  /** Short id used for row labels and hover reporting, e.g. "A" / "B". */
  id: string;
  gears: GearResult[];
  /** Draw dots hollow + line dashed (the compared-against config). */
  hollow?: boolean;
  /** Mark a gear as cross-chained (greyed out; avoid shifting into it). */
  isCrossChained?: (g: GearResult) => boolean;
}

export interface GearChartProps {
  series: GearSeries[];
  metric: string;
  options: AxisOption[];
  onMetricChange: (v: string) => void;
  value: (g: GearResult) => number;
  format: (v: number) => string;
  pointLabel: (g: GearResult) => string;
  /** Cadence used for the speed values, shown in the tooltip. */
  cadenceRpm: number;
  /** Optional extra control rendered in the axis bar (e.g. cadence). */
  extra?: ReactNode;
  /** Called when a gear dot is hovered (for the drivetrain diagram). */
  onHover?: (g: GearResult, seriesId: string) => void;
}

interface Row {
  seriesId: string;
  hollow: boolean;
  isCrossChained?: (g: GearResult) => boolean;
  ring: number;
  color: string;
  points: Array<{ g: GearResult; v: number }>;
}

export function GearChart({
  series,
  metric,
  options,
  onMetricChange,
  value,
  format,
  pointLabel,
  cadenceRpm,
  extra,
  onHover,
}: GearChartProps) {
  const units = useUnits();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ g: GearResult; row: Row; left: number; top: number } | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const allGears = series.flatMap((s) => s.gears);
  if (allGears.length === 0) return <p className="field-hint">No gears to show.</p>;

  const comparing = series.length > 1;
  const currentLabel = options.find((o) => o.value === metric)?.label ?? "";

  // Build the rows: within each series, one row per chainring (largest on top),
  // coloured from the palette so a single-series chart matches the diagram.
  const rows: Row[] = [];
  const seriesBounds: Array<{ start: number; end: number; hollow: boolean }> = [];
  for (const s of series) {
    const byRing = new Map<number, GearResult[]>();
    for (const g of s.gears) {
      const arr = byRing.get(g.chainring) ?? [];
      arr.push(g);
      byRing.set(g.chainring, arr);
    }
    const ringGroups = [...byRing.entries()].sort((a, b) => b[0] - a[0]);
    const start = rows.length;
    ringGroups.forEach(([ring, gs], ri) => {
      rows.push({
        seriesId: s.id,
        hollow: !!s.hollow,
        isCrossChained: s.isCrossChained,
        ring,
        color: PALETTE[ri % PALETTE.length],
        points: gs.map((g) => ({ g, v: value(g) })).sort((a, b) => a.v - b.v),
      });
    });
    seriesBounds.push({ start, end: rows.length, hollow: !!s.hollow });
  }

  const values = allGears.map(value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const W = 820;
  const mL = comparing ? 74 : 66;
  const mR = 48;
  const mT = 16;
  const mB = 34;
  const rowH = 50;
  const plotW = W - mL - mR;
  const H = mT + rows.length * rowH + mB;
  const axisY = mT + rows.length * rowH;
  const x = (v: number) => mL + ((v - min) / (max - min)) * plotW;
  const rowY = (i: number) => mT + i * rowH + rowH / 2;

  // Outer ticks are the exact lowest/highest gear; inner ticks are round
  // numbers on a "nice" step (e.g. 20, 25, 30, …), skipping any that fall too
  // close to the extremes.
  const niceStep = (range: number) => {
    const raw = range / 6;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  };
  const step = niceStep(max - min);
  const inner: number[] = [];
  for (let v = Math.ceil(min / step) * step; v < max; v += step) {
    if (v - min >= step * 0.5 && max - v >= step * 0.5) inner.push(v);
  }
  const tickVals = [min, ...inner, max];
  // Drop trailing zeros (20.0 -> 20) but keep the extremes' decimals (13.8).
  const tickLabel = (v: number) => {
    const s = format(v);
    return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  };

  const showTip = (g: GearResult, row: Row) => (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ g, row, left: e.clientX - rect.left, top: e.clientY - rect.top });
    onHover?.(g, row.seriesId);
  };

  return (
    <div className="gear-chart" ref={containerRef}>
      <div className="gc-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Gears by ${currentLabel}`}>
        {/* Faint band behind each compared (hollow) series to group its rows. */}
        {comparing &&
          seriesBounds
            .filter((b) => b.hollow)
            .map((b, i) => (
              <rect
                key={`band${i}`}
                className="gc-band"
                x={0}
                y={mT + b.start * rowH}
                width={W}
                height={(b.end - b.start) * rowH}
              />
            ))}

        {tickVals.map((tv, i) => (
          <g key={`t${i}`}>
            <line x1={x(tv)} y1={mT} x2={x(tv)} y2={axisY} className="gc-grid" />
            <text x={x(tv)} y={axisY + 18} className="gc-tick" textAnchor="middle">
              {tickLabel(tv)}
            </text>
          </g>
        ))}

        {rows.map((row, i) => {
          const y = rowY(i);
          const xs = row.points.map((p) => x(p.v));
          const x0 = Math.min(...xs);
          const x1 = Math.max(...xs);
          return (
            <g key={`${row.seriesId}-${row.ring}`}>
              <text x={mL - 12} y={y + 4} className="gc-row-label" textAnchor="end">
                {comparing ? `${row.seriesId} ${row.ring}T` : `${row.ring}T`}
              </text>
              <line
                x1={x0}
                y1={y}
                x2={x1}
                y2={y}
                stroke={row.color}
                className={"gc-row-line" + (row.hollow ? " gc-row-line-b" : "")}
              />
              {row.points.map((p, j) => {
                const crossed = row.isCrossChained?.(p.g) ?? false;
                return (
                  <g key={j} className={crossed ? "gc-crossed" : undefined}>
                    <circle
                      cx={x(p.v)}
                      cy={y}
                      r={6}
                      fill={row.hollow ? "var(--panel)" : crossed ? "var(--muted)" : row.color}
                      stroke={row.hollow ? (crossed ? "var(--muted)" : row.color) : undefined}
                      strokeWidth={row.hollow ? 2 : undefined}
                      className="gc-dot"
                      onMouseMove={showTip(p.g, row)}
                      onMouseEnter={showTip(p.g, row)}
                      onMouseLeave={() => setHover(null)}
                    />
                    <text x={x(p.v)} y={y - 12} className="gc-pt-label" textAnchor="middle">
                      {pointLabel(p.g)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      </div>

      {/* Axis label + metric selector, built into the chart */}
      <div className="gc-axis">
        <span className="gc-axis-caption">Show gears by</span>
        <div className="gc-axis-menu" ref={menuRef}>
          <button
            type="button"
            className={"gc-axis-btn" + (menuOpen ? " open" : "")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {currentLabel}
            <span className="caret">▾</span>
          </button>
          {menuOpen && (
            <ul className="preset-list gc-axis-list">
              {options.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    className={o.value === metric ? "active" : ""}
                    onClick={() => {
                      onMetricChange(o.value);
                      setMenuOpen(false);
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {extra && <div className="gc-axis-extra">{extra}</div>}
      </div>

      {hover && (
        <div className="gc-tooltip" style={{ left: hover.left, top: hover.top }}>
          <div className="gc-tt-title">
            {comparing && <span className="gc-tt-tag">{hover.row.seriesId}</span>}
            {hover.g.chainring} × {hover.g.hubGear ? hover.g.hubGear.name : `${hover.g.cog}T`}
          </div>
          <div className="gc-tt-row">
            <span>Ratio</span>
            <b>{hover.g.ratio.toFixed(2)}</b>
          </div>
          <div className="gc-tt-row">
            <span>Gear inches</span>
            <b>{hover.g.gearInches.toFixed(1)}</b>
          </div>
          <div className="gc-tt-row">
            <span>Development</span>
            <b>{hover.g.developmentM.toFixed(2)} m</b>
          </div>
          <div className="gc-tt-row">
            <span>Speed @ {cadenceRpm} rpm</span>
            <b>
              {(units.speed === "mph" ? kmhToMph(hover.g.speedKmh) : hover.g.speedKmh).toFixed(1)}{" "}
              {speedUnitLabel(units.speed)}
            </b>
          </div>
          {hover.row.isCrossChained?.(hover.g) && (
            <div className="gc-tt-warn">cross-chained — avoid</div>
          )}
        </div>
      )}
    </div>
  );
}
