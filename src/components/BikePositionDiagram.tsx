import { FrameGeometryDiagram, type FrameGeometryDiagramProps } from "./FrameGeometryDiagram";
import { RiderPose } from "./RiderPose";
import { clamp, ik2, type P } from "./bikeGeometry";

export type ReclinedBikeStyle = "highracer" | "lowracer" | "lowracerTail" | "velomobile";
type Props =
  | { kind: "upright"; frame: FrameGeometryDiagramProps }
  | { kind: ReclinedBikeStyle; heightCm: number; label: string };

/** Shared side-view entry point: conventional frames or feet-forward bikes. */
export function BikePositionDiagram(props: Props) {
  if (props.kind === "upright") return <FrameGeometryDiagram {...props.frame} />;
  return <ReclinedBikeDiagram {...props} />;
}

function ReclinedBikeDiagram({ kind, heightCm, label }: { kind: ReclinedBikeStyle; heightCm: number; label: string }) {
  const faired = kind === "velomobile";
  const high = kind === "highracer";
  // A velomobile's shell has fixed dimensions; show its typical occupant in a
  // cutaway. Open recumbents adapt to the rider's height, using typical proportions.
  const H = (faired ? 175 : Number.isFinite(heightCm) ? clamp(heightCm, 120, 210) : 175) * 10;
  const f = H / 1750;
  const wheelR = high ? 350 : 240;
  const rear = { x: -600 * f, y: -wheelR };
  const front = { x: 720 * f, y: -wheelR };
  // The velomobile seat and crank sit low in the shell, leaving room for the
  // raised knee on the return stroke as well as the forward pedalling leg.
  const hip = { x: -100 * f, y: -(faired ? 270 : high ? 820 : 460) * f };
  const recline = (high ? 35 : 25) * Math.PI / 180;
  const torso = H * 0.29;
  const shoulder = { x: hip.x - Math.cos(recline) * torso, y: hip.y - Math.sin(recline) * torso };
  const head = { x: shoulder.x + 35 * f, y: shoulder.y - 185 * f };
  const grip = { x: hip.x + 20 * f, y: hip.y - 160 * f };
  const arm = H * 0.331;
  const elbow = ik2(shoulder, grip, arm * 0.52, arm * 0.48, 1);
  const bb = { x: hip.x + H * 0.38, y: hip.y - H * 0.035 };
  const crank = H * 0.095;
  const pedal = { x: bb.x + crank * 0.866, y: bb.y + crank * 0.5 };
  const ankle = { x: pedal.x - 40 * f, y: pedal.y - 55 * f };
  const toe = { x: ankle.x + 60 * f, y: ankle.y + 45 * f };
  const leg = H * 0.47 * 1.045;
  const knee = ik2(hip, ankle, leg * 0.499, leg * 0.501, -1);
  const farPedal = { x: 2 * bb.x - pedal.x, y: 2 * bb.y - pedal.y };
  const farAnkle = { x: farPedal.x - 40 * f, y: farPedal.y - 55 * f };
  const farKnee = ik2(hip, farAnkle, leg * 0.499, leg * 0.501, -1);
  const seatBottom = { x: hip.x - 20 * f, y: hip.y + 55 * f };
  const seatTop = { x: shoulder.x - 55 * f, y: shoulder.y + 20 * f };
  const tail = kind === "lowracerTail";
  const minX = tail || faired ? -1120 * f : Math.min(rear.x - wheelR, head.x - H * 0.06) - 70;
  const maxX = faired ? 1170 : Math.max(front.x + wheelR, toe.x + 60) + 70;
  const minY = Math.min(head.y - H * 0.06 - 60, faired ? -1100 : 0);
  const height = 60 - minY;
  const line = (a: P, b: P, cls: string) => <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={cls} />;
  return (
    <svg width="100%" viewBox={`${minX} ${minY} ${maxX - minX} ${height}`} preserveAspectRatio="xMidYMax meet" role="img"
      aria-label={`${label}: ${faired ? "three-wheel aerodynamic shell, with the reclined rider shown in cutaway" : `${high ? "high" : "low"} reclined seat and feet-forward pedals${tail ? ", with an aerodynamic tailbox behind the seat" : ""}`}`}
      data-bike-style={kind}>
      <line x1={minX} y1="0" x2={maxX} y2="0" className="fg-ground" />
      {faired && (
        <g className="rec-shell">
          <path d="M-1050 -320 Q-1040 -550 -780 -640 Q-580 -770 -200 -730 Q660 -770 1080 -440 Q1190 -230 1000 -130 L-790 -130 Q-1010 -140 -1050 -320Z" className="rec-fairing" />
          <path d="M-790 -630 Q-780 -1010 -490 -990 Q-260 -990 -140 -720" className="rec-canopy" />
          <circle cx={front.x - 40} cy={front.y - 15} r={wheelR} className="fg-wheel rec-far-wheel" />
        </g>
      )}
      {tail && <path d={`M${seatTop.x - 50 * f} ${seatTop.y - 15 * f} Q${-1010 * f} ${-650 * f} ${-1070 * f} ${-470 * f} Q${-1120 * f} ${-320 * f} ${-880 * f} ${-320 * f} L${hip.x - 80 * f} ${hip.y + 150 * f} Q${hip.x - 40 * f} ${hip.y + 100 * f} ${hip.x - 35 * f} ${hip.y + 10 * f}Z`} className="rec-tailbox" />}
      <circle cx={rear.x} cy={rear.y} r={wheelR} className="fg-wheel" />
      <circle cx={front.x} cy={front.y} r={wheelR} className="fg-wheel" />
      <g className="rp-far">
        {line(bb, farPedal, "fg-crank")}
        {line(hip, farKnee, "rp-limb")}
        {line(farKnee, farAnkle, "rp-limb")}
        {line(farAnkle, { x: farAnkle.x + 60 * f, y: farAnkle.y + 45 * f }, "rp-foot")}
      </g>
      <g className={faired ? "rec-cutaway-frame" : "rec-frame"}>
        {line(rear, seatBottom, "fg-tube")}
        {line(seatBottom, bb, "fg-tube")}
        {line(seatBottom, { x: front.x - 40 * f, y: front.y - 210 * f }, "fg-tube")}
        {line({ x: front.x - 40 * f, y: front.y - 210 * f }, front, "fg-tube")}
        {line(seatBottom, seatTop, "rec-seat")}
        {line({ x: hip.x + 100 * f, y: hip.y + 10 * f }, grip, "fg-bar")}
        {line({ x: grip.x - 45 * f, y: grip.y }, { x: grip.x + 45 * f, y: grip.y }, "fg-bar")}
      </g>
      <RiderPose hip={hip} knee={knee} ankle={ankle} toe={toe} shoulder={shoulder} elbow={elbow} grip={grip} head={head} headRadius={H * 0.06} />
      {line(bb, pedal, "fg-crank")}
      {line({ x: pedal.x - 30, y: pedal.y }, { x: pedal.x + 30, y: pedal.y }, "fg-pedal")}
      <circle cx={bb.x} cy={bb.y} r="18" className="fg-node" />
    </svg>
  );
}
