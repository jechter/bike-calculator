import { useState } from "react";
import {
  frameSizeFromInseam,
  fitFromFrameSize,
  inseamFromHeight,
  suggestCrankLength,
  LEG_PROPORTIONS,
  type FrameStyle,
} from "../lib/frameSize";
import { Field, NumberInput, Select, SwatchSelect, Result, Section } from "./ui";
import frameSizeDiagram from "../assets/frame-size-diagram.png";

const STYLE_OPTIONS: Array<{ value: FrameStyle; label: string }> = [
  { value: "road", label: "Road / Endurance" },
  { value: "gravel", label: "Gravel / Cross" },
  { value: "touring", label: "Touring" },
  { value: "hybrid", label: "Hybrid / City" },
  { value: "mtb", label: "Mountain" },
];

type Method = "inseam" | "height" | "frameSize";

// Tie each measurement back to the explainer diagram at the bottom of the page:
// rider height is blue, inseam green, frame height red.
const METHOD_COLOR: Record<Method, string> = {
  inseam: "var(--diag-green)",
  height: "var(--diag-blue)",
  frameSize: "var(--diag-red)",
};

// One entry point for both directions: the first group sizes a bike for a rider,
// the second runs it backwards to find who an existing frame fits.
// A colour square prefixes each option in the open list (SwatchSelect); the
// folded control shows just the label, tinted by the accent border instead.
const METHOD_OPTIONS = [
  {
    label: "Find a frame for a rider",
    options: [
      { value: "inseam", label: "Inseam (best)", color: METHOD_COLOR.inseam },
      { value: "height", label: "Body height", color: METHOD_COLOR.height },
    ],
  },
  {
    label: "Find a rider for a frame",
    options: [
      { value: "frameSize", label: "Frame size (seat tube c–t)", color: METHOD_COLOR.frameSize },
    ],
  },
];

export function FrameSize() {
  const [method, setMethod] = useState<Method>("inseam");
  const [inseam, setInseam] = useState(82);
  const [height, setHeight] = useState(178);
  const [legProp, setLegProp] = useState(0.47);
  const [style, setStyle] = useState<FrameStyle>("road");
  const [sizeUnit, setSizeUnit] = useState<"cm" | "in">("cm");
  const [frameSize, setFrameSize] = useState(56);

  const reverse = method === "frameSize";

  // Forward: inseam or height (translated to an approximate inseam so both use the
  // same style-aware logic).
  const effectiveInseam = method === "height" ? inseamFromHeight(height, legProp) : inseam;
  const result = frameSizeFromInseam({ inseamCm: effectiveInseam, style });
  const crank = suggestCrankLength(effectiveInseam);

  // Reverse: a frame you already have → the rider it fits.
  const frameCm = sizeUnit === "in" ? frameSize * 2.54 : frameSize;
  const fit = fitFromFrameSize({ frameCm, style, legProportion: legProp });

  return (
    <>
      <Section
        title="Input"
        info={
          reverse ? (
            <>
              Enter the frame size as you read it at the bench — seat-tube length in
              cm for most bikes, or inches for an MTB frame. Measure the seat tube
              centre-to-top if the label is missing or you don't trust it. The result
              is a rider band to match against the waiting list;{" "}
              <strong>inseam</strong> is the reliable match, height depends on leg
              proportion.
            </>
          ) : (
            <>
              These are <strong>starting estimates</strong>, not prescriptions. Fit
              depends on torso/arm length, riding style and brand geometry. Confirm
              on a test ride. Prefer inseam over height when you have it.{" "}
              <strong>Gender</strong> isn't asked directly: what actually matters is
              leg-length proportion (on average women have proportionally longer legs
              for a given height) — set that below when sizing from height. It has no
              effect once you measure the inseam.
            </>
          )
        }
      >
        <div className="grid">
          <Field label="Method">
            <SwatchSelect
              value={method}
              onChange={(v) => setMethod(v as Method)}
              options={METHOD_OPTIONS}
              accentColor={METHOD_COLOR[method]}
            />
          </Field>

          {method === "inseam" && (
            <Field
              label="Cycling inseam"
              hint="barefoot, crotch to floor, book pulled up firm"
              dotColor={METHOD_COLOR.inseam}
            >
              <NumberInput value={inseam} onChange={setInseam} suffix="cm" min={50} max={110} />
            </Field>
          )}

          {method === "height" && (
            <>
              <Field label="Body height" dotColor={METHOD_COLOR.height}>
                <NumberInput value={height} onChange={setHeight} suffix="cm" min={140} max={210} />
              </Field>
              <Field label="Leg proportion" hint="varies by build / on average by sex">
                <Select
                  value={String(legProp)}
                  onChange={(v) => setLegProp(parseFloat(v))}
                  options={LEG_PROPORTIONS.map((p) => ({ value: String(p.value), label: p.label }))}
                />
              </Field>
              <Field
                label="Est. inseam"
                hint={`≈ ${Math.round(legProp * 100)}% of height`}
                dotColor={METHOD_COLOR.inseam}
              >
                <div className="static-value">≈ {effectiveInseam.toFixed(0)} cm</div>
              </Field>
            </>
          )}

          {method === "frameSize" && (
            <>
              <Field label="Frame size" hint="seat tube, centre-to-top" dotColor={METHOD_COLOR.frameSize}>
                <NumberInput
                  value={frameSize}
                  onChange={setFrameSize}
                  suffix={sizeUnit}
                  min={sizeUnit === "in" ? 12 : 30}
                  max={sizeUnit === "in" ? 25 : 65}
                />
              </Field>
              <Field label="Size unit">
                <Select
                  value={sizeUnit}
                  onChange={(v) => setSizeUnit(v as "cm" | "in")}
                  options={[
                    { value: "cm", label: "cm" },
                    { value: "in", label: "inches" },
                  ]}
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

        {/* Frame style always on its own row, separate from the rider inputs */}
        <div className="rows">
          <Field label="Frame style">
            <Select value={style} onChange={setStyle} options={STYLE_OPTIONS} />
          </Field>
        </div>
      </Section>

      {reverse ? (
        <Section
          title="Who it fits"
          info={
            <>
              The frame maps back to a <strong>rider height</strong> band and{" "}
              <strong>cycling inseam</strong> band — call people in that range off the
              list. Height is height ÷ leg proportion, so it slides if the rider's legs
              are longer or shorter than average; the inseam band doesn't. Someone
              between sizes can go either way (smaller = nimbler, larger = roomier),
              so treat the edges as soft.
            </>
          }
        >
          <div className="results">
            <Result
              label="Rider height"
              dotColor="var(--diag-blue)"
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
              dotColor="var(--diag-green)"
              value={`${fit.inseamRangeCm[0].toFixed(0)}–${fit.inseamRangeCm[1].toFixed(0)} cm`}
            />
            <Result label="Nominal" value={fit.nominalSize} />
            <Result label="Saddle height (BB→top)" value={`${fit.saddleHeightCm.toFixed(1)} cm`} />
          </div>
        </Section>
      ) : (
        <>
          <Section
            title="Recommendation"
            info={
              <>
                {method === "height" && (
                  <>
                    Sized from the inseam estimated above, then treated like a measured
                    inseam — measuring is more accurate.{" "}
                  </>
                )}
                Saddle height is the LeMond estimate (inseam × 0.883), measured from
                the centre of the bottom bracket to the top of the saddle along the
                seat tube. Standover should sit a few cm below your inseam (more for
                MTB).
              </>
            }
          >
            <div className="results">
              <Result
                label="Frame size (seat tube c–t)"
                dotColor="var(--diag-red)"
                value={
                  <>
                    {result.frameCm.toFixed(0)} cm
                    {style === "mtb" && (
                      <span className="result-sub">{result.frameInches.toFixed(1)} in</span>
                    )}
                  </>
                }
                big
              />
              <Result
                label="Range"
                dotColor="var(--diag-red)"
                value={
                  <>
                    {result.frameCmRange[0].toFixed(0)}–{result.frameCmRange[1].toFixed(0)} cm
                    {style === "mtb" && (
                      <span className="result-sub">
                        {(result.frameCmRange[0] / 2.54).toFixed(1)}–
                        {(result.frameCmRange[1] / 2.54).toFixed(1)} in
                      </span>
                    )}
                  </>
                }
              />
              <Result label="Nominal" value={result.nominalSize} />
              <Result
                label="Saddle height (BB→top)"
                value={`${result.saddleHeightCm.toFixed(1)} cm`}
              />
            </div>
          </Section>

          <Section
            title="Crank length suggestion"
            info={
              <>
                Published crank formulas disagree noticeably, so treat this as a
                starting range and lean on fit/preference. Shorter cranks are a current
                trend; also mind pedal/ground clearance and knee comfort.
              </>
            }
          >
            <div className="results">
              <Result label="Suggested (nearest size)" value={`${crank.suggestedMm} mm`} big />
              <Result
                label="Rule-of-thumb range"
                value={`${crank.rangeMm[0].toFixed(0)}–${crank.rangeMm[1].toFixed(0)} mm`}
              />
            </div>
          </Section>
        </>
      )}

      {/* Explainer: how frame height (red), rider height (blue) and inseam (green) relate */}
      <figure className="fs-diagram">
        <img
          src={frameSizeDiagram}
          alt="Diagram showing frame height (seat tube centre-to-top), rider height and inseam height"
        />
      </figure>
    </>
  );
}
