import { useState } from "react";
import {
  powerForSpeed,
  speedForPower,
  powerSplit,
  CDA_PRESETS,
  CRR_PRESETS,
  DRIVETRAIN_EFF_PRESETS,
  AIR_DENSITY_PRESETS,
  type PowerInput,
  type ForceBreakdown,
} from "../lib/power";
import { kmhToMs, msToKmh, kmhToMph, mphToKmh } from "../lib/units";
import { useUnits, speedUnitLabel } from "../units-context";
import { Field, Note, NumberInput, PresetMenu, Result, Section } from "./ui";

const CDA_OPTIONS = CDA_PRESETS.map((c) => ({ value: String(c.cda), label: `${c.label} (${c.cda})` }));
const CRR_OPTIONS = CRR_PRESETS.map((c) => ({ value: String(c.crr), label: `${c.label} (${c.crr})` }));
const EFF_OPTIONS = DRIVETRAIN_EFF_PRESETS.map((c) => ({
  value: String(c.eff),
  label: `${c.label} (${c.eff})`,
}));
const RHO_OPTIONS = AIR_DENSITY_PRESETS.map((c) => ({
  value: String(c.rho),
  label: `${c.label} (${c.rho})`,
}));

// Colours shared by the split's number cards and the stacked bar.
const SPLIT_COLORS = { gravity: "#b7791f", rolling: "#0e8a8a", aero: "#0b6bcb" };

// A force with a negative share is assisting (downhill gravity, tailwind), not
// resisting — label it as such instead of showing a confusing negative %.
const splitLabel = (pct: number) => (pct < -0.5 ? "assist" : `${Math.max(0, pct).toFixed(0)} %`);

/**
 * Stacked bar of where the pedal power goes. Only resisting (positive) forces
 * get a segment, normalised to fill the bar; an assisting force (downhill
 * gravity, strong tailwind) is ≤ 0 and simply takes no width.
 */
function SplitBar({ split }: { split: ForceBreakdown }) {
  const parts = [
    { key: "gravity", label: "Gravity", pct: split.gravity, color: SPLIT_COLORS.gravity },
    { key: "rolling", label: "Rolling", pct: split.rolling, color: SPLIT_COLORS.rolling },
    { key: "aero", label: "Aero", pct: split.aero, color: SPLIT_COLORS.aero },
  ];
  const positives = parts.filter((p) => p.pct > 0);
  const total = positives.reduce((s, p) => s + p.pct, 0);
  if (total <= 0) return null;
  return (
    <div
      className="split-bar"
      role="img"
      aria-label={parts.map((p) => `${p.label} ${p.pct.toFixed(0)} percent`).join(", ")}
    >
      {positives.map((p) => (
        <span
          key={p.key}
          className="split-seg"
          style={{ width: `${(p.pct / total) * 100}%`, background: p.color }}
        />
      ))}
    </div>
  );
}

export function Power() {
  const units = useUnits();
  const unitLabel = speedUnitLabel(units.speed);
  const toDisplay = (kmh: number) => (units.speed === "mph" ? kmhToMph(kmh) : kmh);
  const fromDisplay = (v: number) => (units.speed === "mph" ? mphToKmh(v) : v);

  const [mass, setMass] = useState(80);
  const [gradient, setGradient] = useState(0);
  const [crr, setCrr] = useState(0.005);
  const [rho, setRho] = useState(1.225);
  const [cda, setCda] = useState(0.32);
  const [wind, setWind] = useState(0);
  const [eff, setEff] = useState(0.97);

  // Speed and power are coupled: whichever was edited last is the independent
  // one and stays fixed as conditions change; the other is derived.
  const [speedKmh, setSpeedKmh] = useState(30);
  const [watts, setWatts] = useState(200);
  const [last, setLast] = useState<"speed" | "power">("speed");

  const p: PowerInput = {
    massKg: mass,
    gradient: gradient / 100,
    crr,
    rho,
    cda,
    headwindMs: wind,
    drivetrainEfficiency: eff,
  };

  const derivedWatts = powerForSpeed(kmhToMs(speedKmh), p);
  const derivedSpeedKmh = msToKmh(speedForPower(watts, p));
  const shownSpeedKmh = last === "power" ? derivedSpeedKmh : speedKmh;
  const shownWatts = last === "speed" ? derivedWatts : watts;

  const split = powerSplit(kmhToMs(shownSpeedKmh), p);

  return (
    <>
      <Section
        title="Speed ⇄ Power"
        info={
          <>
            Edit <strong>either</strong> field — the other updates to match. When you
            change a condition below, the value you edited <strong>last</strong> is
            held fixed and the other is recomputed.
          </>
        }
      >
        <div className="grid">
          <Field label="Speed">
            <NumberInput
              value={Math.round(toDisplay(shownSpeedKmh) * 10) / 10}
              onChange={(v) => {
                setSpeedKmh(fromDisplay(v));
                setLast("speed");
              }}
              suffix={unitLabel}
              min={1}
            />
          </Field>
          <Field label="Pedal power">
            <NumberInput
              value={Math.round(shownWatts)}
              onChange={(v) => {
                setWatts(v);
                setLast("power");
              }}
              suffix="W"
              min={5}
            />
          </Field>
        </div>
        {shownWatts > 0 ? (
          <>
            <div className="results" style={{ marginTop: 8 }}>
              <Result label="vs gravity" value={splitLabel(split.gravity)} dotColor={SPLIT_COLORS.gravity} />
              <Result label="vs rolling" value={splitLabel(split.rolling)} dotColor={SPLIT_COLORS.rolling} />
              <Result label="vs aero" value={splitLabel(split.aero)} dotColor={SPLIT_COLORS.aero} />
            </div>
            <SplitBar split={split} />
          </>
        ) : (
          <Note>
            On this descent gravity overcomes rolling and air resistance on its own —
            you'd coast (or brake to hold this speed), so there's no pedalling effort
            to split.
          </Note>
        )}
      </Section>

      <Section
        title="Rider & conditions"
        info={
          <>
            Steady-state model: power against gravity, rolling resistance and aero
            drag, divided by drivetrain efficiency. The split shows where the watts
            go — aero dominates on the flat, gravity on climbs. Each coefficient is
            editable, with a ⌄ button for common presets.
          </>
        }
      >
        <div className="grid">
          <Field label="Total mass" hint="rider + bike + kit">
            <NumberInput value={mass} onChange={setMass} suffix="kg" min={30} max={200} />
          </Field>
          <Field label="Gradient">
            <NumberInput value={gradient} onChange={setGradient} suffix="%" step={0.5} />
          </Field>
          <Field label="Headwind" hint="+ head, − tail">
            <NumberInput
              value={Math.round(toDisplay(msToKmh(wind)) * 10) / 10}
              onChange={(v) => setWind(kmhToMs(fromDisplay(v)))}
              suffix={unitLabel}
              step={1}
            />
          </Field>

          <Field label="CdA (drag area, m²)" hint="riding position">
            <div className="combo">
              <NumberInput value={cda} onChange={setCda} step={0.01} min={0.15} max={0.6} />
              <PresetMenu
                title="Fill CdA from a riding position"
                options={CDA_OPTIONS}
                onPick={(v) => setCda(parseFloat(v))}
              />
            </div>
          </Field>
          <Field label="Crr (rolling resistance)" hint="tire / surface">
            <div className="combo">
              <NumberInput value={crr} onChange={setCrr} step={0.001} min={0.002} max={0.03} />
              <PresetMenu
                title="Fill Crr from a tire / surface"
                options={CRR_OPTIONS}
                onPick={(v) => setCrr(parseFloat(v))}
              />
            </div>
          </Field>
          <Field label="Air density ρ (kg/m³)" hint="altitude / temperature">
            <div className="combo">
              <NumberInput value={rho} onChange={setRho} step={0.005} min={0.7} max={1.3} />
              <PresetMenu
                title="Fill air density from altitude"
                options={RHO_OPTIONS}
                onPick={(v) => setRho(parseFloat(v))}
              />
            </div>
          </Field>
          <Field label="Drivetrain efficiency">
            <div className="combo">
              <NumberInput value={eff} onChange={setEff} step={0.01} min={0.9} max={1} />
              <PresetMenu
                title="Fill drivetrain efficiency"
                options={EFF_OPTIONS}
                onPick={(v) => setEff(parseFloat(v))}
              />
            </div>
          </Field>
        </div>
      </Section>
    </>
  );
}
