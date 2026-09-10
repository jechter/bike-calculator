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
  /** CVT: draw a thick bar between the low/high endpoints (a continuous range). */
  continuous?: boolean;
  /** How to split the series into rows: one row per chainring (default), or one
   *  row per hub gear — used when a hub is combined with a derailleur + cassette,
   *  so each hub step reads like an extra front gear over the cassette cogs. */
  groupBy?: "chainring" | "hubGear";
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
  /** Called when a gear dot is hovered (for the drivetrain diagram). Continuous
   *  (CVT) rows report a synthetic gear interpolated to the hovered spot. */
  onHover?: (g: GearResult, seriesId: string) => void;
  /** The gear currently shown in the diagram — highlighted with a halo. */
  isActive?: (g: GearResult, seriesId: string) => boolean;
  /** For a continuous (CVT) row: the active overall ratio and its series, so a
   *  handle can be drawn at the current spot along the band. */
  activeRatio?: number;
  activeSeriesId?: string;
}

// Linear interpolation between a CVT's low and high endpoint gears. Every metric
// (ratio, speed, gear inches, development) is linear in the hub ratio, so the
// spot the mouse points at along the band maps straight through.
function lerpGear(lo: GearResult, hi: GearResult, f: number): GearResult {
  const m = (a: number, b: number) => a + (b - a) * f;
  return {
    chainring: lo.chainring,
    cog: lo.cog,
    hubGear:
      lo.hubGear && hi.hubGear
        ? { name: "cvt", ratio: m(lo.hubGear.ratio, hi.hubGear.ratio) }
        : lo.hubGear,
    ratio: m(lo.ratio, hi.ratio),
    gearInches: m(lo.gearInches, hi.gearInches),
    developmentM: m(lo.developmentM, hi.developmentM),
    gainRatio: m(lo.gainRatio ?? 0, hi.gainRatio ?? 0),
    speedKmh: m(lo.speedKmh, hi.speedKmh),
  };
}

interface Row {
  seriesId: string;
  hollow: boolean;
  continuous: boolean;
  isCrossChained?: (g: GearResult) => boolean;
  /** Row label, e.g. "34T" (chainring) or "2nd" (hub gear). */
  label: string;
  /** How this row was grouped — dots are cogs when grouped by hub gear. */
  groupBy: "chainring" | "hubGear";
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
  isActive,
  activeRatio,
  activeSeriesId,
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
    const groupBy = s.groupBy ?? "chainring";
    // Group gears into rows. By chainring (default) each row is a ring; by hub
    // gear each row is a hub step (its cogs are the dots). `sort` puts the
    // hardest gear on top (largest ring / highest hub ratio), matching the
    // diagram's palette order.
    const groups = new Map<string, { label: string; sort: number; gears: GearResult[] }>();
    for (const g of s.gears) {
      const byHub = groupBy === "hubGear" && g.hubGear;
      const key = byHub ? `h:${g.hubGear!.name}` : `r:${g.chainring}`;
      const label = byHub ? g.hubGear!.name : `${g.chainring}T`;
      const sort = byHub ? g.hubGear!.ratio : g.chainring;
      const grp = groups.get(key) ?? { label, sort, gears: [] };
      grp.gears.push(g);
      groups.set(key, grp);
    }
    const groupList = [...groups.values()].sort((a, b) => b.sort - a.sort);
    const start = rows.length;
    groupList.forEach((grp, ri) => {
      rows.push({
        seriesId: s.id,
        hollow: !!s.hollow,
        continuous: !!s.continuous,
        isCrossChained: s.isCrossChained,
        label: grp.label,
        groupBy,
        color: PALETTE[ri % PALETTE.length],
        points: grp.gears.map((g) => ({ g, v: value(g) })).sort((a, b) => a.v - b.v),
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

  // Hovering anywhere along a CVT band picks the ratio at that spot: map the
  // pointer's x to a fraction of the band and report an interpolated gear.
  const pickBand = (row: Row, x0: number, x1: number) => (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!rect || !svg || row.points.length < 2) return;
    // x0/x1 are in SVG user units, so map the pointer through the svg's own box.
    const svgRect = svg.getBoundingClientRect();
    const localX = (e.clientX - svgRect.left) / (svgRect.width / W);
    const f = x1 > x0 ? Math.min(1, Math.max(0, (localX - x0) / (x1 - x0))) : 0;
    const g = lerpGear(row.points[0].g, row.points[row.points.length - 1].g, f);
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
            <g key={`${row.seriesId}-${row.label}`}>
              <text x={mL - 12} y={y + 4} className="gc-row-label" textAnchor="end">
                {comparing ? `${row.seriesId} ${row.label}` : row.label}
              </text>
              <line
                x1={x0}
                y1={y}
                x2={x1}
                y2={y}
                stroke={row.color}
                className={
                  "gc-row-line" +
                  (row.hollow ? " gc-row-line-b" : "") +
                  (row.continuous ? " gc-row-line-cvt" : "")
                }
              />
              {row.points.map((p, j) => {
                const crossed = row.isCrossChained?.(p.g) ?? false;
                const active = isActive?.(p.g, row.seriesId) ?? false;
                return (
                  <g
                    key={j}
                    className={(crossed ? "gc-crossed" : "") + (active ? " gc-active" : "")}
                  >
                    {active && (
                      <circle
                        cx={x(p.v)}
                        cy={y}
                        r={10}
                        fill="none"
                        stroke={row.color}
                        className="gc-dot-halo"
                      />
                    )}
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
                      {row.groupBy === "hubGear" ? `${p.g.cog}` : pointLabel(p.g)}
                    </text>
                  </g>
                );
              })}
              {row.continuous && row.points.length >= 2 && (() => {
                // A handle marks the current pick, and a wide invisible line lets
                // you hover anywhere along the band to choose a ratio.
                const lo = row.points[0].g.ratio;
                const hi = row.points[row.points.length - 1].g.ratio;
                const showHandle =
                  row.seriesId === activeSeriesId && activeRatio != null && hi > lo;
                const hf = showHandle ? Math.min(1, Math.max(0, (activeRatio! - lo) / (hi - lo))) : 0;
                return (
                  <>
                    {showHandle && (
                      <circle cx={x0 + hf * (x1 - x0)} cy={y} r={7} className="gc-cvt-handle" />
                    )}
                    <line
                      x1={x0}
                      y1={y}
                      x2={x1}
                      y2={y}
                      className="gc-cvt-hit"
                      onMouseMove={pickBand(row, x0, x1)}
                      onMouseLeave={() => setHover(null)}
                    />
                  </>
                );
              })()}
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
            {hover.g.chainring} × {hover.g.cog}T
            {hover.g.hubGear ? ` · ${hover.g.hubGear.name}` : ""}
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
