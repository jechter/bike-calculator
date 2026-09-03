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
    nominalSize: nominalRoadSize(frameCm),
  };
}

function nominalRoadSize(frameCm: number): string {
  if (frameCm < 50) return 'XS';
  if (frameCm < 53) return 'S';
  if (frameCm < 56) return 'M';
  if (frameCm < 58) return 'L';
  if (frameCm < 61) return 'XL';
  return 'XXL';
}

// --- Height → inseam --------------------------------------------------------

/**
 * Approximate cycling inseam from body height. Cycling inseam is roughly 47% of
 * height on average (it varies with build). Used so the height-based path feeds
 * the same inseam logic as a measured inseam — measuring is still better.
 */
export function inseamFromHeight(heightCm: number): number {
  return heightCm * 0.47;
}

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
