import { useState } from "react";
import {
  powerForSpeed,
  speedForPower,
  powerBreakdown,
  CDA_PRESETS,
  CRR_PRESETS,
  DRIVETRAIN_EFF_PRESETS,
  AIR_DENSITY_PRESETS,
  type PowerInput,
  type PowerBreakdown,
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

// Colours shared by the breakdown's number cards and the stacked bar.
const SPLIT_COLORS = {
  gravity: "#b7791f",
  rolling: "#0e8a8a",
  aero: "#0b6bcb",
  drivetrain: "#7b3fb0",
};

type SplitPart = { key: string; label: string; watts: number; color: string };

// Build the four components (watts) from a breakdown, in display order.
function splitParts(bd: PowerBreakdown): SplitPart[] {
  return [
    { key: "gravity", label: "Gravity", watts: bd.gravity, color: SPLIT_COLORS.gravity },
    { key: "rolling", label: "Rolling", watts: bd.rolling, color: SPLIT_COLORS.rolling },
    { key: "aero", label: "Aero", watts: bd.aero, color: SPLIT_COLORS.aero },
    { key: "drivetrain", label: "Drivetrain", watts: bd.drivetrain, color: SPLIT_COLORS.drivetrain },
  ];
}

/**
 * Stacked bar of where the pedal power goes. Only resisting (positive) parts
 * get a segment, normalised to fill the bar; an assisting part (downhill
 * gravity, strong tailwind) is ≤ 0 and simply takes no width.
 */
function SplitBar({ parts }: { parts: SplitPart[] }) {
  const positives = parts.filter((p) => p.watts > 0);
  const total = positives.reduce((s, p) => s + p.watts, 0);
  if (total <= 0) return null;
  return (
    <div className="split-bar" role="img" aria-label="Power breakdown">
      {positives.map((p) => (
        <span
          key={p.key}
          className="split-seg"
          style={{ width: `${(p.watts / total) * 100}%`, background: p.color }}
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

  const [riderMass, setRiderMass] = useState(70);
  const [bikeMass, setBikeMass] = useState(10);
  const mass = riderMass + bikeMass;
  const [gradient, setGradient] = useState(0);
  const [crr, setCrr] = useState(0.005);
  const [rho, setRho] = useState(1.225);
  const [cda, setCda] = useState(0.32);
  const [wind, setWind] = useState(0);
  const [eff, setEff] = useState(0.97);

  // Speed, power and power-to-weight (W per rider kg) are coupled: whichever was
  // edited last is the independent one and stays fixed as conditions change; the
  // others are derived.
  const [speedKmh, setSpeedKmh] = useState(30);
  const [watts, setWatts] = useState(200);
  const [wkg, setWkg] = useState(200 / 70);
  const [last, setLast] = useState<"speed" | "power" | "wkg">("speed");

  const p: PowerInput = {
    massKg: mass,
    gradient: gradient / 100,
    crr,
    rho,
    cda,
    headwindMs: wind,
    drivetrainEfficiency: eff,
  };

  // The independent pedal power, from whichever coupled field was edited last.
  // W/kg is per *rider* kg (the conventional cycling power-to-weight metric).
  const independentWatts =
    last === "speed"
      ? powerForSpeed(kmhToMs(speedKmh), p)
      : last === "wkg"
        ? wkg * riderMass
        : watts;
  const shownWatts = independentWatts;
  const shownSpeedKmh =
    last === "speed" ? speedKmh : msToKmh(speedForPower(independentWatts, p));
  const shownWkg = last === "wkg" ? wkg : independentWatts / riderMass;

  const parts = splitParts(powerBreakdown(kmhToMs(shownSpeedKmh), p));
  // Percentages are shares of the resisting (positive) power, so an assisting
  // part reads as "assist" rather than a confusing negative %.
  const resistingW = parts.reduce((s, p) => s + Math.max(0, p.watts), 0);

  return (
    <>
      <Section
        title="Speed ⇄ Power ⇄ W/kg"
        info={
          <>
            Edit <strong>any</strong> field — the one you set is
            <strong> highlighted</strong> and the others update to match.
            Power-to-weight is watts per <strong>rider</strong> kg. When you
            change a condition below, the highlighted (last-edited) value is held
            fixed and the others are recomputed.
          </>
        }
      >
        <div className="grid">
          <Field label="Speed" highlight={last === "speed"}>
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
          <Field label="Pedal power" highlight={last === "power"}>
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
          <Field label="Power-to-weight" hint="per rider kg" highlight={last === "wkg"}>
            <NumberInput
              value={Math.round(shownWkg * 100) / 100}
              onChange={(v) => {
                setWkg(v);
                setLast("wkg");
              }}
              suffix="W/kg"
              min={0.5}
              step={0.1}
            />
          </Field>
        </div>
        {shownWatts > 0 ? (
          <>
            <div className="results" style={{ marginTop: 8 }}>
              {parts.map((pt) => {
                const sub =
                  pt.watts > 0.5
                    ? `${Math.round((pt.watts / resistingW) * 100)} %`
                    : pt.watts < -0.5
                      ? "assist"
                      : "0 %";
                return (
                  <Result
                    key={pt.key}
                    label={pt.label}
                    dotColor={pt.color}
                    value={
                      <>
                        {Math.round(pt.watts)} W<span className="result-sub">{sub}</span>
                      </>
                    }
                  />
                );
              })}
            </div>
            <SplitBar parts={parts} />
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
            drag, divided by drivetrain efficiency. The breakdown above shows where
            your watts go — against gravity, rolling and aero, plus the drivetrain
            loss — with the share of the total in each card. Aero dominates on the
            flat, gravity on climbs. Each coefficient is editable, with a ⌄ button
            for common presets.
          </>
        }
      >
        <div className="grid">
          <Field label="Rider" hint={`total ${Math.round(mass)} kg`}>
            <NumberInput value={riderMass} onChange={setRiderMass} suffix="kg" min={30} max={150} />
          </Field>
          <Field label="Bike & equipment" hint="frame, wheels, kit">
            <NumberInput value={bikeMass} onChange={setBikeMass} suffix="kg" min={3} max={40} />
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
