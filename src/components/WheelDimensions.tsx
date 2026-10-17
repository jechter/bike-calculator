// Dimension arrows drawn over the 3D wheel: when a distance field (ERD, flange
// diameter, center-to-flange offset…) is hovered or edited, the matching
// measurement is drawn as a double-headed arrow on the wheel, the way the frame
// size diagram highlights reach and stack. The wheel is WebGL, so the arrows are
// an SVG layer: each endpoint is a point in the wheel's model space (rim radius =
// 1, axle along +Z — see Wheel3D) projected with the current camera matrix, so
// the arrow follows the wheel as it's rotated or zoomed.

import type { ReactNode } from "react";

export type WheelDimensionKind =
  | "erd"
  | "rimHoleOffset"
  | "rimHoleGap"
  | "holeDia"
  | "leftFlange"
  | "rightFlange"
  | "leftOffset"
  | "rightOffset"
  | "leftSpoke"
  | "rightSpoke";

/** Dimensions measured on the hub — only a few mm across, so editing one calls
 *  for a close-up. */
export const HUB_DIMENSIONS = new Set<WheelDimensionKind>([
  "holeDia", "leftFlange", "rightFlange", "leftOffset", "rightOffset",
]);

export interface WheelDimension {
  kind: WheelDimensionKind;
  /** The measurement's value, as shown beside the arrow (e.g. "602 mm"). */
  label: string;
}

/** One spoke's end points in model space: flange hole (on the flange plane) and
 *  rim-bed hole (at radius 1, nudged axially by any alternating drilling). */
export interface SpokeAnchor {
  isDrive: boolean;
  lead: number;
  hub: number[];
  rim: number[];
}

/** The wheel geometry the arrows hang off, in model units. */
export interface WheelDimensionGeometry {
  lfR: number;
  rfR: number;
  zL: number;
  zR: number;
  /** How far the flange disc extends past its spoke-hole circle. */
  flEdge: number;
  /** Radius of the drawn flange holes. */
  holeR: number;
  /** Rim holes per drilled group (1 = evenly drilled). */
  rimHoleGroup: number;
  /** Indexed by rim hole, going around the wheel. */
  spokes: SpokeAnchor[];
}

type V3 = number[];
interface P {
  x: number;
  y: number;
}

const TAU = 2 * Math.PI;
const ANGLES = Array.from({ length: 72 }, (_, i) => (TAU * i) / 72);

export function WheelDimensions(props: {
  dimension: WheelDimension;
  geometry: WheelDimensionGeometry;
  /** Column-major model-view-projection matrix (as passed to the shader). */
  mvp: Float32Array;
  width: number;
  height: number;
}) {
  const { dimension, geometry: g, mvp, width, height } = props;
  const { kind, label } = dimension;

  // Model-space point → CSS pixels in the canvas (null when behind the camera).
  const project = (p: V3): P | null => {
    const [x, y, z] = p;
    const w = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
    if (w < 0.05) return null;
    const nx = (mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]) / w;
    const ny = (mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]) / w;
    return { x: ((nx + 1) / 2) * width, y: ((1 - ny) / 2) * height };
  };
  const ring = (r: number, z: number, a: number): V3 => [r * Math.cos(a), r * Math.sin(a), z];
  const screenY = (p: V3) => project(p)?.y ?? Infinity;

  // The in-plane diameter (radius r at axial z) that reads longest on screen, so
  // the arrow isn't foreshortened whichever way the wheel is turned. A slight
  // preference for horizontal settles the tie in the face-on view.
  const bestDiameter = (r: number, z: number): [P, P] | null => {
    let best: [P, P] | null = null;
    let bestScore = -1;
    for (const a of ANGLES.slice(0, 36)) {
      const p = project(ring(r, z, a));
      const q = project(ring(r, z, a + Math.PI));
      if (!p || !q) continue;
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      const score = len * (1 + 0.05 * (Math.abs(q.x - p.x) / (len || 1)));
      if (score > bestScore) {
        bestScore = score;
        best = p.x <= q.x ? [p, q] : [q, p];
      }
    }
    return best;
  };

  // The in-plane direction whose point (radius r, axial z) sits highest on
  // screen — where an axial arrow stays clear of the hub and spokes.
  const topAngle = (r: number, z: number) =>
    ANGLES.reduce((best, a) => (screenY(ring(r, z, a)) < screenY(ring(r, z, best)) ? a : best), 0);

  // A circle of radius r at axial z, as a projected polyline.
  const circle = (r: number, z: number) =>
    ANGLES.concat(0)
      .map((a) => project(ring(r, z, a)))
      .filter((p): p is P => !!p)
      .map((p) => `${p.x},${p.y}`)
      .join(" ");

  let body: ReactNode = null;

  if (kind === "erd") {
    const d = bestDiameter(1, 0);
    body = (
      <>
        <polyline points={circle(1, 0)} className="wd-dim-guide" />
        {d && <Arrow a={d[0]} b={d[1]} label={label} labelAt={0.8} />}
      </>
    );
  } else if (kind === "leftFlange" || kind === "rightFlange") {
    const isDrive = kind === "rightFlange";
    const r = isDrive ? g.rfR : g.lfR;
    const z = isDrive ? g.zR : g.zL;
    const d = bestDiameter(r, z);
    body = (
      <>
        <polyline points={circle(r, z)} className="wd-dim-guide" />
        {d && <Arrow a={d[0]} b={d[1]} label={label} labelAt={0.85} />}
      </>
    );
  } else if (kind === "leftOffset" || kind === "rightOffset") {
    // Axial arrow from the wheel's center plane to the flange, set just outside
    // the bigger flange, with extension lines back to the hub.
    const isDrive = kind === "rightOffset";
    const fR = (isDrive ? g.rfR : g.lfR) + g.flEdge;
    const z = isDrive ? g.zR : g.zL;
    const r = Math.max(g.lfR, g.rfR) + g.flEdge + 0.08;
    const a = topAngle(r, z / 2);
    const A = project(ring(r, 0, a));
    const B = project(ring(r, z, a));
    const c0 = project(ring(0.05, 0, a));
    const c1 = project(ring(r + 0.03, 0, a));
    const f0 = project(ring(fR, z, a));
    const f1 = project(ring(r + 0.03, z, a));
    body = (
      <>
        {c0 && c1 && <Line a={c0} b={c1} className="wd-dim-guide" />}
        {f0 && f1 && <Line a={f0} b={f1} className="wd-dim-guide" />}
        {A && B && <Arrow a={A} b={B} label={label} />}
      </>
    );
  } else if (kind === "rimHoleOffset") {
    // The axial nudge of a rim hole from the rim's center line, on the top-most
    // drive-side hole, with the center line itself drawn along the rim bed.
    const drive = g.spokes.filter((s) => s.isDrive);
    const s = drive.reduce<SpokeAnchor | null>(
      (best, s) => (!best || screenY(s.rim) < screenY(best.rim) ? s : best),
      null,
    );
    if (s) {
      const a = Math.atan2(s.rim[1], s.rim[0]);
      const center = Array.from({ length: 13 }, (_, i) => project(ring(1, 0, a + (i - 6) * 0.025)))
        .filter((p): p is P => !!p)
        .map((p) => `${p.x},${p.y}`)
        .join(" ");
      const A = project(ring(1, 0, a));
      const B = project(s.rim);
      body = (
        <>
          <polyline points={center} className="wd-dim-guide" />
          {B && <circle cx={B.x} cy={B.y} r={7} className="wd-dim-ring" />}
          {A && B && <Arrow a={A} b={B} label={label} />}
        </>
      );
    }
  } else if (kind === "rimHoleGap") {
    // Grouped drilling: the gap between two groups, at the group boundary highest
    // on screen. The arrow curves along the rim just inside its bed, with ticks
    // out to the two holes either side.
    const G = g.rimHoleGroup;
    const n = g.spokes.length;
    const angle = (i: number) => Math.atan2(g.spokes[i % n].rim[1], g.spokes[i % n].rim[0]);
    const r = 0.92;
    const gapY = (k: number) =>
      screenY(ring(1, 0, angle(k - 1) + angleDiff(angle(k - 1), angle(k)) / 2));
    let best = -1;
    for (let k = G; k <= n && G >= 2; k += G) if (best < 0 || gapY(k) < gapY(best)) best = k;
    if (best > 0) {
      const a1 = angle(best - 1); // last hole of one group…
      const a2 = angle(best); // …and the first of the next
      const tick = (a: number) => {
        const p = project(ring(1, 0, a));
        const q = project(ring(r - 0.03, 0, a));
        return p && q ? <Line key={a} a={p} b={q} className="wd-dim-guide" /> : null;
      };
      // The rim arc from angle `from` to `to` (radius r) as a screen polyline,
      // plus tails past each end for when it's too short to fit the heads.
      const arc = (from: number, to: number) => {
        const span = angleDiff(from, to);
        const along = (t0: number, t1: number) =>
          Array.from({ length: 17 }, (_, i) => project(ring(r, 0, from + span * (t0 + ((t1 - t0) * i) / 16))))
            .filter((p): p is P => !!p);
        const pts = along(0, 1);
        const len = polylineLength(pts);
        const tail = len > 0 ? (HEAD + 10) / len : 0;
        return len < 2 * HEAD + 6 ? { pts, before: along(-tail, 0), after: along(1, 1 + tail) } : { pts };
      };
      // The label goes inside the rim (toward the hub), clear of the rim itself.
      const C = project([0, 0, 0]);
      const gap = arc(a1, a2);
      const mid = gap.pts[Math.floor(gap.pts.length / 2)];
      let labelAt: P | undefined;
      if (mid && C) {
        const d = Math.hypot(C.x - mid.x, C.y - mid.y) || 1;
        labelAt = { x: mid.x + ((C.x - mid.x) / d) * 14, y: mid.y + ((C.y - mid.y) / d) * 14 };
      }
      body = (
        <>
          {[a1, a2].map(tick)}
          <ArcArrow {...gap} label={label} labelAt={labelAt} />
        </>
      );
    }
  } else if (kind === "holeDia") {
    // Across the top-most flange hole on each side, ringed so the tiny hole is
    // easy to find. Both flanges share one hole size, so it's labeled once.
    body = [false, true].map((isDrive) => {
      const s = g.spokes
        .filter((s) => s.isDrive === isDrive)
        .reduce<SpokeAnchor | null>(
          (best, s) => (!best || screenY(s.hub) < screenY(best.hub) ? s : best),
          null,
        );
      if (!s) return null;
      const [x, y, z] = s.hub;
      const rl = Math.hypot(x, y) || 1;
      const t = [-y / rl, x / rl]; // in-plane tangent at the hole
      const A = project([x - t[0] * g.holeR, y - t[1] * g.holeR, z]);
      const B = project([x + t[0] * g.holeR, y + t[1] * g.holeR, z]);
      const C = project(s.hub);
      return (
        <g key={String(isDrive)}>
          {C && <circle cx={C.x} cy={C.y} r={9} className="wd-dim-ring" />}
          {A && B && <Arrow a={A} b={B} label={isDrive ? label : ""} />}
        </g>
      );
    });
  } else if (kind === "leftSpoke" || kind === "rightSpoke") {
    // Alongside one spoke on that side (a crossed one where the side has both,
    // as crow's foot does), flange hole to rim bed.
    const isDrive = kind === "rightSpoke";
    const side = g.spokes.filter((s) => s.isDrive === isDrive);
    const crossed = side.filter((s) => s.lead !== 0);
    const pool = crossed.length ? crossed : side;
    const mid = (s: SpokeAnchor) => s.hub.map((v, i) => (v + s.rim[i]) / 2);
    const s = pool.reduce<SpokeAnchor | null>(
      (best, s) => (!best || screenY(mid(s)) < screenY(mid(best)) ? s : best),
      null,
    );
    const A = s && project(s.hub);
    const B = s && project(s.rim);
    body = A && B ? <Arrow a={A} b={B} label={label} labelAt={0.55} offset={10} /> : null;
  }

  return (
    <svg
      className="wd-dims"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      data-dimension={kind}
    >
      {body}
    </svg>
  );
}

const HEAD = 9; // arrowhead length (px)

const polylineLength = (pts: P[]) =>
  pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

// Arrowhead with its tip at `tip`, pointing along the unit vector (ox, oy).
function headPoints(tip: P, ox: number, oy: number) {
  const w = HEAD * 0.45;
  return (
    `${tip.x},${tip.y} ${tip.x - HEAD * ox - w * oy},${tip.y - HEAD * oy + w * ox} ` +
    `${tip.x - HEAD * ox + w * oy},${tip.y - HEAD * oy - w * ox}`
  );
}

// A double-headed dimension arrow along a curve (screen polyline `pts`), e.g.
// following the rim. Given tails (`before` / `after`), it's too short for heads
// inside, so they sit at the ends pointing in, like the straight Arrow's.
function ArcArrow(props: { pts: P[]; before?: P[]; after?: P[]; label?: string; labelAt?: P }) {
  const { pts, before, after, label, labelAt } = props;
  if (pts.length < 2) return null;
  const unit = (p: P, q: P) => {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: (q.x - p.x) / d, y: (q.y - p.y) / d };
  };
  const first = pts[0];
  const last = pts[pts.length - 1];
  const out0 = unit(pts[1], first); // pointing out of the start
  const out1 = unit(pts[pts.length - 2], last); // pointing out of the end
  const inside = !before;
  const line = [...(before ?? []), ...pts, ...(after ?? [])].map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <g className="wd-dim">
      <polyline points={line} className="wd-dim-halo" />
      <polyline points={line} className="wd-dim-seg" />
      <polygon points={inside ? headPoints(first, out0.x, out0.y) : headPoints(first, -out0.x, -out0.y)} />
      <polygon points={inside ? headPoints(last, out1.x, out1.y) : headPoints(last, -out1.x, -out1.y)} />
      {label && labelAt && (
        <text x={labelAt.x} y={labelAt.y} className="wd-dim-label" textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      )}
    </g>
  );
}

// Signed shortest angle from a to b.
function angleDiff(a: number, b: number) {
  return ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
}

function Line(props: { a: P; b: P; className: string }) {
  const { a, b, className } = props;
  return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={className} />;
}

// A double-headed dimension arrow between two screen points, with a soft halo
// and its value labeled beside it. Too short to fit both heads between the ends
// (a hole diameter, a few mm of offset), the heads move outside and point in —
// the drafting convention for small dimensions.
function Arrow(props: {
  a: P;
  b: P;
  label: string;
  labelAt?: number;
  offset?: number;
}) {
  const { label, labelAt = 0.5, offset = 0 } = props;
  const H = HEAD;
  const dx = props.b.x - props.a.x;
  const dy = props.b.y - props.a.y;
  const L = Math.hypot(dx, dy);
  const ux = L > 0.01 ? dx / L : 1;
  const uy = L > 0.01 ? dy / L : 0;
  // Unit normal pointing up the screen: labels and offsets go that way.
  let nx = -uy;
  let ny = ux;
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  const a = { x: props.a.x + nx * offset, y: props.a.y + ny * offset };
  const b = { x: props.b.x + nx * offset, y: props.b.y + ny * offset };
  const outside = L < 2 * H + 6;
  // Arrowhead with its tip at `tip`, pointing along (ox, oy).
  const head = (tip: P, ox: number, oy: number) =>
    `${tip.x},${tip.y} ${tip.x - H * ox + H * 0.45 * nx},${tip.y - H * oy + H * 0.45 * ny} ` +
    `${tip.x - H * ox - H * 0.45 * nx},${tip.y - H * oy - H * 0.45 * ny}`;
  const tail = H + 10;
  const s = outside ? { x: a.x - ux * tail, y: a.y - uy * tail } : a;
  const e = outside ? { x: b.x + ux * tail, y: b.y + uy * tail } : b;
  const lx = a.x + (b.x - a.x) * labelAt + nx * 14;
  const ly = a.y + (b.y - a.y) * labelAt + ny * 14;
  return (
    <g className="wd-dim">
      <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} className="wd-dim-halo" />
      <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} className="wd-dim-seg" />
      <polygon points={outside ? head(a, ux, uy) : head(a, -ux, -uy)} />
      <polygon points={outside ? head(b, -ux, -uy) : head(b, ux, uy)} />
      {label && <text x={lx} y={ly} className="wd-dim-label" textAnchor="middle" dominantBaseline="middle">
        {label}
      </text>}
    </g>
  );
}
