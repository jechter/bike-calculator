// Schematic side view of a diamond frame, drawn to scale from the fit targets.
// Stack (blue) rises from the bottom bracket; reach (red) runs forward to the
// head-tube top. The top tube meets the head tube ~1 cm below its top (as real
// frames do); the head tube then runs DOWN to a roughly fixed fork-crown height,
// so a higher-stack (more relaxed) frame is drawn with a longer head tube — not
// with head tube stacked above the top tube. From the top-tube junction, two
// seat-tube lengths are shown in two shades of green: the ACTUAL seat tube (dark,
// to the real sloping top tube) and the EFFECTIVE / virtual seat tube (light, to
// a horizontal top tube). A frame's marketing "size" sits between the two.
//
// To the left, a traced line-art cyclist (front view) is drawn to scale on the
// same ground line, with dimension lines for the three body inputs — body height
// (blue), cycling inseam (green) and arm length (amber) — so the measurements
// driving the fit are shown.

import { useId } from "react";
import type { CockpitSpec } from "../lib/frameSize";
import {
  CYCLIST_BODY_PATHS,
  CYCLIST_ARM_PATHS,
  CYCLIST_INNER_TRANSFORM,
  CYCLIST_VIEW,
  CYCLIST_LANDMARKS,
} from "./cyclistFigure";

// Arm-length fraction of stature at which the arms are drawn undistorted; the
// forearms scale relative to this so a typical rider renders as traced.
const ARM_REF_FRAC = 0.331;

const SA = (73 * Math.PI) / 180; // seat-tube angle
const HA = (72 * Math.PI) / 180; // head-tube angle
const COS = Math.cos(SA);
const SIN = Math.sin(SA);

const DEFAULT_WHEEL_R = 350; // ~700c with tyre, mm — used when no wheel is given
// The frame dimensions that depend on the wheel scale WITH the wheel radius, tuned
// so a 700c wheel (R = 350) reproduces the original numbers. Without this a small
// (kids') wheel gets a big-wheel fork and chainstay drawn around it — the fork
// crown floats above the tyre, and the head tube can even invert when the stack
// falls below the fixed crown height.
const WHEEL_R_REF = 350; // 700c reference radius
const BB_DROP_RATIO = 0.2; // BB below the axle line, as a fraction of wheel R (70/350)
const REAR_CLEARANCE = 80; // gap from the rear tyre back to the BB axis (chainstay = R + this)
const SUSP_FORK_EXTRA = 80; // a suspension fork raises the crown this far above the tyre top
const FORK_OFFSET_REF = 45; // fork rake at 700c
const HEAD_STUB_MM = 14; // head tube + headset above the top-tube junction (~1 cm)
const CRANK_ANGLE = (32 * Math.PI) / 180; // crank arm, forward of straight-down
const PEDAL_HALF = 30; // half-length of the drawn pedal, mm
// A limb is flagged as over-extended once its contact point sits past this
// fraction of its full (bone-to-bone) length — a small margin over 1.0 so a
// normally near-straight cycling leg isn't flagged.
const OVEREXT = 1.04;
// The saddle can't drop below the seat cluster: at least this much post shows
// above the actual seat tube, so a frame too tall for the rider forces the
// saddle (and the rider's hips) up until the leg over-reaches the pedal.
const MIN_POST_ABOVE = 60;

// The traced cyclist is scaled so its ink height = the rider's body height and
// its feet sit on the ground line, a fixed gap left of the rear wheel.
const PERSON_GAP = 560; // gap from the rear wheel to the rider, mm

export interface FrameGeometryDiagramProps {
  reachMm: number;
  stackMm: number;
  /** Top-tube slope (degrees below horizontal): 0 = level, bigger = more compact. */
  topTubeSlopeDeg: number;
  /** Geometry style — 'suspension' uses a longer fork so the head tube is short. */
  geometry: 'classic' | 'sloping' | 'suspension';
  /** Saddle height (BB → saddle top) along the seat tube, mm. */
  saddleHeightMm: number;
  /** Suggested crank length, mm — drawn as a crank arm + pedal from the BB. */
  crankLengthMm: number;
  /** Rider body height, mm — sets the scale of the rider figure. */
  bodyHeightMm: number;
  /** Cycling inseam, mm — the crotch height on the rider figure. */
  inseamMm: number;
  /** Arm length, mm — shoulder-to-wrist on the rider figure. */
  armLengthMm: number;
  /** Resolved cockpit (stem + spacers + bar) for the seated riding position. */
  cockpit: CockpitSpec;
  /** Outer wheel radius (mm), so the wheels are drawn to the chosen size. */
  wheelRadiusMm?: number;
  /** Wheel-size name (e.g. "700c", "29\"") labelled on the front wheel. */
  wheelLabel?: string;
  /** Which measurement to emphasise (hovered/edited in the UI), if any. */
  highlight?: HighlightKey | null;
  /** Seated posture: 0 = arms fully straight, 1 = forearm parallel to the ground. */
  posture: number;
  /**
   * The bars sit farther forward than the rider should reach (frame + stem too
   * long) — judged by the caller against the rider's target reach. Draws the arms
   * in warning red.
   */
  armOver?: boolean;
}

export type HighlightKey =
  | "reach" | "stack" | "size" | "crank" | "body" | "inseam" | "arm" | "wheel"
  | "stem" | "spacer";

type P = { x: number; y: number };
// Bike space has y up; SVG has y down, so flip as we place points.
const flip = (p: P): P => ({ x: p.x, y: -p.y });
const onSeat = (len: number): P => ({ x: -len * COS, y: len * SIN });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const vadd = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const vsub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const vscale = (a: P, s: number): P => ({ x: a.x * s, y: a.y * s });
const vlen = (a: P): number => Math.hypot(a.x, a.y);
const vnorm = (a: P): P => vscale(a, 1 / (vlen(a) || 1));

// Two-bone IK: joint J with |A→J|=l1, |J→B|=l2, bending to the side `bend`
// (+1/−1). If A and B are too far apart the limb straightens.
function ik2(a: P, b: P, l1: number, l2: number, bend: number): P {
  const d = vlen(vsub(b, a));
  const u = vnorm(vsub(b, a));
  if (d >= l1 + l2) return vadd(a, vscale(u, (l1 / (l1 + l2)) * d));
  const a1 = (d * d + l1 * l1 - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a1 * a1));
  const base = vadd(a, vscale(u, a1));
  return vadd(base, vscale({ x: -u.y, y: u.x }, h * bend));
}

// Hand positions (offset fwd/drop from the bar clamp), from most upright to most
// aggressive. Drop bars: tops → hoods → drops. TT: base bar → aero extensions.
// Flats have a single position. Drop is +down.
function handOffsets(c: CockpitSpec): Array<{ fwd: number; drop: number }> {
  const f = c.gripFwdMm;
  const d = c.gripDropMm;
  if (c.bar === "drop")
    return [
      { fwd: f - 80, drop: d - 14 }, // tops (near the clamp, higher)
      { fwd: f, drop: d }, // hoods
      { fwd: f - 6, drop: d + 120 }, // drops (a touch back, much lower)
    ];
  if (c.bar === "aero")
    return [
      { fwd: f - 105, drop: d - 6 }, // base bar / brake levers (more upright)
      { fwd: f, drop: d }, // aero extensions
    ];
  return [{ fwd: f, drop: d }]; // flat: one hand position
}

export function FrameGeometryDiagram(props: FrameGeometryDiagramProps) {
  const {
    reachMm,
    stackMm,
    topTubeSlopeDeg,
    geometry,
    saddleHeightMm,
    crankLengthMm,
    bodyHeightMm,
    inseamMm,
    armLengthMm,
    cockpit,
    wheelRadiusMm,
    wheelLabel,
    highlight,
    posture,
    armOver = false,
  } = props;

  const WHEEL_R = wheelRadiusMm ?? DEFAULT_WHEEL_R;
  // Wheel-dependent frame dimensions (see the ratio constants above).
  const BB_DROP = BB_DROP_RATIO * WHEEL_R;
  const CHAINSTAY = WHEEL_R + REAR_CLEARANCE;
  const FORK_OFFSET = FORK_OFFSET_REF * (WHEEL_R / WHEEL_R_REF);
  const clipId = useId();
  const hl = (k: HighlightKey) => highlight === k;
  const hlClass = (k: HighlightKey) => (highlight === k ? " fg-hl" : "");

  // --- bike-space geometry (y up) --------------------------------------------
  const BB = { x: 0, y: 0 };
  const headTop = { x: reachMm, y: stackMm };
  const stackCorner = { x: 0, y: stackMm };

  // The rigid fork crown sits at the tyre top (BB drop + wheel R above the BB); a
  // suspension fork raises it further, so the head tube can be short even with a
  // tall front end (mountain bikes). Both scale with the wheel, so a small wheel
  // gets a correspondingly short fork.
  const forkCrownY = BB_DROP + WHEEL_R + (geometry === 'suspension' ? SUSP_FORK_EXTRA : 0);

  // The top tube meets the head tube a fixed ~1 cm below the head-tube top.
  const stub = Math.min(HEAD_STUB_MM, Math.max(0, stackMm - forkCrownY - 20));
  const topTubeY = stackMm - stub; // height of the top-tube junction
  // Effective/virtual seat tube: a horizontal top tube at that height meets the
  // seat axis here.
  const jVirtual = onSeat(topTubeY / SIN);

  const kHead = stub / Math.sin(HA); // down the steering axis to the junction
  const jHead = {
    x: headTop.x + kHead * Math.cos(HA),
    y: topTubeY,
  };
  // Head tube runs down to the fork crown. With a rigid fork the crown height is
  // ~constant, so a higher stack ⇒ longer head tube; a suspension fork raises the
  // crown, keeping the head tube short.
  const kBottom = (stackMm - forkCrownY) / Math.sin(HA);
  const headBottom = {
    x: headTop.x + kBottom * Math.cos(HA),
    y: forkCrownY,
  };
  const frontAxle = {
    x: headBottom.x + ((headBottom.y - BB_DROP) * Math.cos(HA)) / Math.sin(HA) + FORK_OFFSET,
    y: BB_DROP,
  };
  const rearAxle = { x: -CHAINSTAY, y: BB_DROP };
  const groundY = BB_DROP - WHEEL_R;

  // Actual seat tube: the real (sloping) top tube runs from the junction down to
  // the seat axis; solve where it meets. slope 0 ⇒ meets at jVirtual.
  const tan = Math.tan((topTubeSlopeDeg * Math.PI) / 180);
  const actLen = (topTubeY - jHead.x * tan) / (SIN + COS * tan);
  const jActual = onSeat(actLen);

  // Effective saddle height: a frame too tall for the rider can't let the saddle
  // drop below its seat cluster (a minimum of post must show), so the saddle — and
  // the rider's hips — are forced up above the inseam-ideal height.
  const effSaddleMm = Math.max(saddleHeightMm, actLen + MIN_POST_ABOVE);
  const saddle = onSeat(effSaddleMm);

  // Crank arm: pivots at the BB, drawn to scale pointing down-and-forward, with
  // a short pedal across its end.
  const crankTip = {
    x: crankLengthMm * Math.sin(CRANK_ANGLE),
    y: -crankLengthMm * Math.cos(CRANK_ANGLE),
  };
  const pedalL = { x: crankTip.x - PEDAL_HALF, y: crankTip.y };
  const pedalR = { x: crankTip.x + PEDAL_HALF, y: crankTip.y };

  // --- seated rider posed on the bike (capsule limbs) ------------------------
  const HB = bodyHeightMm;
  const post = clamp(posture, 0, 1);
  // Handlebar: up the steerer by the spacers, along the stem to the clamp.
  const upSteer = { x: -Math.cos(HA), y: Math.sin(HA) };
  const barBottom = vadd({ x: reachMm, y: stackMm }, vscale(upSteer, cockpit.spacerMm));
  // Stem angle is the conventional spec — degrees from perpendicular to the
  // steerer — so its angle vs. the ground adds the head tube's rearward lean
  // (90° − head angle). A −18°-ish stem thus draws roughly level here.
  const stemGround = (cockpit.stemRiseDeg * Math.PI) / 180 + (Math.PI / 2 - HA);
  const barClamp = vadd(barBottom, { x: cockpit.stemLenMm * Math.cos(stemGround), y: cockpit.stemLenMm * Math.sin(stemGround) });
  // Hand positions on the bar (tops/hoods/drops, or base/extensions). You can't
  // grip between them, so the posture snaps to one — the more aggressive, the
  // lower/more-forward — dividing the slider into equal bands.
  const handPts = handOffsets(cockpit).map((o) => ({ x: barClamp.x + o.fwd, y: barClamp.y - o.drop }));
  const gi = Math.min(Math.floor(post * handPts.length), handPts.length - 1);
  const grip = handPts[gi];

  // Contact points: hips just above the saddle, feet on the two pedals (the far
  // crank is 180° opposite, up-and-back).
  const rHip = { x: saddle.x + 10, y: saddle.y + 42 };
  const crankTip2 = { x: -crankTip.x, y: -crankTip.y };
  const pedal2L = { x: crankTip2.x - PEDAL_HALF, y: crankTip2.y };
  const pedal2R = { x: crankTip2.x + PEDAL_HALF, y: crankTip2.y };
  const pedalAnkle = { x: crankTip.x - 14, y: crankTip.y + 52 };
  const rAnkle2 = { x: crankTip2.x - 12, y: crankTip2.y + 34 };
  const rToe2 = { x: crankTip2.x + 42, y: crankTip2.y + 2 };
  // Leg bones track the cycling inseam, not overall height: saddle height is set
  // from the inseam, so the pedalling leg must be too — otherwise a long- or
  // short-legged rider on the same height would over-extend or over-bend the knee.
  // The 1.045 keeps a normal build (inseam ≈ 0.47·height) at the old length.
  const legLen = inseamMm * 1.045;
  const thigh = 0.499 * legLen;
  const shank = 0.501 * legLen;
  // Near leg: if the pedal is farther than the leg can reach (a saddle forced too
  // high for this rider), draw the leg straight to full extension with a gap to the
  // pedal, and flag it, rather than stretching the shank to meet the pedal.
  const legSpan = thigh + shank;
  const legDir = vnorm(vsub(pedalAnkle, rHip));
  const legOver = vlen(vsub(pedalAnkle, rHip)) > legSpan * OVEREXT;
  const rAnkle = legOver ? vadd(rHip, vscale(legDir, legSpan)) : pedalAnkle;
  const rToe = { x: rAnkle.x + 60, y: rAnkle.y - 46 };
  const rKnee = legOver ? vadd(rHip, vscale(legDir, thigh)) : ik2(rHip, rAnkle, thigh, shank, +1);
  const rKnee2 = ik2(rHip, rAnkle2, thigh, shank, +1);

  // Posture (0 = arms fully straight, 1 = most aggressive): both keep the hips at
  // the saddle and the hands on the grip, so only the torso lean and elbow bend
  // change. We find the torso-lean for each extreme and interpolate; the elbow
  // then follows by IK. The aggressive extreme is forearm-parallel-to-the-ground,
  // OR a 120° elbow, whichever is reached first (some geometries can't reach a
  // level forearm without over-bending the elbow).
  const rTorso = Math.max(0, 0.818 * HB - inseamMm);
  const armLen = armLengthMm;
  const upperArm = 0.52 * armLen;
  const foreArm = 0.48 * armLen;
  const leanOf = (shoulder: P) => Math.atan2(shoulder.y - rHip.y, shoulder.x - rHip.x);
  // Straight arm: shoulder sits a full arm's length from the grip.
  const leanStraight = leanOf(ik2(rHip, grip, rTorso, armLen, +1));
  // Forearm level: the elbow is one forearm behind the grip, at the same height.
  const elbowLevel = { x: grip.x - foreArm, y: grip.y };
  const leanLevel = leanOf(ik2(rHip, elbowLevel, rTorso, upperArm, +1));
  // Elbow at 60°: the shoulder→grip chord for a 60° interior elbow angle
  // (cos 60° = ½), the most the elbow is allowed to bend.
  const chord60 = Math.sqrt(upperArm * upperArm + foreArm * foreArm - upperArm * foreArm);
  const leanElbow60 = leanOf(ik2(rHip, grip, rTorso, chord60, +1));
  // More aggressive = smaller lean; take whichever limit is reached first (the
  // larger lean), and never less aggressive than a straight arm.
  const leanAggr = Math.min(leanStraight, Math.max(leanLevel, leanElbow60));
  // The rider leans to reach the bars, so the arm itself doesn't run out of reach;
  // whether the bars are too far for a comfortable straight-arm reach is judged by
  // the caller (which knows the rider's target reach) and passed in as armOver.
  const lean = leanStraight + post * (leanAggr - leanStraight);
  const rShoulder = vadd(rHip, { x: rTorso * Math.cos(lean), y: rTorso * Math.sin(lean) });
  const rElbow = ik2(rShoulder, grip, upperArm, foreArm, -1);
  const rHeadR = 0.06 * HB;
  const leanDeg = (lean * 180) / Math.PI;
  const neckAng = (Math.min(leanDeg, 55) + 26) * (Math.PI / 180);
  const rHead = vadd(rShoulder, { x: 0.11 * HB * Math.cos(neckAng), y: 0.11 * HB * Math.sin(neckAng) });

  // --- rider figure (bike-space, y up) ---------------------------------------
  const H = bodyHeightMm;
  const personX = rearAxle.x - WHEEL_R - PERSON_GAP; // centre, left of the bike
  const gY = groundY; // feet on the ground line
  const figScale = H / (CYCLIST_VIEW.bottom - CYCLIST_VIEW.top); // horizontal scale
  const figLeft = personX - CYCLIST_VIEW.cx * figScale;
  const figRight = personX + (CYCLIST_VIEW.w - CYCLIST_VIEW.cx) * figScale;

  // Figure landmark rows (crop pixels, y down): feet, crotch, neck, shoulder, head.
  const figH = CYCLIST_VIEW.bottom - CYCLIST_VIEW.top;
  const footPy = CYCLIST_VIEW.bottom;
  const headPy = CYCLIST_VIEW.top;
  const crotchPy = CYCLIST_VIEW.bottom - CYCLIST_LANDMARKS.crotch * figH;
  const neckPy = CYCLIST_VIEW.bottom - CYCLIST_LANDMARKS.neck * figH;
  const shoulderPy = CYCLIST_VIEW.bottom - CYCLIST_LANDMARKS.shoulder * figH;

  // Reshape for inseam: the figure is split into three bands, scaled vertically
  // and independently — LEGS (feet→crotch) span the actual inseam, TORSO
  // (crotch→neck) takes up the slack, and the HEAD (neck→top) keeps its natural
  // size (uniform scale) so inseam only affects the legs and torso. Widths keep
  // the uniform scale throughout.
  const inseam = clamp(inseamMm, 0.3 * H, 0.62 * H);
  const headMm = (neckPy - headPy) * figScale; // fixed head height
  const torsoLen = Math.max(50, H - inseam - headMm);
  const sLo = inseam / (footPy - crotchPy); // legs
  const sTorso = torsoLen / (crotchPy - neckPy); // torso
  // Vertical position (bike-space y) of any figure row under the reshaping.
  const pyToBikeY = (py: number) =>
    py >= crotchPy
      ? gY + (footPy - py) * sLo
      : py >= neckPy
        ? gY + inseam + (crotchPy - py) * sTorso
        : gY + inseam + torsoLen + (neckPy - py) * figScale;

  const headTopY = pyToBikeY(headPy); // = gY + H
  const crotchY = pyToBikeY(crotchPy); // = gY + inseam
  const shoulderY = pyToBikeY(shoulderPy);
  // Arm length (input) runs down from the shoulder toward the drawn wrist.
  const wristY = clamp(shoulderY - armLengthMm, gY + 0.28 * H, shoulderY - 40);

  // Per-band group transforms (crop-pixel → SVG).
  const figTX = personX - CYCLIST_VIEW.cx * figScale;
  const bandTf = (scaleY: number, transY: number) =>
    `translate(${figTX.toFixed(2)} ${transY.toFixed(2)}) scale(${figScale.toFixed(4)} ${scaleY.toFixed(4)})`;
  const lowerTf = bandTf(sLo, -gY - footPy * sLo);
  const torsoTf = bandTf(sTorso, -gY - inseam - crotchPy * sTorso);
  const headTf = bandTf(figScale, -gY - inseam - torsoLen - neckPy * figScale);

  // Arms (bare forearms + hands) hang from the sleeve hem and scale vertically
  // about it by arm length, independent of the body reshaping.
  const armPivotPy = CYCLIST_VIEW.bottom - CYCLIST_LANDMARKS.armPivot * figH;
  const elbowY = pyToBikeY(armPivotPy); // sleeve-hem line, reshaped with the torso
  const armScale = clamp(armLengthMm / (ARM_REF_FRAC * H), 0.7, 1.4);
  const armVy = figScale * armScale; // vertical scale of the arm band
  const armTf = `translate(${figTX.toFixed(2)} ${(-elbowY - armPivotPy * armVy).toFixed(2)}) scale(${figScale.toFixed(4)} ${armVy.toFixed(4)})`;

  // Dimension lines: body height + inseam nested close together, clear of the
  // left edge (so the inseam label sits near its arrow); arm on the bike side.
  const inseamDimX = figLeft - 0.075 * H;
  const bodyDimX = figLeft - 0.11 * H;
  const armDimX = figRight + 0.04 * H;

  // --- SVG space (y flipped) -------------------------------------------------
  const s = {
    BB: flip(BB),
    saddle: flip(saddle),
    jVirtual: flip(jVirtual),
    jActual: flip(jActual),
    jHead: flip(jHead),
    headTop: flip(headTop),
    headBottom: flip(headBottom),
    frontAxle: flip(frontAxle),
    rearAxle: flip(rearAxle),
    stackCorner: flip(stackCorner),
    crankTip: flip(crankTip),
    pedalL: flip(pedalL),
    pedalR: flip(pedalR),
    crankTip2: flip(crankTip2),
    pedal2L: flip(pedal2L),
    pedal2R: flip(pedal2R),
    rAnkle2: flip(rAnkle2),
    rToe2: flip(rToe2),
    rKnee2: flip(rKnee2),
    barBottom: flip(barBottom),
    barClamp: flip(barClamp),
    grip: flip(grip),
    rHip: flip(rHip),
    rKnee: flip(rKnee),
    rAnkle: flip(rAnkle),
    rToe: flip(rToe),
    rShoulder: flip(rShoulder),
    rElbow: flip(rElbow),
    rHead: flip(rHead),
    handPts: handPts.map(flip),
  };

  // Handlebar profile. Drop bars are a smooth curve from the clamp (tops) forward
  // to the hoods and round into the drops; TT/flat bars are straight segments.
  const isDrop = cockpit.bar === "drop";
  const dropPath = (() => {
    if (!isDrop) return null;
    const c = s.barClamp;
    const h = s.handPts[1];
    const d = s.handPts[2];
    // reach: leave the clamp forward at bar-top height, then curve down to the
    // hoods. drop: bow forward off the hoods and hook down/back to the drops.
    return (
      `M ${c.x.toFixed(1)} ${c.y.toFixed(1)}` +
      ` Q ${h.x.toFixed(1)} ${c.y.toFixed(1)} ${h.x.toFixed(1)} ${h.y.toFixed(1)}` +
      ` Q ${(h.x + 38).toFixed(1)} ${((h.y + d.y) / 2).toFixed(1)} ${d.x.toFixed(1)} ${d.y.toFixed(1)}`
    );
  })();
  const barSegs: Array<[P, P]> = isDrop
    ? []
    : cockpit.bar === "aero"
      ? [
          [s.handPts[0], s.barClamp],
          [s.barClamp, s.handPts[1]],
        ]
      : [[s.barClamp, s.handPts[0]]];

  const bounds: P[] = [
    s.saddle,
    { x: s.headTop.x, y: s.headTop.y - 46 }, // reach label room
    { x: s.rearAxle.x - WHEEL_R, y: 0 },
    { x: s.frontAxle.x + WHEEL_R, y: 0 },
    { x: s.jVirtual.x - 40, y: 0 },
    { x: 0, y: -groundY },
    { x: s.crankTip.x + 210, y: s.crankTip.y }, // crank label room
    { x: bodyDimX - 200, y: -headTopY }, // rider labels + head top
    { x: personX, y: -headTopY },
    { x: s.rHead.x, y: s.rHead.y - rHeadR }, // seated rider head
    { x: s.grip.x, y: s.grip.y },
  ];
  const M = 34;
  const minX = Math.min(...bounds.map((p) => p.x)) - M;
  const maxX = Math.max(...bounds.map((p) => p.x)) + M;
  const minY = Math.min(...bounds.map((p) => p.y)) - M;
  const maxY = Math.max(...bounds.map((p) => p.y)) + M;
  const VW = maxX - minX;
  const VH = maxY - minY;

  const line = (a: P, b: P, cls: string) => (
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={cls} />
  );

  // A double-headed dimension segment drawn on the geometry itself. `emph`
  // adds a soft halo behind it (used to highlight the hovered measurement).
  const dim = (a: P, b: P, cls: string, emph = false) => {
    const A = 16;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L;
    const uy = dy / L;
    const px = -uy;
    const py = ux;
    const head = (tip: P, ox: number, oy: number) =>
      `${tip.x},${tip.y} ${tip.x - A * ox + A * 0.55 * px},${tip.y - A * oy + A * 0.55 * py} ` +
      `${tip.x - A * ox - A * 0.55 * px},${tip.y - A * oy - A * 0.55 * py}`;
    return (
      <g className={"fg-dim " + cls + (emph ? " fg-hl" : "")}>
        {emph && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="fg-dim-halo" />}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="fg-dim-seg" />
        <polygon points={head(a, -ux, -uy)} />
        <polygon points={head(b, ux, uy)} />
      </g>
    );
  };

  const effLen = topTubeY / SIN;
  const actualMid = flip(onSeat(actLen / 2));
  const effMid = flip(onSeat((actLen + effLen) / 2));

  // Rider figure helpers: a point in SVG space, an arm "tube", and a path-point
  // built from fractions of body height (half-width xf, height yf, about personX
  // on the ground line) for the smooth body outline.
  const pt = (x: number, y: number): P => flip({ x, y });
  const cm = (mm: number) => Math.round(mm / 10);

  return (
    <svg
      viewBox={`${minX} ${minY} ${VW} ${VH}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Frame geometry: stack rises from the bottom bracket and reach runs forward to the head-tube top; the actual seat tube (to the sloping top tube) and the effective/virtual seat tube (to a horizontal top tube) are shown in two shades of green; a crank arm drawn to the suggested length pivots at the bottom bracket. To the left, a front-view cyclist stands to scale with dimension lines for body height, cycling inseam and arm length. An approximate rider is also posed on the bike to show the riding position."
    >
      <line x1={minX} y1={-groundY} x2={maxX} y2={-groundY} className="fg-ground" />

      {/* traced line-art cyclist (front view), split into three bands scaled
          vertically and independently: legs (feet→crotch) span the inseam, torso
          (crotch→neck) takes the slack, and the head (neck→top) is unscaled. */}
      {(() => {
        const gSy = -gY; // ground
        const cSy = -(gY + inseam); // crotch split line
        const nSy = -(gY + inseam + torsoLen); // neck split line
        const hSy = -(gY + H); // head top
        const cx0 = figLeft - 30;
        const cw = figRight - figLeft + 60;
        const Fig = ({ tf, paths }: { tf: string; paths: string[] }) => (
          <g transform={tf}>
            <g transform={CYCLIST_INNER_TRANSFORM}>
              {paths.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          </g>
        );
        const band = (id: string, yTop: number, yBot: number) => (
          <clipPath id={id} clipPathUnits="userSpaceOnUse">
            <rect x={cx0} y={yTop - 1} width={cw} height={yBot - yTop + 2} />
          </clipPath>
        );
        return (
          <>
            <defs>
              {band(`${clipId}-lo`, cSy, gSy)}
              {band(`${clipId}-to`, nSy, cSy)}
              {band(`${clipId}-hd`, hSy, nSy)}
            </defs>
            <g className="fg-rider">
              <g clipPath={`url(#${clipId}-lo)`}>
                <Fig tf={lowerTf} paths={CYCLIST_BODY_PATHS} />
              </g>
              <g clipPath={`url(#${clipId}-to)`}>
                <Fig tf={torsoTf} paths={CYCLIST_BODY_PATHS} />
              </g>
              <g clipPath={`url(#${clipId}-hd)`}>
                <Fig tf={headTf} paths={CYCLIST_BODY_PATHS} />
              </g>
              {/* forearms + hands, scaled about the sleeve hem by arm length */}
              <Fig tf={armTf} paths={CYCLIST_ARM_PATHS} />
            </g>
          </>
        );
      })()}

      {/* dashed leaders from the body landmarks out to each dimension line */}
      {line(pt(personX, headTopY), pt(bodyDimX, headTopY), "fg-person-leader")}
      {line(pt(personX, crotchY), pt(inseamDimX, crotchY), "fg-person-leader")}
      {line(pt(figRight, shoulderY), pt(armDimX, shoulderY), "fg-person-leader")}
      {line(pt(figRight, wristY), pt(armDimX, wristY), "fg-person-leader")}

      {/* body-input dimensions: height (teal) + inseam (pink) nested on the left,
          arm length (amber) on the bike-facing side */}
      {dim(pt(bodyDimX, gY), pt(bodyDimX, headTopY), "fg-dim-body", hl("body"))}
      {dim(pt(inseamDimX, gY), pt(inseamDimX, crotchY), "fg-dim-inseam", hl("inseam"))}
      {dim(pt(armDimX, shoulderY), pt(armDimX, wristY), "fg-dim-arm", hl("arm"))}

      <text x={bodyDimX - 16} y={pt(0, gY + 0.74 * H).y} textAnchor="end" className={"fg-mlabel fg-note-body" + hlClass("body")}>
        Body height
        <tspan x={bodyDimX - 16} dy={40}>{cm(bodyHeightMm)} cm</tspan>
      </text>
      <text x={bodyDimX - 16} y={pt(0, gY + 0.2 * H).y} textAnchor="end" className={"fg-mlabel fg-note-inseam" + hlClass("inseam")}>
        Cycling inseam
        <tspan x={bodyDimX - 16} dy={40}>{cm(inseamMm)} cm</tspan>
      </text>
      <text
        x={armDimX + 14}
        y={pt(0, (shoulderY + wristY) / 2).y}
        className={"fg-mlabel fg-note-arm" + hlClass("arm")}
        dominantBaseline="middle"
      >
        Arm {cm(armLengthMm)} cm
      </text>

      {/* wheels, drawn to the chosen wheel size; front one labelled */}
      <circle cx={s.rearAxle.x} cy={s.rearAxle.y} r={WHEEL_R} className={"fg-wheel" + hlClass("wheel")} />
      <circle cx={s.frontAxle.x} cy={s.frontAxle.y} r={WHEEL_R} className={"fg-wheel" + hlClass("wheel")} />
      {wheelLabel && (
        <text
          x={s.frontAxle.x}
          y={s.frontAxle.y + WHEEL_R * 0.62}
          textAnchor="middle"
          className={"fg-mlabel fg-note-wheel" + hlClass("wheel")}
        >
          {wheelLabel}
        </text>
      )}

      {/* far-side crank + leg, drawn behind the frame and fainter for depth */}
      <g className="rp-far">
        {line(s.BB, s.crankTip2, "fg-crank")}
        {line(s.pedal2L, s.pedal2R, "fg-pedal")}
        {line(s.rHip, s.rKnee2, "rp-limb")}
        {line(s.rKnee2, s.rAnkle2, "rp-limb")}
        {line(s.rAnkle2, s.rToe2, "rp-foot")}
        <circle cx={s.rKnee2.x} cy={s.rKnee2.y} r={11} className="rp-joint" />
      </g>

      {/* rear triangle + fork (a suspension fork is drawn as stanchion + lowers) */}
      {line(s.BB, s.rearAxle, "fg-tube")}
      {line(s.rearAxle, s.jActual, "fg-tube")}
      {geometry === "suspension"
        ? (() => {
            const mid = {
              x: s.headBottom.x + (s.frontAxle.x - s.headBottom.x) * 0.42,
              y: s.headBottom.y + (s.frontAxle.y - s.headBottom.y) * 0.42,
            };
            return (
              <>
                {line(s.headBottom, mid, "fg-fork-stanchion")}
                {line(mid, s.frontAxle, "fg-fork-lowers")}
              </>
            );
          })()
        : line(s.headBottom, s.frontAxle, "fg-tube")}

      {/* main triangle: down tube, head tube (continues a little above the top-
          tube junction to the head-tube top), the actual sloping top tube, and
          the seat post above the virtual junction */}
      {line(s.BB, s.headBottom, "fg-tube")}
      {line(s.headBottom, s.headTop, "fg-tube fg-headtube")}
      {line(s.jHead, s.jActual, "fg-tt-actual")}
      {line(s.jVirtual, s.saddle, "fg-seatpost")}

      {/* dashed virtual top tube back from the head tube (the two green seat-tube
          length markers are drawn later, over the rider, so they stay visible) */}
      {line(s.jHead, s.jVirtual, "fg-virtual-tt")}

      {/* saddle */}
      <line
        x1={s.saddle.x - 34}
        y1={s.saddle.y}
        x2={s.saddle.x + 26}
        y2={s.saddle.y - 6}
        className="fg-saddle"
      />

      {/* stem + handlebar; hands rest on the active bar position, with the other
          hand positions (tops/hoods/drops) marked. The spacer stack (up the
          steerer) and the stem highlight when their fields are hovered. */}
      {line(s.headTop, s.barBottom, "fg-tube" + hlClass("spacer"))}
      {line(s.barBottom, s.barClamp, "fg-tube" + hlClass("stem"))}
      {dropPath && <path d={dropPath} className="fg-bar" fill="none" />}
      {barSegs.map(([a, b], i) => (
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="fg-bar" />
      ))}
      {s.handPts.length > 1 &&
        s.handPts.map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={7} className="fg-handpos" />)}
      <circle cx={s.grip.x} cy={s.grip.y} r={11} className="fg-node" />

      {/* seated rider (translucent capsules): hips at the saddle, foot on the
          pedal, hands on the grip; knee/elbow solved with two-bone IK */}
      <g className="rp-rider">
        {line(s.rHip, s.rKnee, "rp-limb" + (legOver ? " rp-over" : ""))}
        {line(s.rKnee, s.rAnkle, "rp-limb" + (legOver ? " rp-over" : ""))}
        {line(s.rAnkle, s.rToe, "rp-foot" + (legOver ? " rp-over" : ""))}
        {line(s.rHip, s.rShoulder, "rp-trunk")}
        {line(s.rShoulder, s.rHead, "rp-neck")}
        {line(s.rShoulder, s.rElbow, "rp-limb" + (armOver ? " rp-over" : ""))}
        {line(s.rElbow, s.grip, "rp-limb" + (armOver ? " rp-over" : ""))}
        <circle cx={s.rHead.x} cy={s.rHead.y} r={rHeadR} className="rp-head" />
        {[s.rHip, s.rKnee, s.rShoulder, s.rElbow].map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={11} className="rp-joint" />
        ))}
      </g>

      {/* over-extension flags: the limb can't reach its contact point (bars too
          far, or a saddle forced too high for the rider on a too-big frame) */}
      {armOver && (
        <text
          x={s.grip.x}
          y={s.grip.y - 26}
          textAnchor="middle"
          className="fg-note fg-note-over"
        >
          reach too long
        </text>
      )}
      {legOver && (
        <text
          x={s.rAnkle.x}
          y={s.rAnkle.y + 40}
          textAnchor="middle"
          className="fg-note fg-note-over"
        >
          saddle too high
        </text>
      )}

      {/* seat-tube length markers, drawn OVER the rider so the green stays clearly
          visible: effective (light green, to the virtual horizontal top tube)
          underneath, actual (dark green, to the sloping top tube) on top */}
      {line(s.BB, s.jVirtual, "fg-seat-effective" + hlClass("size"))}
      {line(s.BB, s.jActual, "fg-seat-actual" + hlClass("size"))}

      {/* crank arm + pedal, pivoting at the BB, drawn to the suggested length */}
      {line(s.BB, s.crankTip, "fg-crank" + hlClass("crank"))}
      {line(s.pedalL, s.pedalR, "fg-pedal" + hlClass("crank"))}
      <text
        x={s.pedalR.x + 14}
        y={s.crankTip.y + 6}
        className={"fg-mlabel fg-note-crank" + hlClass("crank")}
        dominantBaseline="middle"
      >
        Crank {crankLengthMm} mm
      </text>

      {/* stack (blue) up from the BB, reach (red) forward to the head-tube top */}
      {dim(s.BB, s.stackCorner, "fg-dim-stack", hl("stack"))}
      {dim(s.stackCorner, s.headTop, "fg-dim-reach", hl("reach"))}

      {/* BB + head-tube-top nodes */}
      <circle cx={s.BB.x} cy={s.BB.y} r={9} className="fg-node" />
      <circle cx={s.headTop.x} cy={s.headTop.y} r={9} className="fg-node" />

      {/* labels */}
      <text x={s.headTop.x / 2} y={s.headTop.y - 18} textAnchor="middle" className={"fg-mlabel fg-note-red" + hlClass("reach")}>
        Reach {Math.round(reachMm)} mm
      </text>
      <text x={16} y={s.stackCorner.y * 0.5} className={"fg-mlabel fg-note-blue" + hlClass("stack")} dominantBaseline="middle">
        Stack {Math.round(stackMm)} mm
      </text>
      {stub >= 28 && (
        <text x={(s.jVirtual.x + s.jHead.x) / 2} y={s.jVirtual.y - 16} textAnchor="middle" className="fg-note fg-note-green">
          virtual (horizontal) top tube
        </text>
      )}
      {topTubeSlopeDeg >= 1 && (
        <text
          x={(s.jHead.x + s.jActual.x) / 2}
          y={(s.jHead.y + s.jActual.y) / 2 + 34}
          textAnchor="middle"
          className="fg-note"
        >
          actual (sloping) top tube
        </text>
      )}
      <text x={actualMid.x - 16} y={actualMid.y} textAnchor="end" className="fg-note fg-note-green" dominantBaseline="middle">
        actual seat tube
      </text>
      {effLen - actLen > 40 && (
        <text x={effMid.x - 16} y={effMid.y} textAnchor="end" className="fg-note fg-note-green-soft" dominantBaseline="middle">
          effective seat tube
        </text>
      )}
    </svg>
  );
}
