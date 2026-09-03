// A proportional rendering of the wheel to visualise how the inputs affect the
// spokes: a face-on lacing view (shows spoke count, cross pattern and the
// rim-vs-flange proportions) and a cross-section (shows dish from the L/R
// flange offsets). Not a precise CAD drawing — a build sanity-check.

const DRIVE = "#c0392b"; // right / drive side
const NDS = "#0b6bcb"; // left / non-drive side

export interface WheelDiagramProps {
  erdMm: number;
  spokeCount: number;
  leftFlangeDiaMm: number;
  rightFlangeDiaMm: number;
  leftOffsetMm: number;
  rightOffsetMm: number;
  leftCross: number;
  rightCross: number;
}

export function WheelDiagram(props: WheelDiagramProps) {
  const { erdMm, spokeCount } = props;
  if (!erdMm || !spokeCount || spokeCount < 4 || spokeCount % 2 !== 0) {
    return <p className="field-hint">Enter an even spoke count and rim ERD to see the wheel.</p>;
  }

  const n = spokeCount;
  const rimR = 100;
  const lfR = rimR * (props.leftFlangeDiaMm / erdMm);
  const rfR = rimR * (props.rightFlangeDiaMm / erdMm);

  // Face-on lacing, indexed by rim hole so each of the n rim holes is used
  // exactly once. Rim holes alternate flanges (even = drive, odd = non-drive).
  // A k-cross spoke's flange end is offset by θ = 4π·k/n, which lands on a real
  // flange hole; leading/trailing alternates per side to make them cross.
  const faceSpokes = [] as JSX.Element[];
  const rimDots = [] as JSX.Element[];
  for (let i = 0; i < n; i++) {
    const isDrive = i % 2 === 0;
    const fR = isDrive ? rfR : lfR;
    const k = isDrive ? props.rightCross : props.leftCross;
    const color = isDrive ? DRIVE : NDS;
    const lead = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
    const rimA = (2 * Math.PI * i) / n;
    const flA = rimA + lead * ((4 * Math.PI * k) / n);
    const rx = rimR * Math.cos(rimA);
    const ry = rimR * Math.sin(rimA);
    faceSpokes.push(
      <line
        key={i}
        x1={fR * Math.cos(flA)}
        y1={fR * Math.sin(flA)}
        x2={rx}
        y2={ry}
        stroke={color}
        strokeWidth={0.7}
      />,
    );
    rimDots.push(<circle key={"d" + i} className="wd-hole" cx={rx} cy={ry} r={1.4} fill={color} />);
  }

  // Cross-section (dish) — true proportions: offsets share the rim's scale.
  const secH = 200; // px for the rim radius
  const secScale = secH / (erdMm / 2);
  const lOff = props.leftOffsetMm * secScale;
  const rOff = props.rightOffsetMm * secScale;
  const lFy = (props.leftFlangeDiaMm / 2) * secScale;
  const rFy = (props.rightFlangeDiaMm / 2) * secScale;
  const maxOff = Math.max(lOff, rOff, 8) + 6;
  const dishThreshold = 1.5; // mm difference to call it "dished"
  const dished = Math.abs(props.leftOffsetMm - props.rightOffsetMm) > dishThreshold;

  return (
    <div className="wheel-diagram">
      <div className="wd-view">
        <svg viewBox="-118 -118 236 236" role="img" aria-label="Face-on lacing view">
          <circle r={rimR} className="wd-rim" />
          <circle r={rfR} className="wd-flange" />
          <circle r={lfR} className="wd-flange" />
          {faceSpokes}
          {rimDots}
          <circle r={2.5} className="wd-hub" />
        </svg>
        <div className="wd-caption">
          Lacing · {spokeCount}h · {props.leftCross}× / {props.rightCross}×
        </div>
      </div>

      <div className="wd-view wd-section">
        <svg
          viewBox={`${-maxOff} ${-secH - 12} ${2 * maxOff} ${2 * secH + 24}`}
          role="img"
          aria-label="Cross-section showing dish"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* rim plane (edge-on) */}
          <line x1={0} y1={-secH} x2={0} y2={secH} className="wd-rim-edge" />
          {/* axle line */}
          <line x1={-maxOff} y1={0} x2={maxOff} y2={0} className="wd-axle" />
          {/* left / non-drive spokes */}
          <line x1={-lOff} y1={-lFy} x2={0} y2={-secH} stroke={NDS} strokeWidth={1} />
          <line x1={-lOff} y1={lFy} x2={0} y2={secH} stroke={NDS} strokeWidth={1} />
          {/* right / drive spokes */}
          <line x1={rOff} y1={-rFy} x2={0} y2={-secH} stroke={DRIVE} strokeWidth={1} />
          <line x1={rOff} y1={rFy} x2={0} y2={secH} stroke={DRIVE} strokeWidth={1} />
          {/* flanges */}
          <line x1={-lOff} y1={-lFy} x2={-lOff} y2={lFy} stroke={NDS} strokeWidth={2.5} />
          <line x1={rOff} y1={-rFy} x2={rOff} y2={rFy} stroke={DRIVE} strokeWidth={2.5} />
          <circle cx={0} cy={0} r={3} className="wd-hub" />
        </svg>
        <div className="wd-caption">{dished ? "Dish (rear/disc)" : "Symmetric"}</div>
      </div>

      <div className="wd-legend">
        <span>
          <i style={{ background: NDS }} /> Left / non-drive
        </span>
        <span>
          <i style={{ background: DRIVE }} /> Right / drive
        </span>
      </div>
    </div>
  );
}
