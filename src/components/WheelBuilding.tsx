import { useMemo, useState } from "react";
import {
  spokeLength,
  readingToKgf,
  kgfToN,
  EXAMPLE_TENSION_CURVES,
  RIM_PRESETS,
  HUB_GEOMETRY_PRESETS,
} from "../lib/spokes";
import { Field, NumberInput, Select, PresetMenu, Result, Section } from "./ui";
import { WheelDiagram } from "./WheelDiagram";

const RIM_OPTIONS = RIM_PRESETS.map((p) => ({ value: String(p.erdMm), label: p.label }));
const HUB_OPTIONS = HUB_GEOMETRY_PRESETS.map((p, i) => ({ value: String(i), label: p.label }));

const crossOptions = [0, 1, 2, 3, 4].map((k) => ({
  value: k,
  label: k === 0 ? "Radial (0×)" : `${k}-cross`,
}));

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

  const applyHubPreset = (idx: string) => {
    const p = HUB_GEOMETRY_PRESETS[parseInt(idx)];
    if (!p) return;
    setLeftFlange(p.leftFlangeDiaMm);
    setRightFlange(p.rightFlangeDiaMm);
    setLeftOffset(p.leftOffsetMm);
    setRightOffset(p.rightOffsetMm);
    setHoleDia(p.spokeHoleMm);
  };

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

  return (
    <>
      <Section
        title="Rim"
        info={
          <>
            <strong>ERD</strong> (effective rim diameter) is the diameter at the
            nipple seats — the single biggest error source. Measure it; presets are
            rough starting points that vary a lot by rim depth.
          </>
        }
      >
        <div className="grid">
          <Field label="ERD (effective rim diameter)">
            <div className="combo">
              <NumberInput value={erd} onChange={setErd} min={200} max={720} />
              <PresetMenu
                title="Fill ERD from a common rim (approximate)"
                options={RIM_OPTIONS}
                onPick={(v) => setErd(parseFloat(v))}
              />
            </div>
          </Field>
        </div>
      </Section>

      <Section
        title="Hub"
        info={
          <>
            Flange diameter is the circle through the spoke holes (PCD); the offset
            is centre-to-flange per side. Presets are <strong>approximate</strong> —
            measure your hub. Left/right offsets differ on a dished (rear or disc)
            wheel.
          </>
        }
        action={
          <PresetMenu
            label="Common hub"
            title="Load a common hub (approximate)"
            options={HUB_OPTIONS}
            onPick={applyHubPreset}
          />
        }
      >
        <div className="grid">
          <Field label="Spoke count (total)">
            <NumberInput value={spokes} onChange={setSpokes} min={8} step={2} />
          </Field>
          <Field label="Flange hole diameter">
            <NumberInput value={holeDia} onChange={setHoleDia} suffix="mm" step={0.1} />
          </Field>
        </div>

        <div className="wb-sides">
          <div className="wb-side">
            <h4 className="wb-side-title" style={{ color: "#0b6bcb" }}>
              Left / non-drive
            </h4>
            <Field label="Flange diameter">
              <NumberInput value={leftFlange} onChange={setLeftFlange} suffix="mm" />
            </Field>
            <Field label="Centre-to-flange offset">
              <NumberInput value={leftOffset} onChange={setLeftOffset} suffix="mm" />
            </Field>
            <Field label="Lacing">
              <Select value={leftCross} onChange={setLeftCross} options={crossOptions} />
            </Field>
          </div>
          <div className="wb-side">
            <h4 className="wb-side-title" style={{ color: "#c0392b" }}>
              Right / drive
            </h4>
            <Field label="Flange diameter">
              <NumberInput value={rightFlange} onChange={setRightFlange} suffix="mm" />
            </Field>
            <Field label="Centre-to-flange offset">
              <NumberInput value={rightOffset} onChange={setRightOffset} suffix="mm" />
            </Field>
            <Field label="Lacing">
              <Select value={rightCross} onChange={setRightCross} options={crossOptions} />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title="Spoke lengths"
        info={
          <>
            Front and rear (and the two sides of a dished wheel) usually differ.
            When between sizes most builders prefer ~1 mm short over long. A 1–2 mm
            ERD error is the usual cause of wrong spokes.
          </>
        }
      >
        <div className="results" style={{ marginBottom: 16 }}>
          <Result label="Left / non-drive" value={`${left.toFixed(1)} mm`} big />
          <Result label="Right / drive" value={`${right.toFixed(1)} mm`} big />
        </div>
        <WheelDiagram
          erdMm={erd}
          spokeCount={spokes}
          leftFlangeDiaMm={leftFlange}
          rightFlangeDiaMm={rightFlange}
          leftOffsetMm={leftOffset}
          rightOffsetMm={rightOffset}
          leftCross={leftCross}
          rightCross={rightCross}
        />
      </Section>

      <Section
        title="Spoke tension converter"
        info={
          <>
            The built-in curves are examples only. Enter your own tool's chart data
            for real builds, and check against the rim's max spoke tension
            (typically ~100–120 kgf). On a dished wheel the two sides sit at
            different tensions by design.
          </>
        }
      >
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
          <Result label="Tension" value={`${kgf.toFixed(0)} kgf · ${kgfToN(kgf).toFixed(0)} N`} big />
        </div>
      </Section>
    </>
  );
}
