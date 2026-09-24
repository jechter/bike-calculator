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

const WHEEL_R = 350; // ~700c with tyre, mm
const BB_DROP = 70; // BB below the axle line, mm
const CHAINSTAY = 430;
const HEAD_STUB_MM = 14; // head tube + headset above the top-tube junction (~1 cm)
const FORK_CROWN_Y = 419; // rigid fork crown / head-tube-bottom height above BB
const SUSPENSION_FORK_CROWN_Y = 500; // a longer (suspension) fork sits the crown higher
const FORK_OFFSET = 45;
const CRANK_ANGLE = (32 * Math.PI) / 180; // crank arm, forward of straight-down
const PEDAL_HALF = 30; // half-length of the drawn pedal, mm

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
}

type P = { x: number; y: number };
// Bike space has y up; SVG has y down, so flip as we place points.
const flip = (p: P): P => ({ x: p.x, y: -p.y });
const onSeat = (len: number): P => ({ x: -len * COS, y: len * SIN });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
  } = props;

  const clipId = useId();

  // --- bike-space geometry (y up) --------------------------------------------
  const BB = { x: 0, y: 0 };
  const saddle = onSeat(saddleHeightMm);
  const headTop = { x: reachMm, y: stackMm };
  const stackCorner = { x: 0, y: stackMm };

  // A suspension fork sits the crown higher, so the head tube can be short even
  // with a tall front end (mountain bikes).
  const forkCrownY = geometry === 'suspension' ? SUSPENSION_FORK_CROWN_Y : FORK_CROWN_Y;

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

  // Crank arm: pivots at the BB, drawn to scale pointing down-and-forward, with
  // a short pedal across its end.
  const crankTip = {
    x: crankLengthMm * Math.sin(CRANK_ANGLE),
    y: -crankLengthMm * Math.cos(CRANK_ANGLE),
  };
  const pedalL = { x: crankTip.x - PEDAL_HALF, y: crankTip.y };
  const pedalR = { x: crankTip.x + PEDAL_HALF, y: crankTip.y };

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

  // Dimension lines: body height + inseam nested clear of the left edge, arm on
  // the bike-facing side.
  const inseamDimX = figLeft - 0.03 * H;
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
  };

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

  // A double-headed dimension segment drawn on the geometry itself.
  const dim = (a: P, b: P, cls: string) => {
    const A = 11;
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
      <g className={cls}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
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
      aria-label="Frame geometry: stack rises from the bottom bracket and reach runs forward to the head-tube top; the actual seat tube (to the sloping top tube) and the effective/virtual seat tube (to a horizontal top tube) are shown in two shades of green; a crank arm drawn to the suggested length pivots at the bottom bracket. To the left, a front-view cyclist stands to scale with dimension lines for body height, cycling inseam and arm length."
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

      {/* body-input dimensions: height (blue) + inseam (green) nested on the left,
          arm length (amber) on the bike-facing side */}
      {dim(pt(bodyDimX, gY), pt(bodyDimX, headTopY), "fg-dim-body")}
      {dim(pt(inseamDimX, gY), pt(inseamDimX, crotchY), "fg-dim-inseam")}
      {dim(pt(armDimX, shoulderY), pt(armDimX, wristY), "fg-dim-arm")}

      <text x={bodyDimX - 16} y={pt(0, gY + 0.74 * H).y} textAnchor="end" className="fg-note fg-note-blue">
        Body height
        <tspan x={bodyDimX - 16} dy={40}>{cm(bodyHeightMm)} cm</tspan>
      </text>
      <text x={bodyDimX - 16} y={pt(0, gY + 0.2 * H).y} textAnchor="end" className="fg-note fg-note-green">
        Cycling inseam
        <tspan x={bodyDimX - 16} dy={40}>{cm(inseamMm)} cm</tspan>
      </text>
      <text
        x={armDimX + 14}
        y={pt(0, (shoulderY + wristY) / 2).y}
        className="fg-note fg-note-arm"
        dominantBaseline="middle"
      >
        Arm {cm(armLengthMm)} cm
      </text>

      {/* wheels for context */}
      <circle cx={s.rearAxle.x} cy={s.rearAxle.y} r={WHEEL_R} className="fg-wheel" />
      <circle cx={s.frontAxle.x} cy={s.frontAxle.y} r={WHEEL_R} className="fg-wheel" />

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

      {/* seat-tube lengths: effective (light green, to the virtual horizontal
          top tube) underneath, actual (dark green, to the sloping top tube) on
          top; plus the dashed virtual top tube back from the head tube */}
      {line(s.BB, s.jVirtual, "fg-seat-effective")}
      {line(s.BB, s.jActual, "fg-seat-actual")}
      {line(s.jHead, s.jVirtual, "fg-virtual-tt")}

      {/* saddle */}
      <line
        x1={s.saddle.x - 34}
        y1={s.saddle.y}
        x2={s.saddle.x + 26}
        y2={s.saddle.y - 6}
        className="fg-saddle"
      />

      {/* crank arm + pedal, pivoting at the BB, drawn to the suggested length */}
      {line(s.BB, s.crankTip, "fg-crank")}
      {line(s.pedalL, s.pedalR, "fg-pedal")}
      <text
        x={s.pedalR.x + 14}
        y={s.crankTip.y + 6}
        className="fg-note fg-note-crank"
        dominantBaseline="middle"
      >
        Crank {crankLengthMm} mm
      </text>

      {/* stack (blue) up from the BB, reach (red) forward to the head-tube top */}
      {dim(s.BB, s.stackCorner, "fg-dim-stack")}
      {dim(s.stackCorner, s.headTop, "fg-dim-reach")}

      {/* BB + head-tube-top nodes */}
      <circle cx={s.BB.x} cy={s.BB.y} r={9} className="fg-node" />
      <circle cx={s.headTop.x} cy={s.headTop.y} r={9} className="fg-node" />

      {/* labels */}
      <text x={s.headTop.x / 2} y={s.headTop.y - 16} textAnchor="middle" className="fg-dim-label fg-note-red">
        Reach
      </text>
      <text x={14} y={s.stackCorner.y * 0.5} className="fg-dim-label fg-note-blue" dominantBaseline="middle">
        Stack
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
