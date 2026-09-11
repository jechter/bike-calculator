// A tensiometer-conversion curve drawn as a graph: reading on the x-axis,
// tension (kgf) on the y-axis. Hover or tap anywhere along the curve to read the
// exact reading → tension pair off a crosshair. Because it's a graph you can
// look up in either direction — pick a tension on the y-axis and read across to
// the reading you're aiming for, or pick a reading and read up to its tension.

import { useRef, useState } from "react";
import { readingToKgf, kgfToN, type TensionCurve } from "../lib/spokes";

// "Nice" tick step for an axis range (1/2/5 × 10ⁿ), matching the gear chart.
function niceStep(range: number): number {
  const raw = range / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

// Inner ticks on a nice step plus the exact endpoints, dropping inner ticks that
// crowd an endpoint (same approach as the gear chart's axis).
function axisTicks(min: number, max: number): number[] {
  const step = niceStep(max - min);
  const inner: number[] = [];
  for (let v = Math.ceil(min / step) * step; v < max; v += step) {
    if (v - min >= step * 0.5 && max - v >= step * 0.5) inner.push(v);
  }
  return [min, ...inner, max];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export interface TensionCurveChartProps {
  curve: TensionCurve;
}

export function TensionCurveChart({ curve }: TensionCurveChartProps) {
  const pts = curve.points;
  const minReading = pts[0].reading;
  const maxReading = pts[pts.length - 1].reading;
  // Points are sorted by reading and tension rises monotonically with it.
  const minKgf = pts[0].kgf;
  const maxKgf = pts[pts.length - 1].kgf;

  const containerRef = useRef<HTMLDivElement>(null);

  // The reading currently read off the graph. Sticky between hovers so there's
  // always a value on show; defaults to the middle of the curve.
  const [reading, setReading] = useState((minReading + maxReading) / 2);
  const [hovering, setHovering] = useState(false);

  // Re-clamp the sticky reading when the curve (spoke/tool) changes range — the
  // classic "derive state from props" reset without an effect.
  const [range, setRange] = useState<[number, number]>([minReading, maxReading]);
  if (range[0] !== minReading || range[1] !== maxReading) {
    setRange([minReading, maxReading]);
    setReading((r) => clamp(r, minReading, maxReading));
  }

  const W = 640;
  const H = 340;
  const mL = 54;
  const mR = 18;
  const mT = 16;
  const mB = 42;
  const plotW = W - mL - mR;
  const plotH = H - mT - mB;

  // y-axis padded out to nice round tensions so the gridlines read cleanly.
  const yStep = niceStep(maxKgf - minKgf);
  const yMin = Math.floor(minKgf / yStep) * yStep;
  const yMax = Math.ceil(maxKgf / yStep) * yStep;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += yStep) yTicks.push(v);

  const xTicks = axisTicks(minReading, maxReading);

  const xOf = (r: number) => mL + ((r - minReading) / (maxReading - minReading)) * plotW;
  const yOf = (k: number) => mT + (1 - (k - yMin) / (yMax - yMin)) * plotH;

  const linePts = pts.map((p) => `${xOf(p.reading)},${yOf(p.kgf)}`).join(" ");
  const areaPts = `${xOf(minReading)},${yOf(yMin)} ${linePts} ${xOf(maxReading)},${yOf(yMin)}`;

  const activeReading = clamp(reading, minReading, maxReading);
  const activeKgf = readingToKgf(curve, activeReading);
  const px = xOf(activeReading);
  const py = yOf(activeKgf);

  // Map a pointer's client X to a reading, clamped to the curve. The SVG scales
  // uniformly (width 100%, auto height), so one factor maps px → viewBox units.
  const readingFromEvent = (clientX: number): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return activeReading;
    const scale = W / rect.width;
    const svgX = (clientX - rect.left) * scale;
    const r = minReading + ((svgX - mL) / plotW) * (maxReading - minReading);
    return clamp(r, minReading, maxReading);
  };

  const onMove = (e: React.PointerEvent) => {
    setReading(readingFromEvent(e.clientX));
    setHovering(true);
  };

  // Tooltip position in pixels, kept on-screen near the marker.
  const rect = containerRef.current?.getBoundingClientRect();
  const scale = rect ? rect.width / W : 1;

  return (
    <div className="tc-chart" ref={containerRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Tension against tensiometer reading for ${curve.spokeType} on the ${curve.tool}`}
        style={{ touchAction: "none" }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
      >
        {/* y gridlines + tension labels */}
        {yTicks.map((tv, i) => (
          <g key={`y${i}`}>
            <line x1={mL} y1={yOf(tv)} x2={W - mR} y2={yOf(tv)} className="tc-grid" />
            <text x={mL - 10} y={yOf(tv) + 4} className="tc-tick" textAnchor="end">
              {tv}
            </text>
          </g>
        ))}

        {/* x tick labels (readings) */}
        {xTicks.map((tv, i) => (
          <g key={`x${i}`}>
            <line x1={xOf(tv)} y1={mT} x2={xOf(tv)} y2={mT + plotH} className="tc-grid" />
            <text x={xOf(tv)} y={mT + plotH + 20} className="tc-tick" textAnchor="middle">
              {Number.isInteger(tv) ? tv : tv.toFixed(1)}
            </text>
          </g>
        ))}

        {/* axis captions */}
        <text x={mL + plotW / 2} y={H - 6} className="tc-axis-title" textAnchor="middle">
          Tensiometer reading
        </text>
        <text
          x={14}
          y={mT + plotH / 2}
          className="tc-axis-title"
          textAnchor="middle"
          transform={`rotate(-90 14 ${mT + plotH / 2})`}
        >
          Tension (kgf)
        </text>

        {/* the curve */}
        <polygon points={areaPts} className="tc-area" />
        <polyline points={linePts} className="tc-line" />

        {/* crosshair + marker at the active reading */}
        <line x1={px} y1={mT} x2={px} y2={mT + plotH} className="tc-cross" />
        <line x1={mL} y1={py} x2={px} y2={py} className="tc-cross" />
        <circle cx={px} cy={py} r={6} className="tc-marker" />
      </svg>

      {/* Floating tooltip pinned to the marker while the graph is being hovered. */}
      {hovering && rect && (
        <div
          className="tc-tooltip"
          style={{ left: clamp(px * scale, 8, rect.width - 8), top: py * scale }}
        >
          <div className="tc-tt-reading">Reading {activeReading.toFixed(1)}</div>
          <div className="tc-tt-tension">
            <b>{activeKgf.toFixed(0)} kgf</b> · {kgfToN(activeKgf).toFixed(0)} N
          </div>
        </div>
      )}

      {/* Always-on readout so there's a value even before you hover / on touch. */}
      <div className="tc-readout">
        <span className="tc-readout-reading">Reading {activeReading.toFixed(1)}</span>
        <span className="tc-readout-arrow">→</span>
        <b className="tc-readout-tension">
          {activeKgf.toFixed(0)} kgf · {kgfToN(activeKgf).toFixed(0)} N
        </b>
        <span className="tc-readout-hint">hover or drag across the graph to read any point</span>
      </div>
    </div>
  );
}
