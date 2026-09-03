import { useMemo, useState } from "react";
import {
  spokeLength,
  readingToKgf,
  kgfToN,
  EXAMPLE_TENSION_CURVES,
} from "../lib/spokes";
import { Field, NumberInput, Select, Result, Note, Section } from "./ui";

export function WheelBuilding() {
  const [erd, setErd] = useState(602);
  const [spokes, setSpokes] = useState(32);
  const [holeDia, setHoleDia] = useState(2.6);

  const [leftFlange, setLeftFlange] = useState(45);
  const [leftOffset, setLeftOffset] = useState(34);
  const [leftCross, setLeftCross] = useState(3);

  const [rightFlange, setRightFlange] = useState(45);
  const [rightOffset, setRightOffset] = useState(17.5);
  const [rightCross, setRightCross] = useState(3);

  const left = useMemo(
    () =>
      spokeLength({
        erdMm: erd,
        spokeCount: spokes,
        cross: leftCross,
        spokeHoleDiameterMm: holeDia,
        side: { flangeDiameterMm: leftFlange, flangeOffsetMm: leftOffset },
      }),
    [erd, spokes, leftCross, holeDia, leftFlange, leftOffset],
  );
  const right = useMemo(
    () =>
      spokeLength({
        erdMm: erd,
        spokeCount: spokes,
        cross: rightCross,
        spokeHoleDiameterMm: holeDia,
        side: { flangeDiameterMm: rightFlange, flangeOffsetMm: rightOffset },
      }),
    [erd, spokes, rightCross, holeDia, rightFlange, rightOffset],
  );

  // Tension converter
  const [curveIdx, setCurveIdx] = useState(0);
  const [reading, setReading] = useState(20);
  const curve = EXAMPLE_TENSION_CURVES[curveIdx];
  const kgf = readingToKgf(curve, reading);

  const crossOptions = [0, 1, 2, 3, 4].map((k) => ({
    value: k,
    label: k === 0 ? "Radial (0×)" : `${k}-cross`,
  }));

  return (
    <>
      <Section title="Rim & spokes">
        <div className="grid">
          <Field label="ERD (effective rim diameter)" hint="the #1 error source — measure carefully">
            <NumberInput value={erd} onChange={setErd} suffix="mm" min={200} max={720} />
          </Field>
          <Field label="Spoke count (total)">
            <NumberInput value={spokes} onChange={setSpokes} min={8} step={2} />
          </Field>
          <Field label="Flange hole diameter">
            <NumberInput value={holeDia} onChange={setHoleDia} suffix="mm" step={0.1} />
          </Field>
        </div>
      </Section>

      <Section title="Left / non-drive flange">
        <div className="grid">
          <Field label="Flange diameter" hint="circle through spoke holes (PCD)">
            <NumberInput value={leftFlange} onChange={setLeftFlange} suffix="mm" />
          </Field>
          <Field label="Centre-to-flange offset">
            <NumberInput value={leftOffset} onChange={setLeftOffset} suffix="mm" />
          </Field>
          <Field label="Lacing">
            <Select value={leftCross} onChange={setLeftCross} options={crossOptions} />
          </Field>
          <Result label="Left spoke length" value={`${left.toFixed(1)} mm`} big />
        </div>
      </Section>

      <Section title="Right / drive flange">
        <div className="grid">
          <Field label="Flange diameter">
            <NumberInput value={rightFlange} onChange={setRightFlange} suffix="mm" />
          </Field>
          <Field label="Centre-to-flange offset">
            <NumberInput value={rightOffset} onChange={setRightOffset} suffix="mm" />
          </Field>
          <Field label="Lacing">
            <Select value={rightCross} onChange={setRightCross} options={crossOptions} />
          </Field>
          <Result label="Right spoke length" value={`${right.toFixed(1)} mm`} big />
        </div>
        <Note>
          Front and rear (and the two sides of a dished wheel) usually differ.
          When between sizes most builders prefer ~1 mm short over long. Confirm
          your ERD convention — a 1–2 mm error here is the usual cause of wrong
          spokes.
        </Note>
      </Section>

      <Section title="Spoke tension converter">
        <div className="grid">
          <Field label="Tool / spoke" hint="illustrative curves — verify against the real chart">
            <Select
              value={String(curveIdx)}
              onChange={(v) => setCurveIdx(parseInt(v))}
              options={EXAMPLE_TENSION_CURVES.map((c, i) => ({
                value: String(i),
                label: `${c.tool} — ${c.spokeType}`,
              }))}
            />
          </Field>
          <Field label="Tensiometer reading">
            <NumberInput value={reading} onChange={setReading} step={0.1} />
          </Field>
          <Result label="Tension" value={`${kgf.toFixed(0)} kgf`} big />
          <Result label="Tension" value={`${kgfToN(kgf).toFixed(0)} N`} />
        </div>
        <Note tone="warn">
          The built-in curves are examples only. Enter your own tool's chart data
          for real builds, and check against the rim's max spoke tension
          (typically ~100–120 kgf). On a dished wheel the two sides sit at
          different tensions by design.
        </Note>
      </Section>
    </>
  );
}
