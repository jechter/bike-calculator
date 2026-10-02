import { useEffect, useState } from "react";
import {
  powerForSpeed,
  speedForPower,
  powerBreakdown,
  CRR_PRESETS,
  combinedEfficiency,
  DEFAULT_EFFICIENCY_PARAMS,
  type EfficiencyParams,
  type PowerInput,
  type PowerBreakdown,
} from "../lib/power";
import {
  DEFAULT_CDA_PARAMS,
  estimateCda,
  CDA_MIN,
  CDA_MAX,
  type CdaParams,
} from "../lib/cda";
import { airDensity, DEFAULT_AIR_PARAMS, type AirParams } from "../lib/airDensity";
import { kmhToMs, msToKmh, kmhToMph, mphToKmh } from "../lib/units";
import { useUnits, speedUnitLabel } from "../units-context";
import { Field, Note, NumberInput, PresetMenu, Result, Section } from "./ui";
import { CdaAdvancedPanel } from "./CdaAdvanced";
import { DrivetrainEfficiencyPanel } from "./DrivetrainEfficiency";
import { AirDensityPanel } from "./AirDensity";
import { useOutsideClose } from "./EditorPopover";

const CRR_OPTIONS = CRR_PRESETS.map((c) => ({ value: String(c.crr), label: `${c.label} (${c.crr})` }));

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
  // Air density: seeded from its editor (15 °C, sea level → 1.225); editor-driven
  // until the user types a value directly.
  const [rho, setRho] = useState(() =>
    airDensity(DEFAULT_AIR_PARAMS.tempC, DEFAULT_AIR_PARAMS.altitudeM),
  );
  const [rhoAdvanced, setRhoAdvanced] = useState(false);
  const [rhoParams, setRhoParams] = useState<AirParams>(DEFAULT_AIR_PARAMS);
  const [rhoFromCalc, setRhoFromCalc] = useState(true);
  // CdA starts seeded from the estimator (road / hoods / reference rider) and
  // stays "estimator-driven": changing a factor or the rider weight re-derives it.
  const [cda, setCda] = useState(() => estimateCda(DEFAULT_CDA_PARAMS, riderMass));
  const [cdaAdvanced, setCdaAdvanced] = useState(false);
  const [cdaParams, setCdaParams] = useState<CdaParams>(DEFAULT_CDA_PARAMS);
  // True until the user types a CdA directly (then it's manual and left alone).
  const [cdaFromEstimator, setCdaFromEstimator] = useState(true);
  const [wind, setWind] = useState(0);
  // Overall drivetrain efficiency = chain/belt friction × gearing losses, chosen
  // via its editor and seeded from a typical chain on a derailleur (~0.96).
  // Editor-driven until the user types a value directly.
  const [eff, setEff] = useState(() => combinedEfficiency(DEFAULT_EFFICIENCY_PARAMS));
  const [effAdvanced, setEffAdvanced] = useState(false);
  const [effParams, setEffParams] = useState<EfficiencyParams>(DEFAULT_EFFICIENCY_PARAMS);
  const [effFromPresets, setEffFromPresets] = useState(true);

  // Speed, power and power-to-weight (W per rider kg) are coupled: whichever was
  // edited last is the independent one and stays fixed as conditions change; the
  // others are derived.
  const [speedKmh, setSpeedKmh] = useState(30);
  const [watts, setWatts] = useState(200);
  const [wkg, setWkg] = useState(200 / 70);
  const [last, setLast] = useState<"speed" | "power" | "wkg">("speed");

  // Each editor-backed field (CdA, air density, drivetrain efficiency) follows the
  // same pattern: it's seeded from its editor and re-derived whenever a factor
  // changes, until the user types a value directly (which switches it to manual).
  // Opening/closing a panel never recomputes. `useOutsideClose` dismisses a panel
  // on an outside click (its anchor wraps the trigger too, so the trigger toggles).
  useEffect(() => {
    if (cdaFromEstimator) setCda(estimateCda(cdaParams, riderMass));
  }, [cdaFromEstimator, cdaParams, riderMass]);
  const onCdaParams = (next: CdaParams) => {
    setCdaParams(next);
    setCdaFromEstimator(true);
  };
  const cdaAnchorRef = useOutsideClose<HTMLDivElement>(cdaAdvanced, () => setCdaAdvanced(false));

  useEffect(() => {
    if (rhoFromCalc) setRho(airDensity(rhoParams.tempC, rhoParams.altitudeM));
  }, [rhoFromCalc, rhoParams]);
  const onRhoParams = (next: AirParams) => {
    setRhoParams(next);
    setRhoFromCalc(true);
  };
  const rhoAnchorRef = useOutsideClose<HTMLDivElement>(rhoAdvanced, () => setRhoAdvanced(false));

  useEffect(() => {
    if (effFromPresets) setEff(combinedEfficiency(effParams));
  }, [effFromPresets, effParams]);
  const onEffParams = (next: EfficiencyParams) => {
    setEffParams(next);
    setEffFromPresets(true);
  };
  const effAnchorRef = useOutsideClose<HTMLDivElement>(effAdvanced, () => setEffAdvanced(false));

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
            drag, divided by drivetrain efficiency (chain/belt friction × gearing
            losses). The breakdown above shows where
            your watts go — against gravity, rolling and aero, plus the drivetrain
            loss — with the share of the total in each card. Aero dominates on the
            flat, gravity on climbs. Each coefficient is editable, with a ⌄ button
            for common presets.
          </>
        }
      >
        {/* Grouped in rows of three by what they drive: gravity, aero, friction.
            grid-3 pins it to three columns so the grouping survives wide windows. */}
        <div className="grid grid-3">
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
          <Field
            label="CdA (drag coeff × area, m²)"
            hint={cdaAdvanced ? "estimated — see panel" : "type, position, kit"}
            info={
              <>
                CdA is the <strong>drag coefficient (Cd)</strong> ×{" "}
                <strong>frontal area (A)</strong> — an effective "drag area" that
                captures both how big your frontal profile is and how slippery it
                is. It reads in m² only because Cd is dimensionless. Use the ⌄
                button to estimate it from bike, position and kit.
              </>
            }
          >
            <div className="editor-anchor" ref={cdaAnchorRef}>
              <div className="combo">
                <NumberInput
                  value={cda}
                  onChange={(v) => {
                    setCdaAdvanced(false);
                    setCdaFromEstimator(false);
                    setCda(v);
                  }}
                  step={0.01}
                  min={CDA_MIN}
                  max={CDA_MAX}
                />
                <button
                  type="button"
                  className={"preset-btn" + (cdaAdvanced ? " open" : "")}
                  title="Estimate CdA from bike, position & kit"
                  aria-label="Estimate CdA from bike, position & kit"
                  aria-expanded={cdaAdvanced}
                  onClick={() => setCdaAdvanced((o) => !o)}
                >
                  <span className="caret">▾</span>
                </button>
              </div>
              {cdaAdvanced && (
                <CdaAdvancedPanel
                  params={cdaParams}
                  massKg={riderMass}
                  onChange={onCdaParams}
                  onClose={() => setCdaAdvanced(false)}
                />
              )}
            </div>
          </Field>
          <Field
            label="Air density ρ (kg/m³)"
            hint={rhoAdvanced ? "from temp. & altitude" : "altitude / temperature"}
          >
            <div className="editor-anchor" ref={rhoAnchorRef}>
              <div className="combo">
                <NumberInput
                  value={rho}
                  onChange={(v) => {
                    setRhoAdvanced(false);
                    setRhoFromCalc(false);
                    setRho(v);
                  }}
                  step={0.005}
                  min={0.5}
                  max={1.4}
                />
                <button
                  type="button"
                  className={"preset-btn" + (rhoAdvanced ? " open" : "")}
                  title="Set air density from temperature & altitude"
                  aria-label="Set air density from temperature & altitude"
                  aria-expanded={rhoAdvanced}
                  onClick={() => setRhoAdvanced((o) => !o)}
                >
                  <span className="caret">▾</span>
                </button>
              </div>
              {rhoAdvanced && (
                <AirDensityPanel
                  params={rhoParams}
                  onChange={onRhoParams}
                  onClose={() => setRhoAdvanced(false)}
                />
              )}
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
          <Field
            label="Drivetrain efficiency"
            hint={effAdvanced ? "chain/belt × gearing" : "chain, belt, gearing"}
          >
            <div className="editor-anchor" ref={effAnchorRef}>
              <div className="combo">
                <NumberInput
                  value={eff}
                  onChange={(v) => {
                    setEffAdvanced(false);
                    setEffFromPresets(false);
                    setEff(v);
                  }}
                  step={0.01}
                  min={0.8}
                  max={1}
                />
                <button
                  type="button"
                  className={"preset-btn" + (effAdvanced ? " open" : "")}
                  title="Choose drivetrain & gearing"
                  aria-label="Choose drivetrain & gearing"
                  aria-expanded={effAdvanced}
                  onClick={() => setEffAdvanced((o) => !o)}
                >
                  <span className="caret">▾</span>
                </button>
              </div>
              {effAdvanced && (
                <DrivetrainEfficiencyPanel
                  params={effParams}
                  onChange={onEffParams}
                  onClose={() => setEffAdvanced(false)}
                />
              )}
            </div>
          </Field>
        </div>
      </Section>
    </>
  );
}
