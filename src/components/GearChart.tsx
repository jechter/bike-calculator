import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GearResult } from "../lib/drivetrain";
import { kmhToMph } from "../lib/units";
import { useUnits, speedUnitLabel } from "../units-context";

// One horizontal line per chainring, with a dot for each gear placed along a
// shared axis (speed, gear inches, ratio, …). The axis metric is chosen from a
// dropdown built into the chart. The first/last gridlines align with the lowest
// and highest gear so their values can be read straight off the axis.

const PALETTE = ["#0b6bcb", "#c0392b", "#157347", "#b7791f", "#7b3fb0", "#0e8a8a"];

export interface AxisOption {
  value: string;
  label: string;
}

export interface GearChartProps {
  gears: GearResult[];
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
  /** Mark a gear as cross-chained (greyed out; avoid shifting into it). */
  isCrossChained?: (g: GearResult) => boolean;
  /** Called when a gear dot is hovered (for the drivetrain diagram). */
  onHover?: (g: GearResult) => void;
}

export function GearChart({
  gears,
  metric,
  options,
  onMetricChange,
  value,
  format,
  pointLabel,
  cadenceRpm,
  extra,
  isCrossChained,
  onHover,
}: GearChartProps) {
  const units = useUnits();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ g: GearResult; left: number; top: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  if (gears.length === 0) return <p className="field-hint">No gears to show.</p>;

  const currentLabel = options.find((o) => o.value === metric)?.label ?? "";

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
      points: gs.map((g) => ({ g, v: value(g) })).sort((a, b) => a.v - b.v),
    }));

  const values = gears.map(value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const W = 820;
  const mL = 66;
  const mR = 48;
  const mT = 16;
  const mB = 34;
  const rowH = 50;
  const plotW = W - mL - mR;
  const H = mT + groups.length * rowH + mB;
  const axisY = mT + groups.length * rowH;
  const x = (v: number) => mL + ((v - min) / (max - min)) * plotW;

  // First and last ticks are exactly the lowest / highest gear values.
  const tickCount = 6;
  const tickVals = Array.from(
    { length: tickCount },
    (_, i) => min + (i / (tickCount - 1)) * (max - min),
  );

  const showTip = (g: GearResult) => (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ g, left: e.clientX - rect.left, top: e.clientY - rect.top });
    onHover?.(g);
  };

  return (
    <div className="gear-chart" ref={containerRef}>
      <div className="gc-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Gears by ${currentLabel}`}>
        {tickVals.map((tv, i) => (
          <g key={`t${i}`}>
            <line x1={x(tv)} y1={mT} x2={x(tv)} y2={axisY} className="gc-grid" />
            <text x={x(tv)} y={axisY + 18} className="gc-tick" textAnchor="middle">
              {format(tv)}
            </text>
          </g>
        ))}

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
              {grp.points.map((p, j) => {
                const crossed = isCrossChained?.(p.g) ?? false;
                return (
                  <g key={j} className={crossed ? "gc-crossed" : undefined}>
                    <circle
                      cx={x(p.v)}
                      cy={y}
                      r={6}
                      fill={crossed ? "var(--muted)" : color}
                      className="gc-dot"
                      onMouseMove={showTip(p.g)}
                      onMouseEnter={showTip(p.g)}
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
          {isCrossChained?.(hover.g) && <div className="gc-tt-warn">cross-chained — avoid</div>}
        </div>
      )}
    </div>
  );
}
