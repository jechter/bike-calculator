import { useState } from "react";
import {
  frameSizeFromInseam,
  inseamFromHeight,
  suggestCrankLength,
  LEG_PROPORTIONS,
  type FrameStyle,
} from "../lib/frameSize";
import { Field, NumberInput, Select, Result, Section } from "./ui";

export function FrameSize() {
  const [mode, setMode] = useState<"inseam" | "height">("inseam");
  const [inseam, setInseam] = useState(82);
  const [height, setHeight] = useState(178);
  const [legProp, setLegProp] = useState(0.47);
  const [style, setStyle] = useState<FrameStyle>("road");

  // Height is translated to an approximate inseam so both methods use the same
  // (style-aware) logic.
  const effectiveInseam = mode === "inseam" ? inseam : inseamFromHeight(height, legProp);
  const result = frameSizeFromInseam({ inseamCm: effectiveInseam, style });
  const crank = suggestCrankLength(effectiveInseam);

  const styleOptions: Array<{ value: FrameStyle; label: string }> = [
    { value: "road", label: "Road / Endurance" },
    { value: "gravel", label: "Gravel / Cross" },
    { value: "touring", label: "Touring" },
    { value: "hybrid", label: "Hybrid / City" },
    { value: "mtb", label: "Mountain" },
  ];

  return (
    <>
      <Section
        title="Input"
        info={
          <>
            These are <strong>starting estimates</strong>, not prescriptions. Fit
            depends on torso/arm length, riding style and brand geometry. Confirm
            on a test ride. Prefer inseam over height when you have it.{" "}
            <strong>Gender</strong> isn't asked directly: what actually matters is
            leg-length proportion (on average women have proportionally longer legs
            for a given height) — set that below when sizing from height. It has no
            effect once you measure the inseam.
          </>
        }
      >
        <div className="grid">
          <Field label="Method">
            <Select
              value={mode}
              onChange={(v) => setMode(v as "inseam" | "height")}
              options={[
                { value: "inseam", label: "Inseam (best)" },
                { value: "height", label: "Body height" },
              ]}
            />
          </Field>
          {mode === "inseam" ? (
            <Field label="Cycling inseam" hint="barefoot, crotch to floor, book pulled up firm">
              <NumberInput value={inseam} onChange={setInseam} suffix="cm" min={50} max={110} />
            </Field>
          ) : (
            <>
              <Field label="Body height">
                <NumberInput value={height} onChange={setHeight} suffix="cm" min={140} max={210} />
              </Field>
              <Field label="Leg proportion" hint="varies by build / on average by sex">
                <Select
                  value={String(legProp)}
                  onChange={(v) => setLegProp(parseFloat(v))}
                  options={LEG_PROPORTIONS.map((p) => ({ value: String(p.value), label: p.label }))}
                />
              </Field>
              <Field label="Est. inseam" hint={`≈ ${Math.round(legProp * 100)}% of height`}>
                <div className="static-value">≈ {effectiveInseam.toFixed(0)} cm</div>
              </Field>
            </>
          )}
          <Field label="Frame style">
            <Select value={style} onChange={setStyle} options={styleOptions} />
          </Field>
        </div>
      </Section>

      <Section
        title="Recommendation"
        info={
          <>
            {mode === "height" && (
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
            label={style === "mtb" ? "Frame size" : "Frame size (seat tube c–t)"}
            value={
              style === "mtb"
                ? `${result.frameInches.toFixed(1)} in`
                : `${result.frameCm.toFixed(0)} cm`
            }
            big
          />
          <Result
            label="Range"
            value={
              style === "mtb"
                ? `${(result.frameCmRange[0] / 2.54).toFixed(1)}–${(
                    result.frameCmRange[1] / 2.54
                  ).toFixed(1)} in`
                : `${result.frameCmRange[0].toFixed(0)}–${result.frameCmRange[1].toFixed(0)} cm`
            }
          />
          <Result label="Nominal" value={result.nominalSize} />
          <Result label="Saddle height (BB→top)" value={`${result.saddleHeightCm.toFixed(1)} cm`} />
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
  );
}
