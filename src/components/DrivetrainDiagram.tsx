// Schematic side view of the drivetrain, in real mm (chain pitch 12.7 mm), then
// scaled to fit. Chainring(s) up front and cassette cogs at the rear, spaced by
// the chainstay length, with the chain over the active gear. For a derailleur
// setup a rear derailleur is simulated: the tension pulley swings on its cage so
// the total chain length stays constant as the gear changes.

import { PALETTE } from "./GearChart";

const PITCH = 12.7; // chain pitch, mm
const pr = (teeth: number) => (teeth * PITCH) / (2 * Math.PI); // pitch radius, mm
const PULLEY = pr(9); // 9T jockey wheels
const CAGE = 70; // guide->tension pulley spacing, mm

type V = { x: number; y: number };
const onCircle = (c: V, r: number, ang: number): V => ({ x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) });

// External-tangent touch points (both circles wrapped the same way).
function extTan(A: V, rA: number, B: V, rB: number, s: number): { a: V; b: V } {
  const beta = Math.atan2(B.y - A.y, B.x - A.x);
  const d = Math.hypot(B.x - A.x, B.y - A.y);
  const g = Math.acos(Math.max(-1, Math.min(1, (rA - rB) / d)));
  const phi = beta + s * g;
  return { a: onCircle(A, rA, phi), b: onCircle(B, rB, phi) };
}
// Internal (crossing) tangent — used where the chain switches wrap direction,
// e.g. cassette (wrapped one way) to a derailleur pulley (the other way).
function intTan(A: V, rA: number, B: V, rB: number, s: number): { a: V; b: V } {
  const beta = Math.atan2(B.y - A.y, B.x - A.x);
  const d = Math.hypot(B.x - A.x, B.y - A.y);
  const g = Math.acos(Math.max(-1, Math.min(1, (rA + rB) / d)));
  const phi = beta + s * g;
  return { a: onCircle(A, rA, phi), b: onCircle(B, rB, phi + Math.PI) };
}
const extTanLen = (c1: V, r1: number, c2: V, r2: number) => {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
  return Math.sqrt(Math.max(0, d * d - (r1 - r2) ** 2));
};
const intTanLen = (c1: V, r1: number, c2: V, r2: number) => {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
  return Math.sqrt(Math.max(0, d * d - (r1 + r2) ** 2));
};
// Both intersection points of two circles, or null.
function circInt2(c0: V, r0: number, c1: V, r1: number): [V, V] | null {
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d > r0 + r1 || d < Math.abs(r0 - r1)) return null;
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const xm = c0.x + (a * dx) / d;
  const ym = c0.y + (a * dy) / d;
  const ox = (-dy / d) * h;
  const oy = (dx / d) * h;
  return [
    { x: xm + ox, y: ym + oy },
    { x: xm - ox, y: ym - oy },
  ];
}
// Arc command from a to b on circle (c, r), clockwise (cw) or counter-clockwise.
function arc(c: V, r: number, a: V, b: V, cw: boolean): string {
  const aa = Math.atan2(a.y - c.y, a.x - c.x);
  const ab = Math.atan2(b.y - c.y, b.x - c.x);
  let span = cw ? ab - aa : aa - ab;
  while (span < 0) span += 2 * Math.PI;
  const large = span > Math.PI ? 1 : 0;
  return `A ${r} ${r} 0 ${large} ${cw ? 1 : 0} ${b.x} ${b.y}`;
}
const pt = (p: V) => `${p.x} ${p.y}`;

export interface DrivetrainDiagramProps {
  chainrings: number[];
  cogs: number[];
  activeChainring: number;
  activeCog: number;
  chainstayMm: number;
  hasDerailleur: boolean;
}

export function DrivetrainDiagram(props: DrivetrainDiagramProps) {
  const { chainstayMm, hasDerailleur } = props;
  const rings = [...new Set(props.chainrings)].filter((n) => n > 0).sort((a, b) => b - a);
  const cs = [...new Set(props.cogs)].filter((n) => n > 0).sort((a, b) => b - a);
  if (rings.length === 0 || cs.length === 0) return null;

  const F: V = { x: 0, y: 0 };
  const R: V = { x: chainstayMm, y: 0 };
  const rf = pr(props.activeChainring);
  const rr = pr(props.activeCog);

  // Upper (taut) run tangent points, top of chainring to top of cog.
  const gamma = Math.acos(Math.max(-1, Math.min(1, (rf - rr) / chainstayMm)));
  const chainTop = onCircle(F, rf, -gamma);
  const cogTop = onCircle(R, rr, -gamma);
  const chainBot = onCircle(F, rf, gamma);
  const cogBot = onCircle(R, rr, gamma);

  const paths: string[] = [];
  const pulleys: V[] = [];

  if (hasDerailleur) {
    // Guide pulley just below the engaged cog (tracks it, ~B-gap), directly below
    // the hub so the cage swings around vertical.
    const G: V = { x: R.x, y: R.y + rr + 8 + PULLEY };
    // Reference chain length: a middle gear with the cage hanging straight down,
    // so bigger cogs retract the cage and smaller cogs extend it symmetrically.
    const refRing = pr(rings[Math.floor(rings.length / 2)]);
    const refCog = pr(cs[Math.floor(cs.length / 2)]);
    const GRef: V = { x: R.x, y: R.y + refCog + 8 + PULLEY };
    const TRef: V = { x: GRef.x, y: GRef.y + CAGE };
    // Chain routing: right of cog (CW) -> left of guide (CCW) -> right of tension
    // (CW) -> out the bottom to the chainring. So cog->guide and guide->tension
    // are internal (crossing) tangents; the upper and lower runs are external.
    const GT = Math.sqrt(Math.max(0, CAGE * CAGE - (2 * PULLEY) ** 2)); // internal cage tangent
    const Ltarget =
      extTanLen(F, refRing, R, refCog) +
      intTanLen(R, refCog, GRef, PULLEY) +
      GT +
      extTanLen(TRef, PULLEY, F, refRing);

    // Solve the tension pulley so the length stays Ltarget.
    const need = Ltarget - extTanLen(F, rf, R, rr) - intTanLen(R, rr, G, PULLEY) - GT;
    let TF = Math.sqrt(Math.max(0, need * need + (PULLEY - rf) ** 2));
    const FG = Math.hypot(G.x - F.x, G.y - F.y);
    TF = Math.max(FG - CAGE + 1, Math.min(FG + CAGE - 1, TF));
    const hits = circInt2(G, CAGE, F, TF);
    // Tension pulley hangs below the guide.
    const T = hits ? (hits[0].y > hits[1].y ? hits[0] : hits[1]) : { x: G.x, y: G.y + CAGE };
    pulleys.push(G, T);

    const fr = extTan(F, rf, R, rr, -1); // upper run: top of chainring & cog
    const rg = intTan(R, rr, G, PULLEY, -1); // right of cog -> left of guide (cross)
    const gt = intTan(G, PULLEY, T, PULLEY, +1); // left of guide -> right of tension (cross)
    const tf = extTan(T, PULLEY, F, rf, -1); // bottom of tension -> chainring
    paths.push(
      `M ${pt(fr.a)} L ${pt(fr.b)} ${arc(R, rr, fr.b, rg.a, true)} L ${pt(rg.b)} ` +
        `${arc(G, PULLEY, rg.b, gt.a, false)} L ${pt(gt.b)} ${arc(T, PULLEY, gt.b, tf.a, true)} L ${pt(tf.b)} ` +
        `${arc(F, rf, tf.b, fr.a, true)} Z`,
    );
  } else {
    // No derailleur (single speed / hub): a plain loop over the two gears.
    paths.push(
      `M ${pt(chainTop)} L ${pt(cogTop)} A ${rr} ${rr} 0 0 1 ${pt(cogBot)} ` +
        `L ${pt(chainBot)} A ${rf} ${rf} 0 1 1 ${pt(chainTop)} Z`,
    );
  }

  // Fixed viewBox so the diagram keeps a constant size across gears: sized from
  // the largest gears and the derailleur's full downward reach.
  const rfMax = pr(rings[0]);
  const rrMax = pr(cs[0]);
  const topExtent = Math.max(rfMax, rrMax);
  const derailBottom = rrMax + 8 + PULLEY + CAGE + PULLEY;
  const m = 10;
  const minX = -rfMax - m;
  const maxX = R.x + rrMax + PULLEY + m;
  const minY = -topExtent - m - 10; // room for labels
  const maxY = (hasDerailleur ? derailBottom : topExtent) + m;
  const W = maxX - minX;
  const H = maxY - minY;

  // Selected-gear colour matches the chainring's line in the gear chart.
  const activeColor = PALETTE[Math.max(0, rings.indexOf(props.activeChainring)) % PALETTE.length];

  return (
    <div className="dt-diagram">
      <svg viewBox={`${minX} ${minY} ${W} ${H}`} width="100%" role="img" aria-label="Drivetrain view">
        {/* cassette cogs */}
        {cs.map((c) => (
          <circle
            key={"c" + c}
            cx={R.x}
            cy={R.y}
            r={pr(c)}
            className={c === props.activeCog ? "dt-gear-active" : "dt-gear"}
            style={c === props.activeCog ? { stroke: activeColor } : undefined}
          />
        ))}
        {/* chainrings */}
        {rings.map((r) => (
          <circle
            key={"r" + r}
            cx={F.x}
            cy={F.y}
            r={pr(r)}
            className={r === props.activeChainring ? "dt-gear-active" : "dt-gear"}
            style={r === props.activeChainring ? { stroke: activeColor } : undefined}
          />
        ))}
        {/* rear derailleur cage + pulleys */}
        {pulleys.length === 2 && (
          <>
            <line x1={pulleys[0].x} y1={pulleys[0].y} x2={pulleys[1].x} y2={pulleys[1].y} className="dt-cage" />
            {pulleys.map((p, i) => (
              <g key={"p" + i}>
                <circle cx={p.x} cy={p.y} r={PULLEY} className="dt-pulley" />
                <circle cx={p.x} cy={p.y} r={2} className="dt-hub" />
              </g>
            ))}
          </>
        )}
        {/* chain */}
        {paths.map((d, i) => (
          <path key={i} d={d} className="dt-chain" />
        ))}
        {/* crank spindle + rear axle */}
        <circle cx={F.x} cy={F.y} r={3} className="dt-hub" />
        <circle cx={R.x} cy={R.y} r={3} className="dt-hub" />
        <text x={F.x} y={-rf - 3} className="dt-label" textAnchor="middle">
          {props.activeChainring}T
        </text>
        <text x={R.x} y={-rr - 3} className="dt-label" textAnchor="middle">
          {props.activeCog}T
        </text>
      </svg>
      <div className="dt-cap">
        {props.activeChainring} × {props.activeCog} · ratio {(props.activeChainring / props.activeCog).toFixed(2)}
      </div>
    </div>
  );
}
