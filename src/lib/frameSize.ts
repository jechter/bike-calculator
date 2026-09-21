// Frame size, saddle height and crank length estimates.
// See docs/calculators/frame-size.md. These are STARTING ESTIMATES only.

export type FrameStyle = 'road' | 'mtb' | 'gravel' | 'hybrid' | 'touring';

export interface FrameSizeInput {
  inseamCm: number;
  style: FrameStyle;
}

export interface FrameSizeResult {
  /** Suggested frame size in cm (seat tube c-t) for road-like styles. */
  frameCm: number;
  /** Range around the suggestion. */
  frameCmRange: [number, number];
  /** MTB frame size in inches (for mtb style). */
  frameInches: number;
  /** Starting saddle height (BB centre to saddle top), cm — LeMond. */
  saddleHeightCm: number;
  nominalSize: string; // XS/S/M/L/XL best guess
}

// Multipliers by style for inseam -> frame size (cm). Road/gravel/touring track
// road sizing; mtb/hybrid run smaller frames.
const FRAME_MULTIPLIER: Record<FrameStyle, number> = {
  road: 0.665,
  gravel: 0.665,
  touring: 0.66,
  hybrid: 0.63,
  mtb: 0.57,
};

export function frameSizeFromInseam(input: FrameSizeInput): FrameSizeResult {
  const { inseamCm, style } = input;
  const frameCm = inseamCm * FRAME_MULTIPLIER[style];
  const saddleHeightCm = inseamCm * 0.883; // LeMond
  return {
    frameCm,
    frameCmRange: [frameCm - 1.5, frameCm + 1.5],
    frameInches: frameCm / 2.54,
    saddleHeightCm,
    nominalSize: nominalSize(inseamCm),
  };
}

// --- Reverse: frame size → who it fits --------------------------------------

export interface FitFromFrameInput {
  /** Frame size as seat-tube length in cm (for mtb, convert inches × 2.54 first). */
  frameCm: number;
  style: FrameStyle;
  /** Leg-length proportion used only for the rider-height estimate (see below). */
  legProportion?: number;
}

export interface FitFromFrameResult {
  /** Central inseam this frame is built around. */
  inseamCm: number;
  /** Inseam band that maps onto this frame (the forward ±1.5 cm range, inverted). */
  inseamRangeCm: [number, number];
  /** Central rider height at the chosen leg proportion. */
  heightCm: number;
  /** Rider-height band (the inseam band ÷ the chosen leg proportion). */
  heightRangeCm: [number, number];
  nominalSize: string;
  /** Starting saddle height for the central inseam. */
  saddleHeightCm: number;
}

/**
 * Inverse of {@link frameSizeFromInseam}: given a frame you already have, work out
 * the rider it fits — the workshop case of matching a donated bike to a waiting
 * list. Frame cm ÷ the style multiplier gives the inseam; the forward tool's
 * ±1.5 cm frame range inverts to an inseam band, which ÷ the leg proportion gives
 * a rider-height band. Inseam is the reliable match; height depends on the
 * (adjustable) leg proportion, so it is presented as a band.
 */
export function fitFromFrameSize(input: FitFromFrameInput): FitFromFrameResult {
  const { frameCm, style, legProportion = 0.47 } = input;
  const mult = FRAME_MULTIPLIER[style];
  const inseamCm = frameCm / mult;
  const inseamRangeCm: [number, number] = [(frameCm - 1.5) / mult, (frameCm + 1.5) / mult];
  const heightCm = inseamCm / legProportion;
  const heightRangeCm: [number, number] = [
    inseamRangeCm[0] / legProportion,
    inseamRangeCm[1] / legProportion,
  ];
  return {
    inseamCm,
    inseamRangeCm,
    heightCm,
    heightRangeCm,
    nominalSize: nominalSize(inseamCm),
    saddleHeightCm: inseamCm * 0.883,
  };
}

/**
 * Nominal S/M/L size from the rider's inseam (body size), NOT the style-scaled
 * frame cm — a "Medium" rider is Medium on a road bike or an MTB, even though the
 * seat-tube numbers differ. Thresholds derived from the usual height ranges via
 * the ~0.47 inseam ratio.
 */
function nominalSize(inseamCm: number): string {
  if (inseamCm < 77) return 'XS';
  if (inseamCm < 80) return 'S';
  if (inseamCm < 84) return 'M';
  if (inseamCm < 87) return 'L';
  if (inseamCm < 91) return 'XL';
  return 'XXL';
}

// --- Height → inseam --------------------------------------------------------

/**
 * Approximate cycling inseam from body height. Cycling inseam is roughly 47% of
 * height on average, but leg-to-height proportion varies (on average women have
 * proportionally longer legs, i.e. a higher ratio). The proportion is passed in
 * so height-based sizing can be adjusted; measuring the inseam avoids the guess.
 */
export function inseamFromHeight(heightCm: number, legProportion = 0.47): number {
  return heightCm * legProportion;
}

// Leg-length proportion options for the height-based estimate.
export interface LegProportion {
  value: number;
  label: string;
}

export const LEG_PROPORTIONS: LegProportion[] = [
  { value: 0.47, label: "Average (≈47% of height)" },
  { value: 0.49, label: "Longer legs (≈49%)" },
  { value: 0.45, label: "Shorter legs (≈45%)" },
];

// --- Crank length -----------------------------------------------------------

/** Available crank lengths (mm) commonly sold. */
export const CRANK_SIZES = [160, 165, 167.5, 170, 172.5, 175, 177.5, 180];

export interface CrankSuggestion {
  suggestedMm: number; // nearest available size
  rangeMm: [number, number]; // rough range from the two rules of thumb
}

/**
 * Suggest a crank length from inseam. Published formulas disagree; we take two
 * common rules of thumb and present the spanning range, then snap the midpoint
 * to the nearest available size. Fit/preference dominates; shorter cranks are a
 * current trend.
 */
export function suggestCrankLength(inseamCm: number): CrankSuggestion {
  const inseamMm = inseamCm * 10;
  const a = inseamCm * 1.25 + 65; // common "1.25 x inseam(cm) + 65 mm" rule
  const b = inseamMm * 0.216; // "0.216 x inseam(mm)" rule
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const mid = (lo + hi) / 2;
  const suggestedMm = CRANK_SIZES.reduce((best, s) =>
    Math.abs(s - mid) < Math.abs(best - mid) ? s : best,
  );
  return { suggestedMm, rangeMm: [lo, hi] };
}
