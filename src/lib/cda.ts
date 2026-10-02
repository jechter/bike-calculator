// Advanced CdA (drag area) estimator for the cycling-power page.
//
// CdA = Cd·A — the rider+bike frontal area times the drag coefficient. We build
// it up from a *position* baseline for a reference rider, scaled by body size and
// nudged by bike type, wheelset and clothing. These are plausible engineering
// estimates to show how the knobs trade off, not wind-tunnel truth. The upright
// position baselines are anchored so an average rider reproduces the page's old
// quick presets (hoods ~0.36, drops ~0.31, aero ~0.24, MTB upright ~0.45).
//
// Bike type is the primary choice: it decides which riding positions are even
// possible (a road bike has no "sit-up aero-bar" posture; a velomobile has only
// its shell), and carries a small frame/tire-bulk drag multiplier.

export type CdaBike =
  | 'road'
  | 'endurance'
  | 'gravel'
  | 'tt'
  | 'city'
  | 'mtb'
  | 'recumbent'
  | 'velomobile';

export type CdaPosition =
  // Drop bar (road / endurance / gravel)
  | 'tops'
  | 'hoods'
  | 'drops'
  | 'dropsLow'
  | 'clipOnAero'
  // Flat bar (city / mountain)
  | 'upright'
  | 'flatForward'
  // Aero / TT bar
  | 'aeroTuck'
  | 'baseBar'
  // Recumbent
  | 'highracer'
  | 'lowracer'
  | 'lowracerTail'
  // Velomobile
  | 'shell';

export type CdaWheels = 'box' | 'mid' | 'deep' | 'disc';
export type CdaClothing = 'loose' | 'club' | 'race' | 'skinsuit' | 'skinsuitAero';

export interface CdaParams {
  bike: CdaBike;
  position: CdaPosition;
  heightCm: number;
  wheels: CdaWheels;
  clothing: CdaClothing;
}

// Baseline CdA by riding position, for the reference rider in club clothing with
// mid-depth wheels. Bike/clothing/wheel modifiers apply on top. Positions are
// grouped by handlebar type, since that's what dictates where the hands can go.
export const CDA_POSITIONS: Record<CdaPosition, { label: string; base: number }> = {
  // Drop bar: hands on the flat tops, the brake hoods, or down in the drops.
  tops: { label: 'Tops', base: 0.42 },
  hoods: { label: 'Hoods', base: 0.36 },
  drops: { label: 'Drops', base: 0.31 },
  dropsLow: { label: 'Drops, low', base: 0.28 },
  // Clip-on aero bars fitted to a drop bar — lower than the drops, but a touch
  // higher than a dedicated TT bike (non-aero frame, less-optimised position).
  clipOnAero: { label: 'Clip-on aero bars', base: 0.26 },
  // Flat bar: no hoods/drops — posture is just how far forward the rider leans.
  upright: { label: 'Upright', base: 0.5 },
  flatForward: { label: 'Leaning forward', base: 0.44 },
  // Aero / TT bar.
  aeroTuck: { label: 'Aero tuck', base: 0.24 },
  baseBar: { label: 'Base bar', base: 0.3 },
  // Reclined, feet-first recumbents — far smaller frontal area than any upright.
  highracer: { label: 'High-racer', base: 0.26 },
  lowracer: { label: 'Low-racer', base: 0.2 },
  lowracerTail: { label: 'Low-racer + tailbox', base: 0.16 },
  // Fully enclosed in an aerodynamic shell — an order below a road bike.
  shell: { label: 'Enclosed shell', base: 0.055 },
};

// Positions available per handlebar type (shared by every bike with that bar), so
// e.g. all drop-bar bikes offer exactly the same hand positions. Ordered most
// upright → lowest for the dropdown.
const DROP_BAR: CdaPosition[] = ['tops', 'hoods', 'drops', 'dropsLow', 'clipOnAero'];
const FLAT_BAR: CdaPosition[] = ['upright', 'flatForward'];
const AERO_BAR: CdaPosition[] = ['aeroTuck', 'baseBar'];
const RECUMBENT_BAR: CdaPosition[] = ['highracer', 'lowracer', 'lowracerTail'];

// Bike/geometry type: the primary choice. `positions` are the postures its
// handlebar allows; `default` is the one it opens on; `factor` is a frame/tire-
// bulk drag multiplier. `faired` bikes enclose the rider (wheels/clothing/size
// stop mattering). Drop-bar bikes share one position list and differ only by
// factor — the geometry/tire bulk, not where the hands go.
export const CDA_BIKES: ReadonlyArray<{
  value: CdaBike;
  label: string;
  factor: number;
  positions: CdaPosition[];
  default: CdaPosition;
  faired?: boolean;
}> = [
  { value: 'road', label: 'Road', factor: 1.0, positions: DROP_BAR, default: 'hoods' },
  { value: 'endurance', label: 'Endurance', factor: 1.03, positions: DROP_BAR, default: 'hoods' },
  { value: 'gravel', label: 'Gravel / adventure', factor: 1.07, positions: DROP_BAR, default: 'hoods' },
  { value: 'tt', label: 'TT / triathlon', factor: 0.96, positions: AERO_BAR, default: 'aeroTuck' },
  { value: 'city', label: 'City / touring', factor: 1.08, positions: FLAT_BAR, default: 'upright' },
  { value: 'mtb', label: 'Mountain', factor: 1.05, positions: FLAT_BAR, default: 'flatForward' },
  { value: 'recumbent', label: 'Recumbent', factor: 1.0, positions: RECUMBENT_BAR, default: 'highracer' },
  { value: 'velomobile', label: 'Velomobile (faired)', factor: 1.0, positions: ['shell'], default: 'shell', faired: true },
];

// Wheelset aero: an additive CdA delta (m²), roughly independent of body size.
export const CDA_WHEELS: ReadonlyArray<{
  value: CdaWheels;
  label: string;
  delta: number;
}> = [
  { value: 'box', label: 'Box / shallow alloy', delta: 0.005 },
  { value: 'mid', label: 'Mid aero (40–50 mm)', delta: 0.0 },
  { value: 'deep', label: 'Deep aero (60 mm+)', delta: -0.004 },
  { value: 'disc', label: 'Rear disc / deep front', delta: -0.008 },
];

// Clothing drag multiplier: flapping fabric adds drag, tight kit sheds it.
export const CDA_CLOTHING: ReadonlyArray<{
  value: CdaClothing;
  label: string;
  factor: number;
}> = [
  { value: 'loose', label: 'Loose / jacket / pack', factor: 1.12 },
  { value: 'club', label: 'Jersey & shorts', factor: 1.0 },
  { value: 'race', label: 'Tight race kit', factor: 0.95 },
  { value: 'skinsuit', label: 'Skinsuit', factor: 0.91 },
  { value: 'skinsuitAero', label: 'Skinsuit + aero helmet', factor: 0.88 },
];

export const REF_HEIGHT_CM = 175;
export const REF_MASS_KG = 72;

// Minimum/maximum the estimate is clamped to, matching the CdA field's range.
// The floor is low enough for a slippery velomobile shell (~0.04).
export const CDA_MIN = 0.03;
export const CDA_MAX = 0.7;

export const DEFAULT_CDA_PARAMS: CdaParams = {
  bike: 'road',
  position: 'hoods',
  heightCm: REF_HEIGHT_CM,
  wheels: 'mid',
  clothing: 'club',
};

/** The bike-type record for a value (falling back to the first entry). */
export function bikeByValue(bike: CdaBike) {
  return CDA_BIKES.find((b) => b.value === bike) ?? CDA_BIKES[0];
}

/** The position a bike type opens on. */
export function defaultPositionFor(bike: CdaBike): CdaPosition {
  return bikeByValue(bike).default;
}

/** Whether a bike encloses the rider in a fairing (wheels/clothing stop mattering). */
export function isFaired(bike: CdaBike): boolean {
  return !!bikeByValue(bike).faired;
}

/**
 * Frontal area scales with body size. Relative to the reference rider, using
 * DuBois-style exponents split between height and mass (taller/heavier → larger
 * frontal area, but sub-linearly).
 */
export function bodySizeScale(heightCm: number, massKg: number): number {
  const h = Number.isFinite(heightCm) && heightCm > 0 ? heightCm : REF_HEIGHT_CM;
  const m = Number.isFinite(massKg) && massKg > 0 ? massKg : REF_MASS_KG;
  return Math.pow(h / REF_HEIGHT_CM, 0.6) * Math.pow(m / REF_MASS_KG, 0.35);
}

/** Estimated CdA (m²) for the chosen setup and rider, clamped to a sane range. */
export function estimateCda(p: CdaParams, massKg: number): number {
  const bike = bikeByValue(p.bike);
  const faired = !!bike.faired;
  // Keep position consistent with the bike (callers reset it, but guard anyway).
  const position = bike.positions.includes(p.position) ? p.position : bike.default;
  const base = CDA_POSITIONS[position].base;

  const clothing = faired
    ? 1
    : CDA_CLOTHING.find((x) => x.value === p.clothing)?.factor ?? 1;
  const wheel = faired ? 0 : CDA_WHEELS.find((x) => x.value === p.wheels)?.delta ?? 0;

  // A fairing sets the frontal area, so the shell's CdA is rider-independent;
  // open vehicles scale with the rider's body.
  const scale = faired ? 1 : bodySizeScale(p.heightCm, massKg);

  const cda = base * scale * bike.factor * clothing + wheel;
  const clamped = Math.min(CDA_MAX, Math.max(CDA_MIN, cda));
  return Math.round(clamped * 1000) / 1000;
}
