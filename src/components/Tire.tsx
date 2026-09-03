import { useState } from "react";
import { parseTireSize, formatDesignations, commonNamesFor } from "../lib/tireSizes";
import { estimatedOuterDiameterMm, estimatedCircumferenceMm } from "../lib/wheels";
import {
  recommendTirePressure,
  type Surface,
  type TubeType,
} from "../lib/tirePressure";
import { Field, NumberInput, TextInput, Select, Result, Section } from "./ui";

const EXAMPLES = ["700x28C", "28-622", "26x2.1", "27.5x2.4", "28x1 3/8", "650b x 47"];

export function Tire() {
  const [query, setQuery] = useState("700x28C");
  const parsed = parseTireSize(query);
  const designations = parsed ? formatDesignations(parsed.iso, parsed.widthMm) : [];
  const names = parsed ? commonNamesFor(parsed.iso) : [];
  const outer = parsed ? estimatedOuterDiameterMm(parsed.iso, parsed.widthMm) : 0;
  const circ = parsed ? estimatedCircumferenceMm(parsed.iso, parsed.widthMm) : 0;

  // Pressure — tire width comes from the size entered above (one source of truth).
  const [weight, setWeight] = useState(82);
  const [frontPct, setFrontPct] = useState(45);
  const [tube, setTube] = useState<TubeType>("tube");
  const [surface, setSurface] = useState<Surface>("smooth");

  const pressureWidth = parsed?.widthMm ?? 28;
  const pressure = recommendTirePressure({
    systemWeightKg: weight,
    frontLoadFraction: frontPct / 100,
    tireWidthMm: pressureWidth,
    tubeType: tube,
    surface,
  });

  return (
    <>
      <Section
        title="Convert a tire size"
        info={
          <>
            Enter a tire size in any format — <strong>ETRTO/ISO</strong> (e.g.
            25-622), <strong>French</strong> (700 × 28C), or <strong>inch</strong>{" "}
            (26 × 2.1, 28 × 1⅜) — and see the equivalents. ISO bead diameter is the
            only unambiguous part and is what determines fit: two tires sharing a
            name (e.g. “20”, “26”) can have different ISO diameters and{" "}
            <strong>not fit the same rim</strong>. Legacy fractional sizes are
            especially ambiguous.
          </>
        }
      >
        <div className="rows">
          <Field
            label="Tire size (any format)"
            hint="e.g. 28-622 · 700x28C · 26x2.1 · 28x1 3/8 · 650b x 47"
          >
            <TextInput value={query} onChange={setQuery} placeholder="e.g. 700x28C" />
          </Field>
        </div>
        <div className="chips" style={{ marginTop: 4 }}>
          {EXAMPLES.map((e) => (
            <button key={e} className="chip" onClick={() => setQuery(e)}>
              {e}
            </button>
          ))}
        </div>

        {parsed ? (
          <>
            <div className="results" style={{ marginTop: 16 }}>
              <Result label="ETRTO / ISO" value={`${Math.round(parsed.widthMm)}-${parsed.iso}`} big />
              <Result label="Rim bead diameter" value={`${parsed.iso} mm`} />
              <Result label="Est. outer diameter" value={`${outer.toFixed(0)} mm`} />
              <Result label="Bike-computer size" value={`${circ.toFixed(0)} mm`} />
            </div>

            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Format</th>
                    <th>Designation</th>
                  </tr>
                </thead>
                <tbody>
                  {designations.map((d) => (
                    <tr key={d.format}>
                      <td>{d.format}</td>
                      <td>{d.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {names.length > 0 && (
              <p className="field-hint" style={{ marginTop: 10 }}>
                Bead diameter {parsed.iso} mm is also known as: {names.join(" · ")}
              </p>
            )}
          </>
        ) : query.trim() ? (
          <p className="field-hint" style={{ marginTop: 12 }}>
            Couldn't read that. Try a format like <code>28-622</code>,{" "}
            <code>700x28C</code>, <code>26x2.1</code> or <code>28x1 3/8</code>.
          </p>
        ) : null}
      </Section>

      <Section
        title="Pressure recommendation"
        info={
          <>
            A transparent estimate: pressure scales with the load each wheel carries
            per mm of tire width (~15% tire-drop lineage) with tube/surface
            modifiers — a starting point, adjust to feel. <strong>Never exceed</strong>{" "}
            the tire sidewall or rim max (hookless rims often cap at 5 bar / 72.5
            psi).
          </>
        }
      >
        <div className="grid">
          <Field label="System weight" hint="rider + bike + luggage">
            <NumberInput value={weight} onChange={setWeight} suffix="kg" min={30} max={200} />
          </Field>
          <Field label="Front weight share">
            <NumberInput value={frontPct} onChange={setFrontPct} suffix="%" min={30} max={55} />
          </Field>
          <Field label="Tire width" hint={parsed ? "from the size above" : "enter a size above"}>
            <div className="static-value">{Math.round(pressureWidth)} mm</div>
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
      </Section>
    </>
  );
}
