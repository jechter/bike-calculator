// Schematic side view of a diamond frame, drawn to scale from the fit targets.
// Stack (blue) rises from the bottom bracket; reach (red) runs forward to the
// head-tube top. The top tube meets the head tube ~1 cm below its top (as real
// frames do); the head tube then runs DOWN to a roughly fixed fork-crown height,
// so a higher-stack (more relaxed) frame is drawn with a longer head tube — not
// with head tube stacked above the top tube. From the top-tube junction, two
// seat-tube lengths are shown in two shades of green: the ACTUAL seat tube (dark,
// to the real sloping top tube) and the EFFECTIVE / virtual seat tube (light, to
// a horizontal top tube). A frame's marketing "size" sits between the two.

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

export interface FrameGeometryDiagramProps {
  reachMm: number;
  stackMm: number;
  /** Top-tube slope (degrees below horizontal): 0 = level, bigger = more compact. */
  topTubeSlopeDeg: number;
  /** Geometry style — 'suspension' uses a longer fork so the head tube is short. */
  geometry: 'classic' | 'sloping' | 'suspension';
  /** Saddle height (BB → saddle top) along the seat tube, mm. */
  saddleHeightMm: number;
}

type P = { x: number; y: number };
// Bike space has y up; SVG has y down, so flip as we place points.
const flip = (p: P): P => ({ x: p.x, y: -p.y });
const onSeat = (len: number): P => ({ x: -len * COS, y: len * SIN });

export function FrameGeometryDiagram(props: FrameGeometryDiagramProps) {
  const { reachMm, stackMm, topTubeSlopeDeg, geometry, saddleHeightMm } = props;

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
  };

  const bounds: P[] = [
    s.saddle,
    { x: s.headTop.x, y: s.headTop.y - 46 }, // reach label room
    { x: s.rearAxle.x - WHEEL_R, y: 0 },
    { x: s.frontAxle.x + WHEEL_R, y: 0 },
    { x: s.jVirtual.x - 40, y: 0 },
    { x: 0, y: -groundY },
  ];
  const M = 34;
  const minX = Math.min(...bounds.map((p) => p.x)) - M;
  const maxX = Math.max(...bounds.map((p) => p.x)) + M;
  const minY = Math.min(...bounds.map((p) => p.y)) - M;
  const maxY = Math.max(...bounds.map((p) => p.y)) + M;
  const W = maxX - minX;
  const H = maxY - minY;

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

  return (
    <svg
      viewBox={`${minX} ${minY} ${W} ${H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Frame geometry: stack rises from the bottom bracket and reach runs forward to the head-tube top; the actual seat tube (to the sloping top tube) and the effective/virtual seat tube (to a horizontal top tube) are shown in two shades of green."
    >
      <line x1={minX} y1={-groundY} x2={maxX} y2={-groundY} className="fg-ground" />

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
