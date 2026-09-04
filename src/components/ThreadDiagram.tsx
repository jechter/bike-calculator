import type { Thread } from "../lib/threadDirection";

export interface Selection {
  name: string;
  side: "left" | "right";
  thread: Thread;
  loosenDirection: "CW" | "CCW";
}

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (cx: number, cy: number, r: number, deg: number): [number, number] => [
  cx + r * Math.cos(rad(deg)),
  cy + r * Math.sin(rad(deg)),
];

// A curved arrow (arc + arrowhead) around (cx,cy). clockwise = screen clockwise.
function ArcArrow(props: {
  cx: number;
  cy: number;
  r: number;
  startDeg: number;
  sweep: number;
  clockwise: boolean;
  className: string;
  width: number;
}) {
  const { cx, cy, r, startDeg, sweep, clockwise, className, width } = props;
  const dir = clockwise ? 1 : -1;
  const endDeg = startDeg + dir * sweep;
  const [x0, y0] = pt(cx, cy, r, startDeg);
  const [x1, y1] = pt(cx, cy, r, endDeg);
  const largeArc = sweep > 180 ? 1 : 0;
  const sweepFlag = clockwise ? 1 : 0;
  const d = `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${x1} ${y1}`;
  // motion (tangent) direction at the end point
  const m: [number, number] = clockwise
    ? [-Math.sin(rad(endDeg)), Math.cos(rad(endDeg))]
    : [Math.sin(rad(endDeg)), -Math.cos(rad(endDeg))];
  const perp: [number, number] = [-m[1], m[0]];
  const s = 12;
  const tip = [x1 + m[0] * s, y1 + m[1] * s];
  const b1 = [x1 + perp[0] * s * 0.55, y1 + perp[1] * s * 0.55];
  const b2 = [x1 - perp[0] * s * 0.55, y1 - perp[1] * s * 0.55];
  return (
    <g className={className}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" />
      <polygon points={`${tip[0]},${tip[1]} ${b1[0]},${b1[1]} ${b2[0]},${b2[1]}`} fill="currentColor" />
    </g>
  );
}

const word = (d: "CW" | "CCW") => (d === "CW" ? "clockwise ↻" : "anti-clockwise ↺");

export function ThreadDiagram({ sel }: { sel: Selection }) {
  const loosenCW = sel.loosenDirection === "CW";
  const tighten = loosenCW ? "CCW" : "CW";
  const sideLabel = sel.side === "left" ? "Left / non-drive" : "Right / drive";

  return (
    <div className="td-diagram">
      <div className="td-dia-title">{sel.name}</div>
      <div className="td-dia-sub">
        {sideLabel} · <span className={"badge " + (sel.thread === "LH" ? "lh" : "rh")}>{sel.thread}</span>
      </div>
      <svg viewBox="0 0 200 200" role="img" aria-label={`Turn direction for ${sel.name}`}>
        {/* fastener */}
        <circle cx={100} cy={100} r={30} className="td-fastener" />
        <circle cx={100} cy={100} r={6} className="td-fastener-center" />
        {/* loosen (outer) and tighten (inner). Both arcs occupy the same fixed
            place (a ring with a gap at the bottom); only the arrowhead end/direction
            flips with the thread hand. */}
        <ArcArrow cx={100} cy={100} r={72} startDeg={loosenCW ? 170 : 10} sweep={200} clockwise={loosenCW} className="td-loosen" width={7} />
        <ArcArrow cx={100} cy={100} r={46} startDeg={!loosenCW ? 170 : 10} sweep={200} clockwise={!loosenCW} className="td-tighten" width={7} />
      </svg>
      <div className="td-key">
        <div className="td-key-row">
          <span className="td-swatch loosen" /> To loosen — turn <strong>{word(sel.loosenDirection)}</strong>
        </div>
        <div className="td-key-row">
          <span className="td-swatch tighten" /> To tighten — turn <strong>{word(tighten)}</strong>
        </div>
      </div>
      <div className="td-dia-foot">as you face the {sel.side === "left" ? "non-drive" : "drive"} side</div>
    </div>
  );
}
