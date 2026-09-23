// Frame size, saddle height and crank length estimates.
// See docs/calculators/frame-size.md. These are STARTING ESTIMATES only.

// --- Frame categories -------------------------------------------------------

/**
 * A bike category merges the old "frame style" (how the frame is sized) and
 * "riding position" (how low & long you sit) into one choice, because in
 * practice they go together. Each category carries everything the sizing model
 * needs: the inseam→size multiplier, the reach/stack position, and the top-tube
 * slope used to draw the actual-vs-effective seat tube in the diagram.
 */
export interface FrameCategory {
  id: string;
  label: string;
  /** optgroup heading in the picker. */
  group: string;
  /** inseam (cm) → nominal frame size (cm). */
  sizeMult: number;
  /** Reach offset (mm): larger = longer/lower cockpit. */
  reachBaseMm: number;
  /**
   * How high the front end sits above the classic (level-top-tube) seat-tube
   * top, in mm — small for race, tall for upright. Added to the seat-tube
   * vertical rise to give the stack.
   */
  frontEndRiseMm: number;
  /** Top-tube slope (degrees below horizontal) — 0 for a level vintage frame. */
  topTubeSlopeDeg: number;
  /**
   * Frame geometry style, for the diagram:
   * - 'classic'    — level top tube (slope 0).
   * - 'sloping'    — compact, sloping top tube (most modern bikes).
   * - 'suspension' — long (suspension) fork raising the front end, so the head
   *   tube can be short (mountain bikes).
   */
  geometry: 'classic' | 'sloping' | 'suspension';
  /** Also show the size in inches (mountain bikes). */
  showInches?: boolean;
}

// frontEndRiseMm is how high the front end (head-tube top = stack) sits above
// the seat cluster of a level-top-tube frame of this size. In real frames the
// top tube meets ~1 cm below the head-tube top, so this height is carried by a
// longer head tube (and, on MTBs, a longer suspension fork) — NOT by head tube
// sticking up above the top tube. A level (vintage) frame is therefore low; the
// extra height for relaxed bikes also comes from more top-tube slope and, above
// the frame, from spacers / taller stems. topTubeSlopeDeg drives the actual-vs-
// effective seat-tube split in the diagram; more slope = shorter actual seat
// tube for the same size.
export const FRAME_CATEGORIES: FrameCategory[] = [
  { id: 'tt', label: 'Time trial / triathlon', group: 'Time trial', sizeMult: 0.66, reachBaseMm: 118, frontEndRiseMm: 3, topTubeSlopeDeg: 3, geometry: 'sloping' },
  { id: 'road-aero', label: 'Aero / race', group: 'Road', sizeMult: 0.665, reachBaseMm: 100, frontEndRiseMm: 18, topTubeSlopeDeg: 5, geometry: 'sloping' },
  { id: 'road-vintage', label: 'Vintage / level top tube', group: 'Road', sizeMult: 0.665, reachBaseMm: 90, frontEndRiseMm: 22, topTubeSlopeDeg: 0, geometry: 'classic' },
  { id: 'road-endurance', label: 'Endurance / all-road', group: 'Road', sizeMult: 0.665, reachBaseMm: 80, frontEndRiseMm: 52, topTubeSlopeDeg: 7, geometry: 'sloping' },
  { id: 'gravel-race', label: 'Race', group: 'Gravel', sizeMult: 0.665, reachBaseMm: 82, frontEndRiseMm: 52, topTubeSlopeDeg: 6, geometry: 'sloping' },
  { id: 'gravel-adventure', label: 'Adventure', group: 'Gravel', sizeMult: 0.66, reachBaseMm: 66, frontEndRiseMm: 78, topTubeSlopeDeg: 10, geometry: 'sloping' },
  { id: 'mtb', label: 'Hardtail / trail', group: 'Mountain', sizeMult: 0.57, reachBaseMm: 58, frontEndRiseMm: 128, topTubeSlopeDeg: 14, geometry: 'suspension', showInches: true },
  { id: 'city', label: 'Upright', group: 'Hybrid / city', sizeMult: 0.63, reachBaseMm: 45, frontEndRiseMm: 112, topTubeSlopeDeg: 16, geometry: 'sloping' },
];

export const DEFAULT_CATEGORY_ID = 'road-endurance';

export function findCategory(id: string): FrameCategory {
  return FRAME_CATEGORIES.find((c) => c.id === id) ?? FRAME_CATEGORIES[0];
}

export const SEAT_ANGLE_DEG = 73;
const SEAT_ANGLE = (SEAT_ANGLE_DEG * Math.PI) / 180;
const SADDLE_FACTOR = 0.883; // LeMond: BB centre → saddle top, along the seat tube

// --- Nominal frame size -----------------------------------------------------

export interface FrameSizeResult {
  /** Nominal frame size in cm (inseam × the category multiplier). */
  frameCm: number;
  /** Range around the suggestion. */
  frameCmRange: [number, number];
  /** Frame size in inches (shown for mountain bikes). */
  frameInches: number;
  /** Starting saddle height (BB centre to saddle top), cm — LeMond. */
  saddleHeightCm: number;
  nominalSize: string; // XS/S/M/L/XL best guess
}

/**
 * Nominal frame size for a rider. This is a *label*, not a precise geometric
 * length: manufacturers' size numbers sit somewhere between the actual seat
 * tube and the effective (virtual, horizontal-top-tube) seat tube, so we can't
 * pin it to one geometric edge. The diagram shows both edges; this number is the
 * traditional inseam-based ballpark for finding the right size to compare.
 */
export function frameSizeFromInseam(inseamCm: number, category: FrameCategory): FrameSizeResult {
  const frameCm = inseamCm * category.sizeMult;
  return {
    frameCm,
    frameCmRange: [frameCm - 1.5, frameCm + 1.5],
    frameInches: frameCm / 2.54,
    saddleHeightCm: inseamCm * SADDLE_FACTOR,
    nominalSize: nominalSize(inseamCm),
  };
}

// --- Reverse: frame size → who it fits --------------------------------------

export interface FitFromFrameInput {
  /** Frame size as seat-tube length in cm (for mtb, convert inches × 2.54 first). */
  frameCm: number;
  category: FrameCategory;
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
 * list. Frame cm ÷ the category multiplier gives the inseam; the forward tool's
 * ±1.5 cm frame range inverts to an inseam band, which ÷ the leg proportion gives
 * a rider-height band. Inseam is the reliable match; height depends on the
 * (adjustable) leg proportion, so it is presented as a band.
 */
export function fitFromFrameSize(input: FitFromFrameInput): FitFromFrameResult {
  const { frameCm, category, legProportion = 0.47 } = input;
  const mult = category.sizeMult;
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
    saddleHeightCm: inseamCm * SADDLE_FACTOR,
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

// --- Reach & stack (fit targets) --------------------------------------------

/**
 * Reach and stack are the modern, frame-independent way to describe fit: the
 * horizontal (reach) and vertical (stack) distance from the bottom-bracket
 * centre to the top-centre of the head tube. Unlike a seat-tube "size" they
 * don't depend on how far the top tube slopes, so they compare directly across
 * brands. We estimate a *target* pair from body measurements and the chosen
 * category; these bake in typical stem/spacer/setback assumptions, so treat
 * them as a starting point and confirm with a fit, not a spec.
 */

// Acromion (shoulder) height is ~0.818 of stature; subtracting the inseam
// leaves the hip-to-shoulder torso segment that (with the arm) sets reach.
const SHOULDER_HEIGHT_RATIO = 0.818;
// Shoulder-to-wrist arm length is ~0.33 of stature (upper arm ~0.186 + forearm
// ~0.146). Used to prefill the arm field when it isn't measured.
const ARM_HEIGHT_RATIO = 0.33;
// Average cycling inseam as a fraction of stature (for the build adjustment).
const AVG_INSEAM_RATIO = 0.47;
// How much the arm estimate shifts per cm the inseam runs over/under the
// height-average: arm and leg are both long-bone traits, so a leggier build
// tends to pair with slightly longer arms (and vice versa).
const ARM_INSEAM_COEF = 0.3;

/** Estimated hip-to-shoulder torso length (cm) from stature and inseam. */
export function torsoFromHeightInseam(heightCm: number, inseamCm: number): number {
  return Math.max(0, heightCm * SHOULDER_HEIGHT_RATIO - inseamCm);
}

/** Estimated shoulder-to-wrist arm length (cm) from stature alone. */
export function armFromHeight(heightCm: number): number {
  return heightCm * ARM_HEIGHT_RATIO;
}

/**
 * Estimated arm length (cm) from stature *and* inseam — better than height
 * alone. Starts from the height estimate, then nudges for build: legs longer
 * than the height-average pair with longer arms, shorter legs with shorter arms.
 * With an average inseam it equals {@link armFromHeight}.
 */
export function armFromHeightInseam(heightCm: number, inseamCm: number): number {
  return armFromHeight(heightCm) + ARM_INSEAM_COEF * (inseamCm - AVG_INSEAM_RATIO * heightCm);
}

// Reach scales with the forward-reaching segments (torso + arm); the category's
// reachBase shifts the cockpit longer (race) or shorter (upright). Stack is the
// vertical rise of the seat tube plus the category's front-end rise (the
// head-tube section above the top tube) — small for a race front end, tall for
// an upright one. Both are consistent with the geometry drawn in the diagram.
const REACH_SLOPE = 0.25; // mm reach per mm of (torso + arm)

// Model spread shown as a band (~±1 frame size).
const REACH_TOLERANCE_MM = 12;
const STACK_TOLERANCE_MM = 15;

export interface FitTargetsInput {
  heightCm: number;
  inseamCm: number;
  armCm: number;
  category: FrameCategory;
}

export interface FitTargets {
  reachMm: number;
  reachRangeMm: [number, number];
  stackMm: number;
  stackRangeMm: [number, number];
  /** Stack ÷ reach — a compact shape descriptor (higher = more upright). */
  stackReach: number;
  /** Torso length used for the reach estimate. */
  torsoCm: number;
  /** Starting saddle height (BB centre → saddle top), cm — LeMond. */
  saddleHeightCm: number;
}

export function fitTargets(input: FitTargetsInput): FitTargets {
  const { heightCm, inseamCm, armCm, category } = input;
  const torsoCm = torsoFromHeightInseam(heightCm, inseamCm);
  const reachMm = REACH_SLOPE * (torsoCm + armCm) * 10 + category.reachBaseMm;
  const verticalRiseMm = inseamCm * 10 * category.sizeMult * Math.sin(SEAT_ANGLE);
  const stackMm = verticalRiseMm + category.frontEndRiseMm;
  return {
    reachMm,
    reachRangeMm: [reachMm - REACH_TOLERANCE_MM, reachMm + REACH_TOLERANCE_MM],
    stackMm,
    stackRangeMm: [stackMm - STACK_TOLERANCE_MM, stackMm + STACK_TOLERANCE_MM],
    stackReach: stackMm / reachMm,
    torsoCm,
    saddleHeightCm: inseamCm * SADDLE_FACTOR,
  };
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
