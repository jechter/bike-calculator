import { useState } from "react";
import {
  powerForSpeed,
  speedForPower,
  powerSplit,
  CDA_PRESETS,
  CRR_PRESETS,
  type PowerInput,
} from "../lib/power";
import { kmhToMs, msToKmh, kmhToMph } from "../lib/units";
import { Field, NumberInput, Select, Result, Note, Section } from "./ui";

export function Power() {
  const [dir, setDir] = useState<"speed-from-power" | "power-from-speed">(
    "power-from-speed",
  );
  const [mass, setMass] = useState(80);
  const [gradient, setGradient] = useState(0);
  const [crr, setCrr] = useState(0.005);
  const [rho, setRho] = useState(1.225);
  const [cda, setCda] = useState(0.32);
  const [wind, setWind] = useState(0);
  const [eff, setEff] = useState(0.97);

  const [speedKmh, setSpeedKmh] = useState(30);
  const [watts, setWatts] = useState(200);

  const p: PowerInput = {
    massKg: mass,
    gradient: gradient / 100, // input as percent
    crr,
    rho,
    cda,
    headwindMs: wind,
    drivetrainEfficiency: eff,
  };

  const vFromPower = speedForPower(watts, p);
  const resultSpeedKmh = msToKmh(vFromPower);
  const resultWatts = powerForSpeed(kmhToMs(speedKmh), p);

  const evalV = dir === "power-from-speed" ? kmhToMs(speedKmh) : vFromPower;
  const split = powerSplit(evalV, p);

  return (
    <>
      <Section title="Direction">
        <div className="grid">
          <Field label="Solve for">
            <Select
              value={dir}
              onChange={(v) => setDir(v as typeof dir)}
              options={[
                { value: "power-from-speed", label: "Power needed for a speed" },
                { value: "speed-from-power", label: "Speed from a power" },
              ]}
            />
          </Field>
          {dir === "power-from-speed" ? (
            <Field label="Target speed">
              <NumberInput value={speedKmh} onChange={setSpeedKmh} suffix="km/h" min={1} />
            </Field>
          ) : (
            <Field label="Pedal power">
              <NumberInput value={watts} onChange={setWatts} suffix="W" min={10} />
            </Field>
          )}
        </div>
        <div className="results" style={{ marginTop: 8 }}>
          {dir === "power-from-speed" ? (
            <Result label="Power required" value={`${resultWatts.toFixed(0)} W`} big />
          ) : (
            <Result
              label="Speed"
              value={`${resultSpeedKmh.toFixed(1)} km/h · ${kmhToMph(resultSpeedKmh).toFixed(1)} mph`}
              big
            />
          )}
          <Result label="vs gravity" value={`${split.gravity.toFixed(0)} %`} />
          <Result label="vs rolling" value={`${split.rolling.toFixed(0)} %`} />
          <Result label="vs aero" value={`${split.aero.toFixed(0)} %`} />
        </div>
      </Section>

      <Section title="Rider & conditions">
        <div className="grid">
          <Field label="Total mass" hint="rider + bike + kit">
            <NumberInput value={mass} onChange={setMass} suffix="kg" min={30} max={200} />
          </Field>
          <Field label="Gradient">
            <NumberInput value={gradient} onChange={setGradient} suffix="%" step={0.5} />
          </Field>
          <Field label="Position (CdA)">
            <Select
              value={String(cda)}
              onChange={(v) => setCda(parseFloat(v))}
              options={CDA_PRESETS.map((c) => ({ value: String(c.cda), label: `${c.label} (${c.cda})` }))}
            />
          </Field>
          <Field label="CdA (m²)">
            <NumberInput value={cda} onChange={setCda} step={0.01} min={0.15} max={0.6} />
          </Field>
          <Field label="Surface (Crr)">
            <Select
              value={String(crr)}
              onChange={(v) => setCrr(parseFloat(v))}
              options={CRR_PRESETS.map((c) => ({ value: String(c.crr), label: `${c.label} (${c.crr})` }))}
            />
          </Field>
          <Field label="Air density ρ" hint="1.225 sea level 15°C">
            <NumberInput value={rho} onChange={setRho} suffix="kg/m³" step={0.005} />
          </Field>
          <Field label="Headwind" hint="+ head, − tail">
            <NumberInput value={wind} onChange={setWind} suffix="m/s" step={0.5} />
          </Field>
          <Field label="Drivetrain efficiency">
            <NumberInput value={eff} onChange={setEff} step={0.01} min={0.9} max={1} />
          </Field>
        </div>
        <Note>
          Steady-state model: power against gravity, rolling resistance and aero
          drag, divided by drivetrain efficiency. The split shows where the watts
          go — aero dominates on the flat, gravity on climbs.
        </Note>
      </Section>
    </>
  );
}
