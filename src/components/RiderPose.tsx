import type { P } from "./bikeGeometry";

export interface RiderPoseProps {
  hip: P; knee: P; ankle: P; toe: P;
  shoulder: P; elbow: P; grip: P; head: P;
  headRadius: number;
  legOver?: boolean;
  armOver?: boolean;
}

/** Shared capsule rider for upright and reclined bikes; points are SVG coordinates. */
export function RiderPose(p: RiderPoseProps) {
  const line = (a: P, b: P, cls: string) => <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={cls} />;
  return (
    <g className="rp-rider">
      {line(p.hip, p.knee, "rp-limb" + (p.legOver ? " rp-over" : ""))}
      {line(p.knee, p.ankle, "rp-limb" + (p.legOver ? " rp-over" : ""))}
      {line(p.ankle, p.toe, "rp-foot" + (p.legOver ? " rp-over" : ""))}
      {line(p.hip, p.shoulder, "rp-trunk")}
      {line(p.shoulder, p.head, "rp-neck")}
      {line(p.shoulder, p.elbow, "rp-limb" + (p.armOver ? " rp-over" : ""))}
      {line(p.elbow, p.grip, "rp-limb" + (p.armOver ? " rp-over" : ""))}
      <circle cx={p.head.x} cy={p.head.y} r={p.headRadius} className="rp-head" />
      {[p.hip, p.knee, p.shoulder, p.elbow].map((point, i) => <circle key={i} cx={point.x} cy={point.y} r={11} className="rp-joint" />)}
    </g>
  );
}
