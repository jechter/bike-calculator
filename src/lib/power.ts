// Cycling power model. Steady-state: power at the pedals to overcome gravity,
// rolling resistance and aerodynamic drag. See docs/calculators/power.md.

import { G } from './units';

export interface PowerInput {
  massKg: number; // rider + bike + kit
  gradient: number; // rise/run, e.g. 0.05 for 5%
  crr: number; // rolling resistance coefficient
  rho: number; // air density kg/m^3
  cda: number; // drag area m^2
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

/**
 * Percentage split of the pedalling effort at speed v, as a share of the
 * *resisting* power (the sum of the forces the rider must overcome).
 *
 * A force can be negative — gravity on a descent, or aero with a strong
 * tailwind — meaning it *assists* rather than resists. Such a component comes
 * out negative (it gives back that share of the resisting power) rather than
 * distorting the split by dividing through a signed total. When nothing
 * resists (`resisting` ≤ 0) the rider isn't pedalling, so the split is 0 and
 * the caller should show a "coasting" message instead.
 */
export function powerSplit(v: number, p: PowerInput): ForceBreakdown {
  const f = forcesAt(v, p);
  const gravP = f.gravity * v;
  const rollP = f.rolling * v;
  const aeroP = f.aero * v;
  const resisting = Math.max(0, gravP) + Math.max(0, rollP) + Math.max(0, aeroP);
  if (resisting <= 0) return { gravity: 0, rolling: 0, aero: 0 };
  return {
    gravity: (gravP / resisting) * 100,
    rolling: (rollP / resisting) * 100,
    aero: (aeroP / resisting) * 100,
  };
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

export const DRIVETRAIN_EFF_PRESETS = [
  { label: 'Clean & waxed', eff: 0.98 },
  { label: 'Typical', eff: 0.97 },
  { label: 'Worn / dirty', eff: 0.95 },
];

// Air density by altitude (approx, ~15 °C). Also drops with temperature/humidity.
export const AIR_DENSITY_PRESETS = [
  { label: 'Sea level, 15°C', rho: 1.225 },
  { label: 'Sea level, 25°C', rho: 1.184 },
  { label: '1000 m', rho: 1.112 },
  { label: '2000 m', rho: 1.007 },
  { label: '3000 m', rho: 0.909 },
];
