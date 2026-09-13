// A 3D rendering of the wheel (see Wheel3D) plus a build scrubber that laces it
// one spoke at a time, in the order a wheel is actually built — see
// sheldonbrown.com/wheelbuild.html. The scrubber drives the 3D view; the view
// itself has Face/Side buttons and a zoom control.

import { useEffect, useMemo, useState } from "react";
import { Wheel3D } from "./Wheel3D";
import { spokePlan, type HubType, type LacingPattern } from "../lib/spokes";

const DRIVE = "#c0392b"; // right / drive side
const NDS = "#0b6bcb"; // left / non-drive side

// A spoke's build order is its group (0–3) then its position around the wheel.
// The four groups follow Sheldon Brown's method: drive-side first set, then the
// non-drive first set, then the drive-side crossing set, then the non-drive
// crossing set. Rim holes alternate flanges (even = drive, odd = non-drive); the
// heads-out (leading) spokes go in before the crossing (trailing) ones. With
// grouped lacing (2L2T…) the lead/trail run isn't a simple alternation, so the
// group is derived from each spoke's actual handedness rather than i % 4.
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
  /** Grouped-lacing run length per side: 1 = standard 1L1T, 2 = 2L2T, 3 = 3L3T… */
  leftGroup?: number;
  rightGroup?: number;
  /** Lacing pattern per side: 'standard' (incl. grouped) or 'crowsfoot'. */
  leftPattern?: LacingPattern;
  rightPattern?: LacingPattern;
  /** Alternating rim drilling: each hole nudged this many mm toward its flange. */
  rimHoleOffsetMm?: number;
  /** Selected hub's type / over-locknut width, when a hub is chosen — drives the
   *  axle length and the hub-shell shape in the 3D view. */
  hubType?: HubType;
  hubWidthMm?: number;
}

export function WheelDiagram(props: WheelDiagramProps) {
  const {
    erdMm,
    spokeCount,
    leftGroup = 1,
    rightGroup = 1,
    leftPattern = "standard",
    rightPattern = "standard",
  } = props;
  const valid = !!erdMm && !!spokeCount && spokeCount >= 4 && spokeCount % 2 === 0;
  const n = valid ? spokeCount : 0;

  // A spoke's build group: heads-out (leading) and radial spokes first, then the
  // crossing (trailing) sets, drive side before non-drive — 0..3 per GROUP_LABELS.
  const buildGroup = (i: number) => {
    const isDrive = i % 2 === 0;
    const plan = spokePlan(Math.floor(i / 2), {
      cross: isDrive ? props.rightCross : props.leftCross,
      group: isDrive ? rightGroup : leftGroup,
      pattern: isDrive ? rightPattern : leftPattern,
    });
    return (plan.lead === -1 ? 2 : 0) + (isDrive ? 0 : 1);
  };

  // Build order: sequence[step] = rim index of the spoke placed at that step.
  // Sort rim holes by build group, then by position around the wheel.
  const sequence = useMemo(() => {
    return Array.from({ length: n }, (_, i) => i).sort((a, b) => {
      const ga = buildGroup(a);
      const gb = buildGroup(b);
      return ga !== gb ? ga - gb : a - b;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, leftGroup, rightGroup, leftPattern, rightPattern, props.leftCross, props.rightCross]);

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

  // Build-guide caption for the current step.
  const sideLabel = (cross: number, group: number, pattern: LacingPattern) =>
    pattern === "crowsfoot"
      ? `${cross}× crow's foot`
      : `${cross}×${group > 1 ? ` ${group}L${group}T` : ""}`;
  let buildCaption: string;
  if (step <= 0) {
    buildCaption = "Bare rim & hub — drag to lace, starting by the valve";
  } else if (step >= n) {
    buildCaption =
      `Fully laced · ${n}h · ` +
      `${sideLabel(props.leftCross, leftGroup, leftPattern)} / ` +
      `${sideLabel(props.rightCross, rightGroup, rightPattern)}`;
  } else {
    const group = buildGroup(sequence[step - 1]);
    buildCaption = `Spoke ${step} of ${n} · ${GROUP_LABELS[group]}`;
  }

  return (
    <div className="wheel-diagram">
      <Wheel3D
        erdMm={erdMm}
        spokeCount={n}
        leftFlangeDiaMm={props.leftFlangeDiaMm}
        rightFlangeDiaMm={props.rightFlangeDiaMm}
        leftOffsetMm={props.leftOffsetMm}
        rightOffsetMm={props.rightOffsetMm}
        leftCross={props.leftCross}
        rightCross={props.rightCross}
        leftGroup={leftGroup}
        rightGroup={rightGroup}
        leftPattern={leftPattern}
        rightPattern={rightPattern}
        rimHoleOffsetMm={props.rimHoleOffsetMm}
        hubType={props.hubType}
        hubWidthMm={props.hubWidthMm}
        step={step}
        sequence={sequence}
      />

      <div className="wd-lacing">
        <div className="wd-lacing-label">Lacing order</div>
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
