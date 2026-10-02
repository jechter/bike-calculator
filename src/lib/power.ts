// Cycling power model. Steady-state: power at the pedals to overcome gravity,
// rolling resistance and aerodynamic drag. See docs/calculators/power.md.

import { G } from './units';

export interface PowerInput {
  massKg: number; // rider + bike + kit
  gradient: number; // rise/run, e.g. 0.05 for 5%
  crr: number; // rolling resistance coefficient
  rho: number; // air density kg/m^3
  cda: number; // Cd·A: drag coefficient × frontal area, m^2
  headwindMs: number; // + headwind, - tailwind
  drivetrainEfficiency: number; // e.g. 0.97
}

export interface ForceBreakdown {
  gravity: number;
  rolling: number;
  aero: number;
}

/** Resisting forces (N) at ground speed v (m/s). */
export function forcesAt(v: number, p: PowerInput): ForceBreakdown {
  const slope = Math.atan(p.gradient);
  const gravity = p.massKg * G * Math.sin(slope);
  const rolling = p.crr * p.massKg * G * Math.cos(slope);
  const apparentWind = v + p.headwindMs;
  // aero force acts against motion; keep sign consistent with apparent wind
  const aero = 0.5 * p.rho * p.cda * apparentWind * Math.abs(apparentWind);
  return { gravity, rolling, aero };
}

/** Pedal power (W) required to hold ground speed v (m/s). */
export function powerForSpeed(v: number, p: PowerInput): number {
  const f = forcesAt(v, p);
  const totalForce = f.gravity + f.rolling + f.aero;
  return (totalForce * v) / p.drivetrainEfficiency;
}

export interface PowerBreakdown {
  gravity: number; // watts at the road
  rolling: number;
  aero: number;
  drivetrain: number; // watts lost in the drivetrain
  total: number; // pedal power = sum of the above
}

/**
 * Watts breakdown of the pedalling effort at speed v: the power delivered to
 * the road against gravity, rolling and aero, plus the drivetrain loss. The
 * four sum to the total pedal power (`powerForSpeed`).
 *
 * A road component can be negative — gravity on a descent, or aero with a
 * strong tailwind — meaning it *assists* rather than resists. The drivetrain
 * loss scales with the (net) road power, so it's ≤ 0 only when the rider isn't
 * really pedalling (coasting), in which case the caller shows a note instead.
 */
export function powerBreakdown(v: number, p: PowerInput): PowerBreakdown {
  const f = forcesAt(v, p);
  const gravity = f.gravity * v;
  const rolling = f.rolling * v;
  const aero = f.aero * v;
  const roadPower = gravity + rolling + aero;
  const drivetrain = roadPower * (1 / p.drivetrainEfficiency - 1);
  return { gravity, rolling, aero, drivetrain, total: roadPower + drivetrain };
}

/**
 * Ground speed (m/s) achievable for a given pedal power. Solves
 * powerForSpeed(v) = targetPower by bisection. Monotonic in the realistic
 * range so bisection is robust. Returns 0 if no positive-speed solution
 * (target power below what's needed to move on a steep climb → would roll back).
 */
export function speedForPower(targetPowerW: number, p: PowerInput): number {
  let lo = 0;
  let hi = 30; // m/s (108 km/h) — well above realistic
  // Expand hi if somehow needed
  while (powerForSpeed(hi, p) < targetPowerW && hi < 100) hi *= 1.5;
  if (powerForSpeed(0, p) > targetPowerW) {
    // Even standing still requires more than target (steep climb) → cannot hold.
    // On a climb, gravity force at v>0 gives positive power demand growing with v,
    // but at v→0 power→0, so this branch is rare. Guard anyway.
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const pw = powerForSpeed(mid, p);
    if (pw < targetPowerW) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Presets to help users pick sane inputs.
export const CDA_PRESETS = [
  { label: 'Hoods (relaxed)', cda: 0.4 },
  { label: 'Hoods', cda: 0.35 },
  { label: 'Drops', cda: 0.3 },
  { label: 'Aero / TT', cda: 0.23 },
  { label: 'MTB upright', cda: 0.45 },
];

export const CRR_PRESETS = [
  { label: 'Fast road tire, smooth', crr: 0.004 },
  { label: 'Road tire, average', crr: 0.006 },
  { label: 'Rough tarmac', crr: 0.008 },
  { label: 'Gravel', crr: 0.012 },
  { label: 'Off-road / knobbly', crr: 0.02 },
];

// Overall drivetrain efficiency splits into two roughly independent factors that
// multiply: friction in the chain/belt itself, and losses in the gear mechanism.
// Keeping them separate stops the old single number from quietly assuming a
// best-case single-speed setup and ignoring the transmission. Each preset has a
// stable `id` (used as the picker's key — some efficiencies collide, e.g. a
// typical chain and a belt are both 0.98).
export interface EfficiencyPreset {
  id: string;
  label: string;
  eff: number;
}

// Chain/belt friction, independent of how many gears there are. A clean, waxed
// chain runs best; grit and wear add drag. A toothed belt sits a touch behind a
// fresh chain but stays consistent and sheds dirt.
export const DRIVETRAIN_PRESETS: EfficiencyPreset[] = [
  { id: 'cleanWaxed', label: 'Chain, clean & waxed', eff: 0.99 },
  { id: 'typical', label: 'Chain, typical', eff: 0.98 },
  { id: 'worn', label: 'Chain, worn / dirty', eff: 0.96 },
  { id: 'belt', label: 'Belt drive', eff: 0.98 },
];

// Losses in the gear mechanism itself. A single speed has a straight chainline
// and no idlers; a derailleur adds two jockey wheels and cross-chaining; geared
// hubs and CVTs add internal friction that grows away from direct drive. Figures
// in line with gearbox/hub efficiency testing (e.g. cyclingabout.com).
export const GEARING_PRESETS: EfficiencyPreset[] = [
  { id: 'single', label: 'Single speed', eff: 1.0 },
  { id: 'derailleur', label: 'Derailleur', eff: 0.98 },
  { id: 'igh', label: 'Internal gear hub', eff: 0.95 },
  { id: 'cvt', label: 'CVT (e.g. Enviolo)', eff: 0.85 },
];

export interface EfficiencyParams {
  drivetrain: string; // DRIVETRAIN_PRESETS id
  gearing: string; // GEARING_PRESETS id
}

export const DEFAULT_EFFICIENCY_PARAMS: EfficiencyParams = {
  drivetrain: 'typical',
  gearing: 'derailleur',
};

/** Overall drivetrain efficiency: chain/belt friction × gear-mechanism losses. */
export function combinedEfficiency(p: EfficiencyParams): number {
  const dt = DRIVETRAIN_PRESETS.find((x) => x.id === p.drivetrain)?.eff ?? 0.98;
  const gr = GEARING_PRESETS.find((x) => x.id === p.gearing)?.eff ?? 0.98;
  return Math.round(dt * gr * 1000) / 1000;
}
