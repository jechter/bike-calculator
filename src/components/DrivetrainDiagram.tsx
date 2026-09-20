// Schematic side view of the drivetrain, in real mm (chain pitch 12.7 mm), then
// scaled to fit. Chainring(s) up front and cassette cogs at the rear, spaced by
// the chainstay length, with the chain over the active gear. For a derailleur
// setup a rear derailleur is simulated: the tension pulley swings on its cage so
// the total chain length stays constant as the gear changes.

import { useEffect, useRef, useState } from "react";
import { PALETTE } from "./GearChart";

const PITCH = 12.7; // chain pitch, mm (½")
const BELT_PITCH = 11; // Gates Carbon Drive pitch, mm
// Pitch radius, mm. Both a chain sprocket and a belt pulley follow N·pitch/π; a
// belt's smaller pitch makes its sprockets ~13% smaller than a chain's for the
// same tooth count — see the belt-aware `pr` inside the component.
const prAt = (teeth: number, pitch: number) => (teeth * pitch) / (2 * Math.PI);
const pr = (teeth: number) => prAt(teeth, PITCH); // chain radius (module scope)
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

// Outline (stadium) around the segment p0->p1 with radius r: two parallel edges
// capped by semicircles. Used for the hollow crank arms.
function capsule(p0: V, p1: V, r: number): string {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * r;
  const ny = (dx / len) * r;
  const a = { x: p0.x + nx, y: p0.y + ny };
  const b = { x: p1.x + nx, y: p1.y + ny };
  const c = { x: p1.x - nx, y: p1.y - ny };
  const d = { x: p0.x - nx, y: p0.y - ny };
  // Sweep 0 so each end cap bulges outward (past the endpoint), not back over
  // the arm — the rounded corner sits outside the pedal hole.
  return `M ${pt(a)} L ${pt(b)} A ${r} ${r} 0 0 0 ${pt(c)} L ${pt(d)} A ${r} ${r} 0 0 0 ${pt(a)} Z`;
}

// Playback-control icons (inherit currentColor). Pause = two bars, Play = a
// triangle, Slow motion = a play triangle beside a little clock (play + time).
const PAUSE_ICON = (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <rect x="4" y="3.5" width="3" height="9" rx="1" fill="currentColor" />
    <rect x="9" y="3.5" width="3" height="9" rx="1" fill="currentColor" />
  </svg>
);
const PLAY_ICON = (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M5 3.5 L12.5 8 L5 12.5 Z" fill="currentColor" />
  </svg>
);
const SLOW_ICON = (
  <svg viewBox="0 0 20 16" width="17" height="14" aria-hidden="true">
    <path d="M2 3 L9 8 L2 13 Z" fill="currentColor" />
    <circle cx="14" cy="8" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M14 8 V5 M14 8 L16 9.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export interface DrivetrainDiagramProps {
  chainrings: number[];
  cogs: number[];
  activeChainring: number;
  activeCog: number;
  chainstayMm: number;
  hasDerailleur: boolean;
  /** A Gates carbon belt rather than a chain: smaller (11 mm) pitch, so the
   *  sprockets are drawn ~13% smaller for the same tooth count, and the loop is
   *  rendered as a belt. Only meaningful without a derailleur. */
  isBelt?: boolean;
  cadenceRpm: number;
  speed: number; // active gear's speed in the display unit
  speedUnit: string;
  wheelCircMm: number; // rolling circumference -> rear wheel size
  /** Internally-geared-hub ratio for the active gear (1 == direct drive). The
   *  chainring/cog don't change between hub gears, so the hub ratio is what makes
   *  the wheel spin faster/slower and shifts the effective ratio. */
  hubRatio?: number;
  /** Active hub gear's name (e.g. "3rd"), shown in the caption when present. */
  hubLabel?: string;
  /** True when the gearing sits between the crank and the chainring (a
   *  bottom-bracket gearbox). The crank then turns at the pedalling cadence
   *  while the chainring turns at cadence × the active gear's ratio; otherwise
   *  crank and chainring are rigidly linked and turn together. */
  isGearbox?: boolean;
  /** Start/stop shifting in a direction (-1 down / +1 up). Held down, a stepped
   *  drivetrain repeats and a CVT sweeps continuously. Drives the ‹ / › buttons;
   *  the parent also wires ←/→ to the same handlers. */
  onShiftStart?: (dir: -1 | 1) => void;
  onShiftStop?: () => void;
  canShiftDown?: boolean;
  canShiftUp?: boolean;
}

export function DrivetrainDiagram(props: DrivetrainDiagramProps) {
  const { chainstayMm, hasDerailleur } = props;

  // Belts run at an 11 mm pitch (vs a chain's 12.7 mm), so their sprockets are
  // smaller for the same tooth count. Shadow the module-level `pr` so every
  // sprocket radius below reflects the actual transmission. (A belt never has a
  // derailleur, so the chain-pitch PULLEY constant stays fine.)
  const isBelt = !!props.isBelt && !hasDerailleur;
  const pr = (teeth: number) => prAt(teeth, isBelt ? BELT_PITCH : PITCH);
  const rings = [...new Set(props.chainrings)].filter((n) => n > 0).sort((a, b) => b - a);
  const cs = [...new Set(props.cogs)].filter((n) => n > 0).sort((a, b) => b - a);
  // Bail before any drawing when there's nothing to draw (e.g. the user clears
  // the chainrings field to retype it). This must sit above every hook below so
  // the hook count stays constant across renders — an early return between
  // hooks is what "rendered fewer hooks than expected" means.
  const empty = rings.length === 0 || cs.length === 0;

  // Measure the rendered box so the viewBox can grow vertically to fill a tall
  // container (e.g. the drivetrain workbench rail) instead of letterboxing —
  // revealing more of the wheel and crank, which are drawn but normally culled.
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setBox({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    // A sprocket also swallows ~half its circumference of chain (the teeth/2·pitch
    // term in every chain-length formula, = pi·r). Counting the chainring's wrap
    // means a bigger ring eats more chain, so the cage swings forward to give it
    // up — matching reality. (The cog's contribution is already carried by the
    // guide pulley tracking the cog, so only the ring's wrap is added here.) The
    // full pi·r would run the cage to its stops on a 2× jump; RING_WRAP scales it
    // to a believable lean that leaves room for the per-cog motion on top.
    const RING_WRAP = 0.5;
    const Ltarget =
      extTanLen(F, refRing, R, refCog) +
      intTanLen(R, refCog, GRef, PULLEY) +
      GT +
      extTanLen(TRef, PULLEY, F, refRing) +
      RING_WRAP * Math.PI * refRing;

    // Solve the tension pulley so the length stays Ltarget.
    const need =
      Ltarget - extTanLen(F, rf, R, rr) - intTanLen(R, rr, G, PULLEY) - GT - RING_WRAP * Math.PI * rf;
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
  // Rear wheel drawn to scale from the rolling circumference.
  const wheelR = props.wheelCircMm > 0 ? props.wheelCircMm / (2 * Math.PI) : 0;
  const tireW = Math.max(10, wheelR * 0.05);

  // The viewBox stays focused on the drivetrain; the to-scale wheel is much
  // larger and is deliberately culled by the SVG viewport, showing only as a
  // faint arc + spoke stubs in the background.
  const topExtent = Math.max(rfMax, rrMax);
  const derailBottom = rrMax + 8 + PULLEY + CAGE + PULLEY;
  // Crank arms at true length (170 mm) and 40 mm wide (a modern Ultegra arm),
  // drawn as a hollow outline with a pedal eye at each tip. The viewBox is
  // widened horizontally to fit the crank's reach (the diagram uses the full
  // page width), but stays vertically tight — so as the crank sweeps it's only
  // clipped top and bottom, like the wheel.
  const crankLen = 170; // mm, a real crank arm
  const crankHalfW = 20; // arm half-thickness (40 mm wide)
  const pedalR = 7;
  const crankReachX = crankLen + crankHalfW; // horizontal extent of the crank
  const m = 10;
  const minX = Math.min(-rfMax, -crankReachX) - m;
  // Size the horizontal extent for the LONGEST chainstay the slider allows
  // (500 mm), not the current one, so the viewBox — and therefore the diagram's
  // rendered height — stays put as you drag the chainstay. The rear wheel is
  // still drawn at the actual chainstay, so it simply slides within a fixed
  // frame (which is what changing the chainstay physically does).
  const LAYOUT_CHAINSTAY = 500;
  const layoutRx = Math.max(LAYOUT_CHAINSTAY, chainstayMm);
  const maxX = Math.max(layoutRx + rrMax + PULLEY, crankReachX) + m;
  const minY = -topExtent - m - 10; // room for labels
  // Bottom must clear the lowest of: chainring, cog, and (if present) the
  // derailleur's downward reach — otherwise a big chainring gets culled in
  // single-speed/hub mode where there's no derailleur to extend the bounds.
  // A little extra room (~the height of the caption/shift bar, which floats over
  // the diagram) so those controls sit below the drivetrain rather than on it.
  const captionRoom = (maxX - minX) * 0.07;
  const maxY = Math.max(rfMax, rrMax, hasDerailleur ? derailBottom : 0) + m + captionRoom;
  const W = maxX - minX;
  const H = maxY - minY;

  // If the container is taller than the drivetrain's natural aspect, stretch the
  // viewBox vertically (centred) to match — the wheel/crank fill the extra space
  // instead of the diagram letterboxing. `minHeight` keeps it at least its
  // natural, width-driven size when there's no spare height (it shrinks-to-fit
  // rather than scrolling only when even that doesn't fit). VPAD = 2 × card pad.
  const VPAD = 24;
  let vbMinY = minY;
  let vbH = H;
  let naturalMinHeight: number | undefined;
  if (box && box.w > 0 && box.h > 0) {
    naturalMinHeight = (box.w * H) / W + VPAD;
    const target = (box.h / box.w) * W;
    if (target > H) {
      vbMinY = minY - (target - H) / 2;
      vbH = target;
    }
  }

  // Subtle spokes spin at the cadence (chainring) and cadence × ratio (rear),
  // showing how much faster the wheel turns in the current gear. Counter-clockwise.
  const rpm = Math.max(20, Math.min(220, props.cadenceRpm || 90));
  // Effective ratio includes the hub ratio (1 for cassette/single-speed), so the
  // rear wheel spins at the right speed for the selected hub gear.
  const ratio = (props.activeChainring / props.activeCog) * (props.hubRatio ?? 1);
  // Playback mode: paused, slow-mo (default), or real-time play. Slo-mo stretches
  // every period by the same factor, so the wheel/crank slow down together
  // (relative speeds preserved) enough to actually watch them turn instead of
  // strobing — a fast gear can otherwise reach ~10 rev/s.
  const [playMode, setPlayMode] = useState<"paused" | "slow" | "play">("slow");
  const slow = playMode === "slow" ? 10 : 1;
  const period = (60 / rpm) * slow;
  const cogPeriod = Math.max(0.1, 60 / (rpm * ratio)) * slow;
  // The crank always turns at the pedalling cadence. The chainring turns with it,
  // except on a bottom-bracket gearbox where the gearbox sits between them — the
  // ring then turns at cadence × the active gear's ratio (its hub ratio).
  const isGearbox = !!props.isGearbox;
  const crankPeriod = period;
  const chainringRpm = isGearbox ? rpm * (props.hubRatio ?? 1) : rpm;
  const chainringPeriod = Math.max(0.05, 60 / chainringRpm) * slow;
  const reduceMotion =
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  // Wide outlined spoke "blades" (rounded bars) from rInner to rOuter, evenly
  // spaced — used for the crank spider and the three-spoke rear wheel. offsetDeg
  // rotates the whole set (the spider sits 45° off the crank arm).
  const blades = (
    cx: number,
    cy: number,
    rInner: number,
    rOuter: number,
    count: number,
    w: number,
    cls: string,
    offsetDeg = 0,
  ) =>
    Array.from({ length: count }, (_, i) => (
      <rect
        key={i}
        x={cx + rInner}
        y={cy - w / 2}
        width={rOuter - rInner}
        height={w}
        rx={w / 2}
        transform={`rotate(${(360 * i) / count + offsetDeg} ${cx} ${cy})`}
        className={cls}
      />
    ));

  // Rotation is driven imperatively with a requestAnimationFrame loop that sets
  // each group's SVG `rotate(angle cx cy)` transform. This rotates about an
  // explicit point (the hub / bottom bracket) in user coordinates, which every
  // engine handles the same way — unlike CSS transform-box/transform-origin,
  // which can pivot off-centre. Each part keeps a running angle, so a gear or
  // slo-mo change only alters its angular velocity: the crank and wheels keep
  // their current angle instead of jumping back to the start.
  const wheelRef = useRef<SVGGElement>(null);
  const spiderRef = useRef<SVGGElement>(null);
  const crankRef = useRef<SVGGElement>(null);
  // Live rotation state (angle in degrees, velocity in deg/s, pivot in user
  // units); mutated in place so the rAF loop always sees the latest values.
  const spin = useRef([
    { ref: wheelRef, angle: 0, vel: 0, cx: 0, cy: 0 },
    { ref: spiderRef, angle: 0, vel: 0, cx: 0, cy: 0 },
    { ref: crankRef, angle: 0, vel: 0, cx: 0, cy: 0 },
  ]);
  // Refresh velocities/pivots each render (CCW = negative). Angles are left
  // untouched so speed changes never restart the spin.
  const [w, s, c] = spin.current;
  const stopped = reduceMotion || playMode === "paused";
  w.vel = stopped ? 0 : -360 / cogPeriod;
  w.cx = R.x;
  w.cy = R.y;
  s.vel = stopped ? 0 : -360 / chainringPeriod;
  s.cx = F.x;
  s.cy = F.y;
  c.vel = stopped ? 0 : -360 / crankPeriod;
  c.cx = F.x;
  c.cy = F.y;
  useEffect(() => {
    let raf = 0;
    let last: number | null = null;
    const tick = (t: number) => {
      if (last != null) {
        const dt = (t - last) / 1000;
        for (const p of spin.current) {
          p.angle += p.vel * dt;
          p.ref.current?.setAttribute("transform", `rotate(${p.angle} ${p.cx} ${p.cy})`);
        }
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Selected-gear colour matches the chainring's line in the gear chart.
  const activeColor = PALETTE[Math.max(0, rings.indexOf(props.activeChainring)) % PALETTE.length];

  // Nothing to draw (no valid gears) — keep the measured container so the
  // ResizeObserver stays attached, but skip the drivetrain itself.
  if (empty) return <div className="dt-diagram" ref={containerRef} />;

  return (
    <div
      className="dt-diagram"
      ref={containerRef}
      style={naturalMinHeight ? { minHeight: naturalMinHeight } : undefined}
    >
      {!reduceMotion &&
        (() => {
          const modes = [
            ["paused", "Paused", PAUSE_ICON],
            ["slow", "10x Slo-Mo", SLOW_ICON],
            ["play", "Realtime", PLAY_ICON],
          ] as const;
          const activeLabel = modes.find(([val]) => val === playMode)?.[1];
          return (
            <div className="dt-playmode">
              <div className="dt-playmode-label">{activeLabel}</div>
              <div className="dt-playmode-group" role="radiogroup" aria-label="Animation playback">
                {modes.map(([val, label, icon]) => (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={playMode === val}
                    aria-label={label}
                    title={label}
                    className={"dt-playmode-btn" + (playMode === val ? " active" : "")}
                    onClick={() => setPlayMode(val)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      <svg
        viewBox={`${minX} ${vbMinY} ${W} ${vbH}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Drivetrain view"
      >
        {/* Mirror the whole drawing so the rear wheel sits on the left and the
            crank on the right — how a drivetrain reads when viewed from the
            front of the bike. This flips positions and spin direction together
            (like viewing from the other side); the text labels are drawn
            outside this group so they stay readable, with their x mirrored by
            hand. */}
        <g transform={`translate(${minX + maxX} 0) scale(-1 1)`}>
        {/* rear wheel to scale (rolling circumference), spinning at wheel speed */}
        {wheelR > 0 && (
          <g ref={wheelRef}>
            <circle cx={R.x} cy={R.y} r={wheelR - tireW / 2} className="dt-tire" style={{ strokeWidth: tireW }} />
            <circle cx={R.x} cy={R.y} r={wheelR - tireW} className="dt-rim" />
            {/* three-spoke design so the spin is legible */}
            {blades(R.x, R.y, rrMax + 8, wheelR - tireW, 3, 18, "dt-wheel-spoke")}
            {/* tyre valve: a stem on the rim (pointing at the hub) with a nut at
                its base — an asymmetric marker that makes the wheel's rotation
                easy to follow. Resting at 9 o'clock keeps it in the visible
                left arc when motion is reduced. */}
            {(() => {
              const rimBed = wheelR - tireW;
              const valveLen = Math.min(60, wheelR * 0.18);
              const base = onCircle(R, rimBed, Math.PI);
              const tip = onCircle(R, rimBed - valveLen, Math.PI);
              return (
                <>
                  <path d={capsule(base, tip, 3.5)} className="dt-valve" />
                  <circle cx={base.x} cy={base.y} r={6} className="dt-valve" />
                </>
              );
            })()}
          </g>
        )}
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
        {/* crank spider arms (sized to the biggest ring), spinning at the ring's
            speed (CCW) — cadence normally, cadence × ratio on a gearbox. Four
            thick arms, set 45° off the crank arm so they read as a crankset. */}
        <g ref={spiderRef}>
          {blades(F.x, F.y, 4, rfMax - crankHalfW, 4, crankHalfW * 1.4, "dt-spider", 45)}
        </g>
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
        {/* chain (or belt) */}
        {paths.map((d, i) => (
          <path key={i} d={d} className={isBelt ? "dt-belt" : "dt-chain"} />
        ))}
        {/* crankset: a single outlined crank arm out to the pedal, drawn in
            front of the chainrings and turning at the pedalling cadence — on a
            gearbox that's independent of the geared chainring. */}
        <g ref={crankRef}>
          {/* a single crank arm from the bottom bracket out to the pedal */}
          <path d={capsule(F, { x: F.x + crankLen, y: F.y }, crankHalfW)} className="dt-crank" />
          <circle cx={F.x + crankLen} cy={F.y} r={pedalR} className="dt-crank-pedal" />
        </g>
        {/* crank spindle + rear axle */}
        <circle cx={F.x} cy={F.y} r={3} className="dt-hub" />
        <circle cx={R.x} cy={R.y} r={3} className="dt-hub" />
        </g>
        {/* labels above the largest gear so they clear all the sprocket circles;
            drawn outside the mirror group with their x mirrored so the text
            reads normally over each (now flipped) gear */}
        <text x={minX + maxX - F.x} y={-rfMax - 4} className="dt-label" textAnchor="middle">
          {props.activeChainring}T
        </text>
        <text x={minX + maxX - R.x} y={-rrMax - 4} className="dt-label" textAnchor="middle">
          {props.activeCog}T
        </text>
      </svg>
      <div className="dt-shift">
        <button
          type="button"
          className="dt-shift-btn"
          onPointerDown={() => props.onShiftStart?.(-1)}
          disabled={!props.canShiftDown}
          aria-label="Shift to a lower gear"
          title="Shift down (←) — hold to keep shifting"
        >
          ‹
        </button>
        <div className="dt-cap">
          {props.activeChainring} × {props.activeCog}
          {props.hubLabel ? ` · ${props.hubLabel}` : ""} · ratio {ratio.toFixed(2)} · {rpm} rpm ·{" "}
          {props.speed.toFixed(1)} {props.speedUnit}
        </div>
        <button
          type="button"
          className="dt-shift-btn"
          onPointerDown={() => props.onShiftStart?.(1)}
          disabled={!props.canShiftUp}
          aria-label="Shift to a higher gear"
          title="Shift up (→) — hold to keep shifting"
        >
          ›
        </button>
      </div>
    </div>
  );
}
