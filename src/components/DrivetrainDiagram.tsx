// Schematic side view of the drivetrain, in real mm (chain pitch 12.7 mm), then
// scaled to fit. Chainring(s) up front and cassette cogs at the rear, spaced by
// the chainstay length, with the chain over the active gear. For a derailleur
// setup a rear derailleur is simulated: the tension pulley swings on its cage so
// the total chain length stays constant as the gear changes.

const PITCH = 12.7; // chain pitch, mm
const pr = (teeth: number) => (teeth * PITCH) / (2 * Math.PI); // pitch radius, mm
const PULLEY = pr(11); // ~11T jockey wheels
const CAGE = 70; // guide->tension pulley spacing, mm

type V = { x: number; y: number };
const onCircle = (c: V, r: number, ang: number): V => ({ x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) });
// External-tangent touch points between two circles (chain wraps both the same
// way, so all segments use the same side s = -1). Returns border-to-border points.
function extTan(A: V, rA: number, B: V, rB: number, s: number): { a: V; b: V } {
  const beta = Math.atan2(B.y - A.y, B.x - A.x);
  const d = Math.hypot(B.x - A.x, B.y - A.y);
  const g = Math.acos(Math.max(-1, Math.min(1, (rA - rB) / d)));
  const phi = beta + s * g;
  return { a: onCircle(A, rA, phi), b: onCircle(B, rB, phi) };
}
const tanLen = (c1: V, r1: number, c2: V, r2: number) => {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
  return Math.sqrt(Math.max(0, d * d - (r1 - r2) ** 2));
};
// Lower intersection point of two circles (larger y), or null.
function circInt(c0: V, r0: number, c1: V, r1: number): V | null {
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
  const p1 = { x: xm + ox, y: ym + oy };
  const p2 = { x: xm - ox, y: ym - oy };
  return p1.y > p2.y ? p1 : p2;
}
// Clockwise (screen y-down) arc command from a to b on circle (c, r).
function arc(c: V, r: number, a: V, b: V): string {
  const aa = Math.atan2(a.y - c.y, a.x - c.x);
  const ab = Math.atan2(b.y - c.y, b.x - c.x);
  let span = ab - aa;
  while (span < 0) span += 2 * Math.PI;
  const large = span > Math.PI ? 1 : 0;
  return `A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
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
    const G: V = { x: R.x, y: R.y + rr + 6 + PULLEY };
    // Reference chain length: a middle gear with the cage hanging straight down,
    // so bigger cogs retract the cage and smaller cogs extend it symmetrically.
    const refRing = pr(rings[Math.floor(rings.length / 2)]);
    const refCog = pr(cs[Math.floor(cs.length / 2)]);
    const GRef: V = { x: R.x, y: R.y + refCog + 6 + PULLEY };
    const TRef: V = { x: GRef.x, y: GRef.y + CAGE };
    const Ltarget =
      tanLen(F, refRing, R, refCog) + tanLen(R, refCog, GRef, PULLEY) + CAGE + tanLen(TRef, PULLEY, F, refRing);

    // Solve the tension pulley so the length stays Ltarget.
    const need = Ltarget - tanLen(F, rf, R, rr) - tanLen(R, rr, G, PULLEY) - CAGE;
    let TF = Math.sqrt(Math.max(0, need * need + (PULLEY - rf) ** 2));
    const FG = Math.hypot(G.x - F.x, G.y - F.y);
    TF = Math.max(FG - CAGE + 1, Math.min(FG + CAGE - 1, TF));
    const T = circInt(G, CAGE, F, TF) ?? { x: G.x, y: G.y + CAGE };
    pulleys.push(G, T);

    // Chain routed border-to-border via external tangents around every circle:
    // chainring -> cog -> guide pulley -> tension pulley -> chainring.
    const s = -1;
    const fr = extTan(F, rf, R, rr, s);
    const rg = extTan(R, rr, G, PULLEY, s);
    const gt = extTan(G, PULLEY, T, PULLEY, s);
    const tf = extTan(T, PULLEY, F, rf, s);
    paths.push(
      `M ${pt(fr.a)} L ${pt(fr.b)} ${arc(R, rr, fr.b, rg.a)} L ${pt(rg.b)} ` +
        `${arc(G, PULLEY, rg.b, gt.a)} L ${pt(gt.b)} ${arc(T, PULLEY, gt.b, tf.a)} L ${pt(tf.b)} ` +
        `${arc(F, rf, tf.b, fr.a)} Z`,
    );
  } else {
    // No derailleur (single speed / hub): a plain loop over the two gears.
    paths.push(
      `M ${pt(chainTop)} L ${pt(cogTop)} A ${rr} ${rr} 0 0 1 ${pt(cogBot)} ` +
        `L ${pt(chainBot)} A ${rf} ${rf} 0 1 1 ${pt(chainTop)} Z`,
    );
  }

  // Bounds -> viewBox (mm), with a margin.
  const xs = [F.x - rf, R.x + rr, ...pulleys.map((p) => p.x + PULLEY)];
  const ys = [-Math.max(rf, rr), ...pulleys.map((p) => p.y + PULLEY), Math.max(rf, rr)];
  const m = 8;
  const minX = Math.min(...xs) - m;
  const maxX = Math.max(...xs) + m;
  const minY = Math.min(...ys) - m - 8; // room for labels
  const maxY = Math.max(...ys) + m;
  const W = maxX - minX;
  const H = maxY - minY;

  return (
    <div className="dt-diagram">
      <svg viewBox={`${minX} ${minY} ${W} ${H}`} width="100%" role="img" aria-label="Drivetrain view">
        {/* cassette cogs */}
        {cs.map((c) => (
          <circle key={"c" + c} cx={R.x} cy={R.y} r={pr(c)} className={c === props.activeCog ? "dt-gear-active" : "dt-gear"} />
        ))}
        {/* chainrings */}
        {rings.map((r) => (
          <circle key={"r" + r} cx={F.x} cy={F.y} r={pr(r)} className={r === props.activeChainring ? "dt-gear-active" : "dt-gear"} />
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
        {hasDerailleur && " · chain length held constant by the derailleur"}
      </div>
    </div>
  );
}
