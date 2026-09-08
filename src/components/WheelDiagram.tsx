// A proportional rendering of the wheel to visualise how the inputs affect the
// spokes: a face-on lacing view (shows spoke count, cross pattern and the
// rim-vs-flange proportions) and a cross-section (shows dish from the L/R
// flange offsets). Not a precise CAD drawing — a build sanity-check.
//
// The face-on view also doubles as a build guide: a slider (and play button)
// steps through lacing the wheel one spoke at a time, in the order a wheel is
// actually built — see sheldonbrown.com/wheelbuild.html.

import { useEffect, useMemo, useState } from "react";

const DRIVE = "#c0392b"; // right / drive side
const NDS = "#0b6bcb"; // left / non-drive side

// A spoke's build order is its group (0–3) then its position around the wheel.
// The four groups follow Sheldon Brown's method: drive-side first set, then the
// non-drive first set, then the drive-side crossing set, then the non-drive
// crossing set. Rim holes alternate flanges (even = drive, odd = non-drive) and
// lead/trail alternates per side, so group = i % 4 falls out for free.
const GROUP_LABELS = [
  "1st set · drive-side, heads-out",
  "2nd set · non-drive, heads-out",
  "3rd set · drive-side, crossing",
  "4th set · non-drive, crossing",
];

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
  const valid = !!erdMm && !!spokeCount && spokeCount >= 4 && spokeCount % 2 === 0;
  const n = valid ? spokeCount : 0;

  // Build order: sequence[step] = rim index of the spoke placed at that step.
  // Sort rim holes by group (i % 4), then position within the group (i / 4).
  const sequence = useMemo(() => {
    return Array.from({ length: n }, (_, i) => i).sort((a, b) => {
      const ga = a % 4;
      const gb = b % 4;
      return ga !== gb ? ga - gb : Math.floor(a / 4) - Math.floor(b / 4);
    });
  }, [n]);
  // order[rimIndex] = the step at which that spoke goes in.
  const order = useMemo(() => {
    const o = new Array<number>(n);
    sequence.forEach((rimIndex, step) => (o[rimIndex] = step));
    return o;
  }, [sequence, n]);

  // How many spokes are currently laced. Defaults to a fully built wheel; reset
  // when the spoke count changes (the classic "derive state from props" pattern).
  const [step, setStep] = useState(n);
  const [prevN, setPrevN] = useState(n);
  const [playing, setPlaying] = useState(false);
  if (prevN !== n) {
    setPrevN(n);
    setStep(n);
    setPlaying(false);
  }

  // Auto-advance while playing, then stop at a full wheel.
  useEffect(() => {
    if (!playing) return;
    if (step >= n) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, n)), 140);
    return () => clearTimeout(id);
  }, [playing, step, n]);

  if (!valid) {
    return <p className="field-hint">Enter an even spoke count and rim ERD to see the wheel.</p>;
  }

  const rimR = 100;
  const lfR = rimR * (props.leftFlangeDiaMm / erdMm);
  const rfR = rimR * (props.rightFlangeDiaMm / erdMm);

  // Face-on lacing, indexed by rim hole so each of the n rim holes is used
  // exactly once. A k-cross spoke's flange end is offset by θ = 4π·k/n, which
  // lands on a real flange hole; leading/trailing alternates per side to cross.
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

    const placed = order[i] < step;
    const current = order[i] === step - 1;
    if (placed) {
      faceSpokes.push(
        <line
          key={i}
          x1={fR * Math.cos(flA)}
          y1={fR * Math.sin(flA)}
          x2={rx}
          y2={ry}
          stroke={color}
          strokeWidth={current ? 2 : 0.8}
          strokeLinecap="round"
          opacity={current ? 1 : 0.9}
        />,
      );
    }
    rimDots.push(
      <circle
        key={"d" + i}
        className={placed ? "wd-hole" : "wd-hole wd-hole-empty"}
        cx={rx}
        cy={ry}
        r={1.4}
        fill={placed ? color : "none"}
      />,
    );
  }

  // Valve marker just clockwise of rim hole 0, so "start next to the valve" lines
  // up with the first spoke placed.
  const valveA = -Math.PI / n;
  const vx = Math.cos(valveA);
  const vy = Math.sin(valveA);

  // Build-guide caption for the current step.
  let buildCaption: string;
  if (step <= 0) {
    buildCaption = "Bare rim & hub — drag to lace, starting by the valve";
  } else if (step >= n) {
    buildCaption = `Fully laced · ${n}h · ${props.leftCross}× / ${props.rightCross}×`;
  } else {
    const group = sequence[step - 1] % 4;
    buildCaption = `Spoke ${step} of ${n} · ${GROUP_LABELS[group]}`;
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
          <line
            className="wd-valve"
            x1={rimR * vx}
            y1={rimR * vy}
            x2={(rimR - 9) * vx}
            y2={(rimR - 9) * vy}
          />
          {faceSpokes}
          {rimDots}
          <circle r={2.5} className="wd-hub" />
        </svg>
        <div className="wd-build">
          <button
            type="button"
            className="wd-play"
            onClick={() => {
              if (playing) {
                setPlaying(false);
              } else {
                if (step >= n) setStep(0);
                setPlaying(true);
              }
            }}
            aria-label={playing ? "Pause build" : "Play build"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <input
            className="wd-scrubber"
            type="range"
            min={0}
            max={n}
            value={step}
            aria-label="Wheel build step"
            onChange={(e) => {
              setPlaying(false);
              setStep(Number(e.target.value));
            }}
          />
        </div>
        <div className="wd-caption">{buildCaption}</div>
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
