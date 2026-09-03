// Tire pressure recommendation. There is no single authoritative closed-form
// model; this implements a transparent load-based estimate targeting ~15% tire
// drop (Frank Berto lineage), with modifiers for tube type and surface. Always
// clamp to sidewall/rim limits. See docs/calculators/tire.md.

export type TubeType = 'tube' | 'tubeless' | 'tubular';
export type Surface = 'smooth' | 'rough' | 'gravel' | 'offroad';

export interface TirePressureInput {
  systemWeightKg: number; // rider + bike + luggage
  frontLoadFraction: number; // e.g. 0.4 => 40% on the front wheel
  tireWidthMm: number;
  tubeType: TubeType;
  surface: Surface;
}

export interface TirePressureResult {
  frontBar: number;
  rearBar: number;
  frontPsi: number;
  rearPsi: number;
}

const BAR_TO_PSI = 14.5037738;

// Surface multiplier: rougher -> a bit lower for grip/comfort/rolling resistance.
const SURFACE_FACTOR: Record<Surface, number> = {
  smooth: 1.0,
  rough: 0.92,
  gravel: 0.85,
  offroad: 0.78,
};

// Tube-type multiplier: tubeless can run a bit lower.
const TUBE_FACTOR: Record<TubeType, number> = {
  tube: 1.0,
  tubeless: 0.88,
  tubular: 0.95,
};

/**
 * Estimate pressure for one wheel from the load it carries and tire width.
 *
 * Empirical fit in the Berto spirit: pressure rises with load-per-mm-of-width.
 * pressure_bar ~= k * (loadKg / widthMm) with a small offset, then modified.
 * This is deliberately simple and transparent, not a manufacturer chart.
 */
function wheelPressureBar(loadKg: number, widthMm: number): number {
  // Pressure scales with load carried per mm of tire width. The coefficient is
  // calibrated to land in the right ballpark: e.g. ~40 kg on a 25 mm tire ≈ 5 bar
  // (~75 psi), ~50 kg on a 28 mm tire ≈ 5.7 bar, wide tires much lower. A
  // transparent starting estimate, not a manufacturer chart.
  const loadPerMm = loadKg / widthMm;
  const bar = 3.2 * loadPerMm;
  return Math.min(8.5, Math.max(1.5, bar));
}

export function recommendTirePressure(input: TirePressureInput): TirePressureResult {
  const { systemWeightKg, frontLoadFraction, tireWidthMm, tubeType, surface } = input;
  const front = systemWeightKg * frontLoadFraction;
  const rear = systemWeightKg * (1 - frontLoadFraction);
  const mod = SURFACE_FACTOR[surface] * TUBE_FACTOR[tubeType];

  const frontBar = wheelPressureBar(front, tireWidthMm) * mod;
  const rearBar = wheelPressureBar(rear, tireWidthMm) * mod;

  return {
    frontBar,
    rearBar,
    frontPsi: frontBar * BAR_TO_PSI,
    rearPsi: rearBar * BAR_TO_PSI,
  };
}
