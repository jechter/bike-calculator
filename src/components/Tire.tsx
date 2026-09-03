import { useState } from "react";
import {
  BEAD_STANDARDS,
  findBeadStandardsByName,
  estimatedOuterDiameterMm,
  estimatedCircumferenceMm,
} from "../lib/wheels";
import {
  recommendTirePressure,
  type Surface,
  type TubeType,
} from "../lib/tirePressure";
import { Field, NumberInput, TextInput, Select, Result, Note, Section } from "./ui";

export function Tire() {
  // Size conversion
  const [query, setQuery] = useState("700c");
  const [iso, setIso] = useState(622);
  const [width, setWidth] = useState(28);
  const matches = findBeadStandardsByName(query);
  const outer = estimatedOuterDiameterMm(iso, width);
  const circ = estimatedCircumferenceMm(iso, width);

  // Pressure
  const [weight, setWeight] = useState(90);
  const [frontPct, setFrontPct] = useState(40);
  const [pWidth, setPWidth] = useState(28);
  const [tube, setTube] = useState<TubeType>("tube");
  const [surface, setSurface] = useState<Surface>("smooth");

  const pressure = recommendTirePressure({
    systemWeightKg: weight,
    frontLoadFraction: frontPct / 100,
    tireWidthMm: pWidth,
    tubeType: tube,
    surface,
  });

  return (
    <>
      <Section title="Size conversion">
        <Note>
          ISO/ETRTO bead diameter is what determines fit. Two tyres sharing a
          name (e.g. “20”, “26”) can have different ISO diameters and{" "}
          <strong>not fit the same rim</strong>.
        </Note>
        <div className="grid">
          <Field label="Look up a name" hint='e.g. "700c", "26", "27.5", "650b"'>
            <TextInput value={query} onChange={setQuery} />
          </Field>
        </div>
        {matches.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th className="num">ISO bead</th>
                  <th>Known as</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.iso}>
                    <td className="num">{m.iso} mm</td>
                    <td>{m.names.join(", ")}</td>
                    <td>
                      <button className="chip" onClick={() => setIso(m.iso)}>
                        use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid" style={{ marginTop: 14 }}>
          <Field label="ISO bead diameter">
            <Select
              value={String(iso)}
              onChange={(v) => setIso(parseFloat(v))}
              options={BEAD_STANDARDS.map((s) => ({
                value: String(s.iso),
                label: `${s.iso} — ${s.names[0]}`,
              }))}
            />
          </Field>
          <Field label="Tyre width">
            <NumberInput value={width} onChange={setWidth} suffix="mm" min={18} max={80} />
          </Field>
          <Result label="ETRTO" value={`${width}-${iso}`} big />
          <Result label="Est. outer diameter" value={`${outer.toFixed(0)} mm`} />
          <Result
            label="Bike-computer wheel size"
            value={`${circ.toFixed(0)} mm`}
          />
        </div>
        <Note>
          The circumference doubles as the wheel-size value to enter into a bike
          computer / speedometer. A measured roll-out (mark the valve, roll one
          rev under rider weight) is more accurate than this estimate.
        </Note>
      </Section>

      <Section title="Pressure recommendation">
        <div className="grid">
          <Field label="System weight" hint="rider + bike + luggage">
            <NumberInput value={weight} onChange={setWeight} suffix="kg" min={30} max={200} />
          </Field>
          <Field label="Front weight share">
            <NumberInput value={frontPct} onChange={setFrontPct} suffix="%" min={30} max={55} />
          </Field>
          <Field label="Tyre width">
            <NumberInput value={pWidth} onChange={setPWidth} suffix="mm" min={18} max={80} />
          </Field>
          <Field label="Tube type">
            <Select
              value={tube}
              onChange={setTube}
              options={[
                { value: "tube", label: "Clincher + tube" },
                { value: "tubeless", label: "Tubeless" },
                { value: "tubular", label: "Tubular" },
              ]}
            />
          </Field>
          <Field label="Surface">
            <Select
              value={surface}
              onChange={setSurface}
              options={[
                { value: "smooth", label: "Smooth tarmac" },
                { value: "rough", label: "Rough tarmac" },
                { value: "gravel", label: "Gravel" },
                { value: "offroad", label: "Off-road" },
              ]}
            />
          </Field>
        </div>
        <div className="results" style={{ marginTop: 8 }}>
          <Result
            label="Front"
            value={`${pressure.frontBar.toFixed(1)} bar · ${pressure.frontPsi.toFixed(0)} psi`}
            big
          />
          <Result
            label="Rear"
            value={`${pressure.rearBar.toFixed(1)} bar · ${pressure.rearPsi.toFixed(0)} psi`}
            big
          />
        </div>
        <Note tone="warn">
          A transparent ~15% tyre-drop estimate (Berto lineage) with tube/surface
          modifiers — a starting point, adjust to feel. <strong>Never exceed</strong>{" "}
          the tyre sidewall or rim max (hookless rims often cap at 5 bar / 72.5
          psi).
        </Note>
      </Section>
    </>
  );
}
