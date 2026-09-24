import { useState } from "react";
import {
  frameSizeFromInseam,
  fitFromFrameSize,
  fitTargets,
  inseamFromHeight,
  armFromHeightInseam,
  suggestCrankLength,
  findCategory,
  FRAME_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  LEG_PROPORTIONS,
} from "../lib/frameSize";
import { Field, NumberInput, Select, Note, Result, Section } from "./ui";
import { FrameGeometryDiagram, type HighlightKey } from "./FrameGeometryDiagram";

type Method = "fit" | "frame";

const METHOD_OPTIONS: Array<{ value: Method; label: string }> = [
  { value: "fit", label: "Size a bike for a rider" },
  { value: "frame", label: "Identify a frame you have" },
];

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

const round = (n: number) => Math.round(n);

export function FrameSize() {
  const [method, setMethod] = useState<Method>("fit");
  const [height, setHeight] = useState(178);
  // Inseam and arm start empty; we fall back to a height-based estimate (shown
  // greyed as the field placeholder) until the user types a measured value.
  const [inseam, setInseam] = useState(NaN);
  const [arm, setArm] = useState(NaN);
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);

  // Reverse mode: a frame you already have → the rider it fits.
  const [frameSize, setFrameSize] = useState(56);
  const [sizeUnit, setSizeUnit] = useState<"cm" | "in">("cm");
  const [legProp, setLegProp] = useState(0.47);

  // Which measurement is hovered/edited in the UI (highlighted in the diagram).
  const [hl, setHl] = useState<HighlightKey | null>(null);
  const link = (k: HighlightKey) => ({ activate: () => setHl(k), deactivate: () => setHl(null) });

  const reverse = method === "frame";
  const category = findCategory(categoryId);

  const estInseam = round(inseamFromHeight(height));
  const effInseam = Number.isFinite(inseam) ? inseam : estInseam;
  // Arm is estimated from height *and* the (effective) inseam, so typing a real
  // inseam sharpens the arm guess too.
  const estArm = round(armFromHeightInseam(height, effInseam));
  const effArm = Number.isFinite(arm) ? arm : estArm;

  // Forward: fit targets + a nominal size, both from the same body inputs.
  const targets = fitTargets({ heightCm: height, inseamCm: effInseam, armCm: effArm, category });
  const size = frameSizeFromInseam(effInseam, category);
  const crank = suggestCrankLength(effInseam);

  // Reverse: frame → rider band, and a representative rider for the diagram.
  const frameCm = sizeUnit === "in" ? frameSize * 2.54 : frameSize;
  const fit = fitFromFrameSize({ frameCm, category, legProportion: legProp });

  // The geometry diagram always reflects a concrete reach/stack. In reverse mode
  // there are no body inputs, so illustrate the central rider this frame fits.
  const geom = reverse
    ? (() => {
        const t = fitTargets({
          heightCm: fit.heightCm,
          inseamCm: fit.inseamCm,
          armCm: armFromHeightInseam(fit.heightCm, fit.inseamCm),
          category,
        });
        return {
          reachMm: t.reachMm,
          stackMm: t.stackMm,
          topTubeSlopeDeg: category.topTubeSlopeDeg,
          geometry: category.geometry,
          saddleHeightMm: fit.saddleHeightCm * 10,
          crankLengthMm: suggestCrankLength(fit.inseamCm).suggestedMm,
          bodyHeightMm: fit.heightCm * 10,
          inseamMm: fit.inseamCm * 10,
          armLengthMm: armFromHeightInseam(fit.heightCm, fit.inseamCm) * 10,
        };
      })()
    : {
        reachMm: targets.reachMm,
        stackMm: targets.stackMm,
        topTubeSlopeDeg: category.topTubeSlopeDeg,
        geometry: category.geometry,
        saddleHeightMm: targets.saddleHeightCm * 10,
        crankLengthMm: crank.suggestedMm,
        bodyHeightMm: height * 10,
        inseamMm: effInseam * 10,
        armLengthMm: effArm * 10,
      };

  return (
    <div className="fs-workbench">
      <div className="fs-controls">
        <Section
          title="Input"
          info={
            reverse ? (
              <>
                Enter the frame size as you read it at the bench — seat-tube length
                in cm for most bikes, or inches for an MTB frame. Measure the seat
                tube centre-to-top if the label is missing. The result is a rider
                band to match against the waiting list; <strong>inseam</strong> is the
                reliable match, height depends on leg proportion.
              </>
            ) : (
              <>
                Enter measured body dimensions — the more accurate they are, the more
                useful the result. Inseam and arm can be left blank to use an estimate
                from height (shown greyed), but measuring is far better. These are{" "}
                <strong>starting targets</strong>, not prescriptions: brand geometry,
                flexibility and preference all shift them, so confirm on a fit.{" "}
                <strong>Gender</strong> isn't asked — what matters is the actual leg,
                torso and arm lengths, which these inputs already capture.
              </>
            )
          }
        >
          <div className="grid">
            <Field label="Method">
              <Select value={method} onChange={(v) => setMethod(v as Method)} options={METHOD_OPTIONS} />
            </Field>

            {!reverse && (
              <>
                <Field label="Body height" dotColor={HEIGHT_COLOR} {...link("body")}>
                  <NumberInput value={height} onChange={setHeight} suffix="cm" min={140} max={210} />
                </Field>
                <Field
                  label="Cycling inseam"
                  hint="barefoot, crotch to floor — greyed value is estimated from height"
                  dotColor={INSEAM_COLOR}
                  {...link("inseam")}
                >
                  <NumberInput
                    value={inseam}
                    onChange={setInseam}
                    min={50}
                    max={110}
                    suffix="cm"
                    estimate={estInseam}
                  />
                </Field>
                <Field
                  label="Arm length"
                  hint="shoulder (acromion) to wrist — greyed value is estimated from height & inseam"
                  dotColor={ARM_COLOR}
                  {...link("arm")}
                >
                  <NumberInput
                    value={arm}
                    onChange={setArm}
                    min={40}
                    max={90}
                    suffix="cm"
                    estimate={estArm}
                  />
                </Field>
              </>
            )}

            {reverse && (
              <>
                <Field label="Frame size" hint="seat tube, centre-to-top" dotColor={SIZE_COLOR} {...link("size")}>
                  <NumberInput
                    value={frameSize}
                    onChange={setFrameSize}
                    min={sizeUnit === "in" ? 12 : 30}
                    max={sizeUnit === "in" ? 25 : 65}
                    suffix={
                      <select
                        className="unit-suffix"
                        value={sizeUnit}
                        onChange={(e) => setSizeUnit(e.target.value as "cm" | "in")}
                        aria-label="Size unit"
                      >
                        <option value="cm">cm</option>
                        <option value="in">in</option>
                      </select>
                    }
                  />
                </Field>
                <Field label="Leg proportion" hint="shifts the height band only">
                  <Select
                    value={String(legProp)}
                    onChange={(v) => setLegProp(parseFloat(v))}
                    options={LEG_PROPORTIONS.map((p) => ({ value: String(p.value), label: p.label }))}
                  />
                </Field>
              </>
            )}
          </div>

          {/* Bike category merges frame style + riding position: it sets the size
              multiplier, the reach/stack position and the top-tube slope. */}
          <div className="rows">
            <Field label="Bike category" hint="how it's sized and how you sit on it">
              <Select value={categoryId} onChange={setCategoryId} options={CATEGORY_OPTIONS} />
            </Field>
          </div>
          <Note>
            {category.blurb}
            <span className="note-sizing">
              <strong>Sizing:</strong> {category.sizing}
            </span>
          </Note>
        </Section>

        {reverse ? (
          <Section
            title="Who it fits"
            info={
              <>
                The frame maps back to a <strong>rider height</strong> band and{" "}
                <strong>cycling inseam</strong> band — call people in that range off the
                list. Height is inseam ÷ leg proportion, so it slides if the rider's legs
                are longer or shorter than average; the inseam band doesn't. Someone
                between sizes can go either way (smaller = nimbler, larger = roomier), so
                treat the edges as soft.
              </>
            }
          >
            <div className="results">
              <Result
                label="Rider height"
                dotColor={HEIGHT_COLOR}
                {...link("body")}
                value={
                  <>
                    {fit.heightRangeCm[0].toFixed(0)}–{fit.heightRangeCm[1].toFixed(0)} cm
                    <span className="result-sub">≈ {fit.heightCm.toFixed(0)} cm centre</span>
                  </>
                }
                big
              />
              <Result
                label="Cycling inseam"
                dotColor={INSEAM_COLOR}
                {...link("inseam")}
                value={`${fit.inseamRangeCm[0].toFixed(0)}–${fit.inseamRangeCm[1].toFixed(0)} cm`}
              />
              <Result label="Nominal" value={fit.nominalSize} />
              <Result label="Saddle height (BB→top)" value={`${fit.saddleHeightCm.toFixed(1)} cm`} />
            </div>
          </Section>
        ) : (
          <>
            <Section
              title="Fit targets — reach & stack"
              info={
                <>
                  <strong>Reach</strong> (horizontal) and <strong>stack</strong> (vertical)
                  are the distance from the bottom bracket to the top of the head tube.
                  They're the brand-independent way to compare frames, because — unlike a
                  seat-tube "size" — they don't change when the top tube slopes. These
                  targets assume a typical stem, a small spacer stack and a normal saddle
                  setback, so read them as a starting window (± ~1 size) and fine-tune with
                  stem length and spacers, or a proper fit.
                </>
              }
            >
              <div className="results">
                <Result
                  label="Reach"
                  dotColor={REACH_COLOR}
                  {...link("reach")}
                  value={
                    <>
                      {round(targets.reachMm)} mm
                      <span className="result-sub">
                        {round(targets.reachRangeMm[0])}–{round(targets.reachRangeMm[1])} mm
                      </span>
                    </>
                  }
                  big
                />
                <Result
                  label="Stack"
                  dotColor={STACK_COLOR}
                  {...link("stack")}
                  value={
                    <>
                      {round(targets.stackMm)} mm
                      <span className="result-sub">
                        {round(targets.stackRangeMm[0])}–{round(targets.stackRangeMm[1])} mm
                      </span>
                    </>
                  }
                  big
                />
                <Result
                  label="Stack : reach"
                  value={
                    <>
                      {targets.stackReach.toFixed(2)}
                      <span className="result-sub">higher = more upright</span>
                    </>
                  }
                />
                <Result label="Saddle height (BB→top)" value={`${targets.saddleHeightCm.toFixed(1)} cm`} />
              </div>
            </Section>

            <Section title="Frame size">
              <div className="results">
                <Result
                  label="Frame size"
                  dotColor={SIZE_COLOR}
                  {...link("size")}
                  value={
                    <>
                      {size.frameCm.toFixed(0)} cm
                      {category.showInches && (
                        <span className="result-sub">{size.frameInches.toFixed(1)} in</span>
                      )}
                    </>
                  }
                  big
                />
                <Result
                  label="Range"
                  dotColor={SIZE_COLOR}
                  value={`${size.frameCmRange[0].toFixed(0)}–${size.frameCmRange[1].toFixed(0)} cm`}
                />
                <Result label="Nominal" value={size.nominalSize} />
              </div>
              <Note>
                This is a <strong>nominal size</strong> (inseam × {category.sizeMult}) — the
                traditional ballpark for finding the right size to try. Treat it as a label,
                not a measurement: a manufacturer's "size" number usually sits somewhere
                between the <em>actual</em> seat-tube length (shorter on a sloped frame) and
                the <em>effective/virtual</em> length (to a horizontal top tube) — the
                diagram shows both in green. Some brands quote one edge, some the other, some
                a value in between, and many are moving to S/M/L for exactly this reason. To
                compare real frames, use <strong>reach & stack</strong> above.
              </Note>
            </Section>

            <Section
              title="Crank length suggestion"
              info={
                <>
                  Published crank formulas disagree noticeably, so treat this as a starting
                  range and lean on fit/preference. Shorter cranks are a current trend; also
                  mind pedal/ground clearance and knee comfort.
                </>
              }
            >
              <div className="results">
                <Result label="Suggested (nearest size)" value={`${crank.suggestedMm} mm`} big dotColor={CRANK_COLOR} {...link("crank")} />
                <Result
                  label="Rule-of-thumb range"
                  value={`${crank.rangeMm[0].toFixed(0)}–${crank.rangeMm[1].toFixed(0)} mm`}
                />
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Explainer: reach (red) & stack (blue) from the BB to the head-tube top,
          the actual vs effective seat-tube length (two greens), and an
          approximate rider posed on the bike. Sits in a right-hand rail on wide
          screens and drops below the controls when narrow. */}
      <figure className="fs-diagram fs-viz">
        <FrameGeometryDiagram {...geom} categoryId={category.id} highlight={hl} />
        <figcaption className="fs-caption">
          <span style={{ color: REACH_COLOR }}>■</span> Reach ·{" "}
          <span style={{ color: STACK_COLOR }}>■</span> Stack ·{" "}
          <span style={{ color: SIZE_COLOR }}>■</span> Actual /{" "}
          <span style={{ color: "color-mix(in srgb, var(--diag-green) 55%, var(--panel-2))" }}>■</span>{" "}
          effective seat tube ·{" "}
          <span style={{ color: CRANK_COLOR }}>■</span> Crank
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
