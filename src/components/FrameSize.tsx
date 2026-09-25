import { useState } from "react";
import type { ReactNode } from "react";
import {
  resolveFit,
  cockpitForFit,
  cockpitForFrame,
  saddleHeight,
  wheelByLabel,
  WHEELS,
  findCategory,
  FRAME_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  LEG_PROPORTIONS,
  type CockpitSpec,
} from "../lib/frameSize";
import { Field, NumberInput, Select, Note, Result, Section } from "./ui";
import { FrameGeometryDiagram, type HighlightKey } from "./FrameGeometryDiagram";

// Categories grouped into <optgroup>s (Road / Gravel / Mountain / …), preserving
// the order they're declared in.
const CATEGORY_OPTIONS = (() => {
  const groups: Array<{ label: string; options: Array<{ value: string; label: string }> }> = [];
  for (const c of FRAME_CATEGORIES) {
    let g = groups.find((x) => x.label === c.group);
    if (!g) {
      g = { label: c.group, options: [] };
      groups.push(g);
    }
    g.options.push({ value: c.id, label: c.label });
  }
  return groups;
})();

// Diagram legend colours — each measurement in the diagram has its own colour.
const REACH_COLOR = "var(--diag-red)";
const STACK_COLOR = "var(--diag-blue)";
const SIZE_COLOR = "var(--diag-green)";
const CRANK_COLOR = "var(--diag-crank)";
const HEIGHT_COLOR = "var(--diag-body)";
const INSEAM_COLOR = "var(--diag-inseam)";
const ARM_COLOR = "var(--diag-arm)";
const WHEEL_COLOR = "var(--diag-wheel)";

const round = (n: number) => Math.round(n);

// The editable fields. Everything is one linked model: any field you set is kept
// as-is, and every field you leave blank is recommended from the ones you did
// set. Nothing is cleared automatically — you can pin your height, inseam, frame,
// reach and stack all at once (e.g. to read off cockpit dimensions, or just to
// see how you'd sit on a bike you already own). Where two pinned values could
// disagree, the solver prefers the most direct measurement (see resolveFit).
type FieldKey =
  | "height" | "inseam" | "arm" // body
  | "frame" | "reach" | "stack" // frame side
  | "stemLen" | "stemAngle" | "spacer" | "crank"; // cockpit overrides

const EMPTY: Record<FieldKey, number> = {
  height: NaN, inseam: NaN, arm: NaN,
  frame: NaN, reach: NaN, stack: NaN,
  stemLen: NaN, stemAngle: NaN, spacer: NaN, crank: NaN,
};

export function FrameSize() {
  // Every field starts empty (auto): the model seeds itself from a nominal rider
  // and shows each value greyed as an "≈" estimate until you type over it.
  const [vals, setVals] = useState<Record<FieldKey, number>>(EMPTY);
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [legProp, setLegProp] = useState(0.47);
  const [sizeUnit, setSizeUnit] = useState<"cm" | "in">("cm");
  // Wheel size: "" = the size recommended for the frame; else a chosen wheel.
  const [wheelSel, setWheelSel] = useState("");

  // Which measurement is hovered/edited in the UI (highlighted in the diagram).
  const [hl, setHl] = useState<HighlightKey | null>(null);
  const link = (k: HighlightKey) => ({ activate: () => setHl(k), deactivate: () => setHl(null) });

  // Seated posture on the bike: 0 = arms fully straight, 1 = forearm parallel.
  const [posture, setPosture] = useState(0.4);

  const category = findCategory(categoryId);

  // Setting a field just pins that one value; everything else stays put and the
  // blanks re-recommend around it. A NaN hands the field back to its estimate.
  const edit = (field: FieldKey, v: number) =>
    setVals((prev) => ({ ...prev, [field]: v }));
  const clearField = (field: FieldKey) => edit(field, NaN);
  const clearAll = () => setVals(EMPTY);
  const anySet = Object.values(vals).some((v) => Number.isFinite(v));

  const num = (v: number) => (Number.isFinite(v) ? v : null);

  // Frame size is stored internally in cm; the field shows cm or inches.
  const frameToDisplay = (cm: number) => (sizeUnit === "in" ? cm / 2.54 : cm);
  const frameFromDisplay = (v: number) => (sizeUnit === "in" ? v * 2.54 : v);

  const fit = resolveFit(
    {
      heightCm: num(vals.height),
      inseamCm: num(vals.inseam),
      armCm: num(vals.arm),
      frameCm: num(vals.frame),
      reachMm: num(vals.reach),
      stackMm: num(vals.stack),
    },
    category,
    legProp,
  );

  // The drawn reach/stack (a pinned value, else the recommendation).
  const drawnReach = num(vals.reach) ?? fit.targets.reachMm;
  const drawnStack = num(vals.stack) ?? fit.targets.stackMm;

  // Cockpit + crank are proposed from the frame, but stay editable so you can see
  // how (say) a longer stem changes the position. The stem/spacer suggestion also
  // compensates a reach/stack that falls short of the rider's target — a frame
  // that's too short gets a longer stem, one that's too low gets more spacers.
  const recCockpit = cockpitForFit(category, fit.frameCm, {
    reachGapMm: fit.targets.reachMm - drawnReach,
    stackGapMm: fit.targets.stackMm - drawnStack,
  });
  const effCockpit: CockpitSpec = {
    ...recCockpit,
    stemLenMm: num(vals.stemLen) ?? recCockpit.stemLenMm,
    stemRiseDeg: num(vals.stemAngle) ?? recCockpit.stemRiseDeg,
    spacerMm: num(vals.spacer) ?? recCockpit.spacerMm,
  };
  const effCrank = num(vals.crank) ?? fit.crank.suggestedMm;

  // Arm over-reach: the bars (drawn reach + the fitted stem's horizontal reach)
  // sit farther forward than the rider's own target reach + a nominal stem. This
  // fires when a too-long reach can't be pulled back by the stem, or the stem is
  // overridden longer than needed — the rider is drawn stretched, in warning red.
  // Horizontal reach of a stem. Its angle vs. the ground adds the head tube's
  // lean (~18° for the drawn 72° head angle) to the printed stem angle.
  const stemReach = (c: CockpitSpec) => c.stemLenMm * Math.cos(((c.stemRiseDeg + 18) * Math.PI) / 180);
  const targetGripX = fit.targets.reachMm + stemReach(cockpitForFrame(category, fit.frameCm));
  const drawnGripX = drawnReach + stemReach(effCockpit);
  const armOver = drawnGripX - targetGripX > 45;

  // Wheel: the recommended size for the frame, unless one is chosen.
  const effWheel = (wheelSel && wheelByLabel(wheelSel)) || fit.wheel;
  // Saddle height follows the effective crank (a longer crank lowers it), so the
  // quoted number and the drawn saddle track a crank change.
  const effSaddleCm = saddleHeight(fit.inseamCm, effCrank);

  // A NumberInput bound to a field: it shows the resolved value greyed as an
  // estimate until you type, and steps from that estimate rather than the min.
  const input = (
    field: FieldKey,
    derived: number,
    o: {
      min?: number;
      max?: number;
      step?: number;
      suffix?: ReactNode;
      decimals?: number;
      value?: number; // display value override (frame unit conversion)
      onChange?: (v: number) => void; // override (frame unit conversion)
      estimate?: number; // display estimate override (frame unit conversion)
    } = {},
  ) => {
    const est =
      o.estimate ?? (o.decimals ? Number(derived.toFixed(o.decimals)) : round(derived));
    return (
      <NumberInput
        value={o.value ?? vals[field]}
        onChange={o.onChange ?? ((v) => edit(field, v))}
        onClear={() => clearField(field)}
        min={o.min}
        max={o.max}
        step={o.step}
        suffix={o.suffix}
        placeholder={`≈ ${est}`}
        estimate={est}
      />
    );
  };

  // The diagram shows the user's actual bike where they've supplied it: a pinned
  // reach/stack draws directly, even if it disagrees with the inseam-derived
  // recommendation, so you can see how you'd sit on a frame you already own.
  const geom = {
    reachMm: drawnReach,
    stackMm: drawnStack,
    topTubeSlopeDeg: category.topTubeSlopeDeg,
    geometry: category.geometry,
    saddleHeightMm: effSaddleCm * 10,
    crankLengthMm: effCrank,
    bodyHeightMm: fit.heightCm * 10,
    inseamMm: fit.inseamCm * 10,
    armLengthMm: fit.armCm * 10,
    wheelRadiusMm: effWheel.outerMm / 2,
    wheelLabel: effWheel.label,
  };

  return (
    <div className="fs-workbench">
      <div className="fs-controls">
        <div className="fs-toolbar">
          <span className="fs-toolbar-hint">
            Every value is editable — set the ones you know, the rest are recommended.
          </span>
          <button
            type="button"
            className="fs-clear-all"
            onClick={clearAll}
            disabled={!anySet}
            title="Reset every field to its recommended value"
          >
            Clear all
          </button>
        </div>
        <Section
          title="Rider"
          info={
            <>
              Everything on this page is one linked model — set any measurement and
              the rest fill in with a best guess (shown greyed as an{" "}
              <strong>≈ estimate</strong> until you type over it). Enter a body height
              and it proposes inseam, arm, frame size and reach &amp; stack; enter a
              frame or a reach &amp; stack instead and it works back to the rider.
              These are <strong>starting targets</strong>, not prescriptions —
              brand geometry, flexibility and preference all shift them.{" "}
              <strong>Gender</strong> isn't asked; what matters is the actual leg,
              torso and arm lengths, which these inputs capture. Measured inseam and
              arm beat the height estimate.
            </>
          }
        >
          <div className="grid">
            <Field label="Body height" dotColor={HEIGHT_COLOR} {...link("body")}>
              {input("height", fit.heightCm, { min: 100, max: 210, suffix: "cm" })}
            </Field>
            <Field
              label="Cycling inseam"
              hint="barefoot, crotch to floor"
              dotColor={INSEAM_COLOR}
              {...link("inseam")}
            >
              {input("inseam", fit.inseamCm, { min: 38, max: 110, suffix: "cm" })}
            </Field>
            <Field
              label="Arm length"
              hint="shoulder (acromion) to wrist"
              dotColor={ARM_COLOR}
              {...link("arm")}
            >
              {input("arm", fit.armCm, { min: 28, max: 90, suffix: "cm" })}
            </Field>
          </div>
        </Section>

        <Section
          title="Bike category"
          info={
            <>
              A category merges frame style (how it's sized) with riding position
              (how low &amp; long you sit): it sets the size multiplier, the
              reach/stack position and the top-tube slope. <strong>Leg proportion</strong>{" "}
              only links height and inseam when one is estimated from the other.
            </>
          }
        >
          <div className="grid">
            <Field label="Category" hint="how it's sized and how you sit on it">
              <Select value={categoryId} onChange={setCategoryId} options={CATEGORY_OPTIONS} />
            </Field>
            <Field label="Leg proportion" hint="links height ↔ inseam when estimated">
              <Select
                value={String(legProp)}
                onChange={(v) => setLegProp(parseFloat(v))}
                options={LEG_PROPORTIONS.map((p) => ({ value: String(p.value), label: p.label }))}
              />
            </Field>
          </div>
          <Note>
            {category.blurb}
            <span className="note-sizing">
              <strong>Sizing:</strong> {category.sizing}
            </span>
          </Note>
        </Section>

        <Section
          title="Frame & fit — reach, stack, size"
          info={
            <>
              <strong>Reach</strong> (horizontal) and <strong>stack</strong> (vertical)
              are the bottom-bracket-to-head-tube-top distances — the brand-independent
              way to compare frames, because unlike a seat-tube "size" they don't change
              when the top tube slopes. The <strong>frame size</strong> is the traditional
              nominal (inseam × the category multiplier); it's a label, so the diagram
              shows both the actual and effective seat tube in green. Set any of these to
              solve back to a rider, or read them off the body inputs above.
            </>
          }
        >
          <div className="grid">
            <Field
              label="Frame size"
              hint="nominal seat tube, centre-to-top"
              dotColor={SIZE_COLOR}
              {...link("size")}
            >
              {input("frame", fit.frameCm, {
                min: sizeUnit === "in" ? 8 : 20,
                max: sizeUnit === "in" ? 25 : 65,
                decimals: sizeUnit === "in" ? 1 : 0,
                value: Number.isFinite(vals.frame) ? frameToDisplay(vals.frame) : NaN,
                estimate: Number(
                  frameToDisplay(fit.frameCm).toFixed(sizeUnit === "in" ? 1 : 0),
                ),
                onChange: (v) => edit("frame", frameFromDisplay(v)),
                suffix: (
                  <select
                    className="unit-suffix"
                    value={sizeUnit}
                    onChange={(e) => setSizeUnit(e.target.value as "cm" | "in")}
                    aria-label="Size unit"
                  >
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </select>
                ),
              })}
            </Field>
            <Field label="Reach" dotColor={REACH_COLOR} {...link("reach")}>
              {input("reach", fit.targets.reachMm, { min: 250, max: 520, step: 5, suffix: "mm" })}
            </Field>
            <Field label="Stack" dotColor={STACK_COLOR} {...link("stack")}>
              {input("stack", fit.targets.stackMm, { min: 400, max: 750, step: 5, suffix: "mm" })}
            </Field>
            <Field
              label="Wheel size"
              hint={`ISO ${effWheel.isoMm} mm`}
              dotColor={WHEEL_COLOR}
              {...link("wheel")}
            >
              <Select
                value={wheelSel}
                onChange={setWheelSel}
                options={[
                  { value: "", label: `Auto — ${fit.wheel.label}` },
                  ...WHEELS.map((w) => ({ value: w.label, label: `${w.label} (ISO ${w.isoMm})` })),
                ]}
              />
            </Field>
          </div>
          <div className="results">
            <Result label="Nominal" value={fit.frame.nominalSize} />
            <Result
              label="Stack : reach"
              value={
                <>
                  {fit.targets.stackReach.toFixed(2)}
                  <span className="result-sub">higher = more upright</span>
                </>
              }
            />
            <Result label="Saddle height (BB→top)" value={`${effSaddleCm.toFixed(1)} cm`} />
          </div>
          <Note>
            <strong>Reach &amp; stack</strong> show a typical band of ±{" "}
            {round(fit.targets.reachRangeMm[1] - fit.targets.reachMm)}/±{" "}
            {round(fit.targets.stackRangeMm[1] - fit.targets.stackMm)} mm around the
            target — trim small gaps with stem length and spacers.
            <span className="note-sizing">
              <strong>Wheels:</strong> {effWheel.note}
            </span>
          </Note>
        </Section>

        <Section
          title="Cockpit & crank"
          info={
            <>
              The stem, spacers and crank are proposed for this category and size — a
              typical setup, not a spec — but stay editable, so you can see how (say) a
              longer stem or more spacers change the drawn riding position. A bigger
              frame gets a longer stem and fewer spacers, and vice-versa. Stem angle is
              the printed stem spec — degrees from perpendicular to the steerer (the head
              tube), positive raising the bar — so a stem near −18° sits roughly level;
              stem height is the spacer stack, or how far a quill is raised. Clear a field
              to return to the suggestion.
            </>
          }
        >
          <div className="grid">
            <Field label="Stem length" dotColor={CRANK_COLOR} {...link("crank")}>
              {input("stemLen", recCockpit.stemLenMm, { min: 35, max: 150, step: 5, suffix: "mm" })}
            </Field>
            <Field label="Stem angle" hint="from perpendicular to the steerer">
              {input("stemAngle", recCockpit.stemRiseDeg, { min: -30, max: 45, suffix: "°" })}
            </Field>
            <Field label="Stem height (spacers)">
              {input("spacer", recCockpit.spacerMm, { min: 0, max: 80, step: 5, suffix: "mm" })}
            </Field>
            <Field label="Crank length" dotColor={CRANK_COLOR} {...link("crank")}>
              {input("crank", fit.crank.suggestedMm, { min: 100, max: 200, step: 2.5, suffix: "mm" })}
            </Field>
          </div>
        </Section>
      </div>

      {/* Explainer: reach (red) & stack (blue) from the BB to the head-tube top,
          the actual vs effective seat-tube length (two greens), and an
          approximate rider posed on the bike. Sits in a right-hand rail on wide
          screens and drops below the controls when narrow. */}
      <figure className="fs-diagram fs-viz">
        <FrameGeometryDiagram
          {...geom}
          cockpit={effCockpit}
          highlight={hl}
          posture={posture}
          armOver={armOver}
        />
        <div className="fs-posture">
          <span>Arms straight</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={posture}
            onChange={(e) => setPosture(parseFloat(e.target.value))}
            aria-label="Seated posture, from arms straight to forearm level"
          />
          <span>Forearm level</span>
        </div>
        <figcaption className="fs-caption">
          <span style={{ color: REACH_COLOR }}>■</span> Reach ·{" "}
          <span style={{ color: STACK_COLOR }}>■</span> Stack ·{" "}
          <span style={{ color: SIZE_COLOR }}>■</span> Actual /{" "}
          <span style={{ color: "color-mix(in srgb, var(--diag-green) 55%, var(--panel-2))" }}>■</span>{" "}
          effective seat tube ·{" "}
          <span style={{ color: CRANK_COLOR }}>■</span> Crank ·{" "}
          <span style={{ color: WHEEL_COLOR }}>■</span> Wheel size
          <br />
          <span style={{ color: HEIGHT_COLOR }}>■</span> Body height ·{" "}
          <span style={{ color: INSEAM_COLOR }}>■</span> Cycling inseam ·{" "}
          <span style={{ color: ARM_COLOR }}>■</span> Arm length · the rider on the bike is an
          approximate riding position
        </figcaption>
      </figure>
    </div>
  );
}
