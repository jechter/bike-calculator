// Frame size, saddle height and crank length estimates.
// See docs/calculators/frame-size.md. These are STARTING ESTIMATES only.
//
// The editable data — the frame categories (with their blurb/sizing text and
// per-category cockpit) and the wheel definitions — lives in src/data/*.json;
// this module just types it and holds the fit logic.

import frameCategoriesData from "../data/frameCategories.json";
import wheelsData from "../data/wheels.json";

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
  /** One line on what makes this category distinct. */
  blurb: string;
  /** What actually matters when sizing a bike of this category. */
  sizing: string;
  /** The typical stem + bar setup for this category (its average-frame cockpit). */
  cockpit: CockpitSpec;
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
export const FRAME_CATEGORIES: FrameCategory[] = frameCategoriesData as unknown as FrameCategory[];

export const DEFAULT_CATEGORY_ID = 'road-endurance';

export function findCategory(id: string): FrameCategory {
  return FRAME_CATEGORIES.find((c) => c.id === id) ?? FRAME_CATEGORIES[0];
}

export const SEAT_ANGLE_DEG = 73;
const SEAT_ANGLE = (SEAT_ANGLE_DEG * Math.PI) / 180;
const SADDLE_FACTOR = 0.883; // LeMond: BB centre → saddle top, along the seat tube
/**
 * Starting saddle height (BB centre → saddle top), cm, from the cycling inseam and
 * the crank length. At the crank length *suggested* for that inseam it's the plain
 * LeMond 0.883 × inseam; fitting a longer crank than suggested lowers the saddle by
 * the difference (a shorter one raises it), keeping leg extension at the bottom of
 * the stroke consistent. Referencing the suggested crank rather than a fixed 170 mm
 * means a correctly-cranked bike — an adult's or a kid's short-crank bike — sits at
 * the LeMond height with no spurious adjustment.
 */
export function saddleHeight(inseamCm: number, crankMm?: number): number {
  const refCrankMm = suggestCrankLength(inseamCm).suggestedMm;
  const crank = crankMm ?? refCrankMm;
  return inseamCm * SADDLE_FACTOR - (crank - refCrankMm) / 10;
}

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

/** The nominal sizes, smallest to largest — for the (editable) size picker. */
export const NOMINAL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

/**
 * A representative cycling inseam (cm) for a nominal size — the middle of the band
 * {@link nominalSize} assigns — so picking a size from the menu sets a sensible
 * rider (and round-trips back to the same label).
 */
export function inseamForNominal(size: string): number {
  switch (size) {
    case 'XS': return 74;
    case 'S': return 78.5;
    case 'M': return 82;
    case 'L': return 85.5;
    case 'XL': return 89;
    case 'XXL': return 93;
    default: return 82;
  }
}

/** The nominal size a frame reads as, via the cycling inseam it implies for its
 *  category — so the size label always matches the frame-size number. */
export function nominalForFrame(frameCm: number, category: FrameCategory): string {
  return nominalSize(inseamFromFrame(frameCm, category));
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

// --- Wheel size -------------------------------------------------------------

/**
 * A wheel standard, described the way cyclists actually talk about wheels: a
 * common name (700c, 29", …), the precise tyre-independent ISO/ETRTO bead-seat
 * diameter, and an approximate outer diameter with a typical tyre for that use
 * (so the diagram can draw it to scale).
 */
export interface Wheel {
  /** Common name: "700c", "650b", "29\"", "27.5\"", "26\"", "27\"", "28\"". */
  label: string;
  /** ISO/ETRTO bead-seat diameter (mm) — the precise, tyre-independent number. */
  isoMm: number;
  /** Approx outer diameter with a typical tyre for this use (mm), for the diagram. */
  outerMm: number;
  /** One line on why this wheel suits the frame. */
  note: string;
}

// Every wheel size, largest to smallest — for the (editable) wheel picker.
export const WHEELS: Wheel[] = wheelsData as Wheel[];

// Internal lookup by label, used by the wheelForFrame rules below.
const wheel = (label: string): Wheel => WHEELS.find((w) => w.label === label) as Wheel;

/** Look up a wheel by its common name (e.g. "700c", "29\""). */
export function wheelByLabel(label: string): Wheel | undefined {
  return WHEELS.find((w) => w.label === label);
}

/**
 * Pick the wheel that makes sense for a frame's style *and* size. Style sets the
 * standard (700c road/gravel, 29" trail, 27" vintage road, …); size then shifts
 * it where the industry does — the smallest road/gravel frames drop to 650b, and
 * the smallest trail frames drop from 29" to 27.5" — so the drawn wheel and the
 * quoted size track how the bike would really be built. `frameCm` is the nominal
 * (seat-tube) size in cm.
 */
export function wheelForFrame(category: FrameCategory, frameCm: number): Wheel {
  // Below the adult range, a bike is sized by its wheel regardless of style, so
  // step down a kids' ladder. Key it off the rider's cycling inseam (frame ÷ the
  // category multiplier) rather than the raw frame cm, so a small "road" and a
  // small "mtb" frame — which carry different multipliers — land on the same
  // wheel for the same-sized child.
  const inseamCm = frameCm / category.sizeMult;
  if (inseamCm < 42) return wheel('12"');
  if (inseamCm < 47) return wheel('14"');
  if (inseamCm < 52) return wheel('16"');
  if (inseamCm < 60) return wheel('20"');
  if (inseamCm < 66) return wheel('24"');

  switch (category.id) {
    case 'mtb':
      // Trail bikes run 29"; the smallest sizes drop to 27.5" for standover/handling.
      return frameCm < 44 ? wheel('27.5"') : wheel('29"');
    case 'vintage-road':
      return wheel('27"');
    case 'vintage-mtb':
      return wheel('26"');
    case 'vintage-city':
      return wheel('28"');
    case 'city':
      return wheel('700c');
    default:
      // Road, gravel and TT: 700c, dropping to 650b on the smallest frames.
      return frameCm < 48 ? wheel('650b') : wheel('700c');
  }
}

// --- Cockpit (stem + bar) ---------------------------------------------------

/**
 * The stem + handlebar setup used to draw the riding position and quote the
 * cockpit. Like the rest of the fit model these are hand-picked approximations,
 * not a spec — a *typical* build for the category and size.
 */
export type BarType = "drop" | "flat" | "aero";
export interface CockpitSpec {
  /** Stem length (mm), scaled with frame size. */
  stemLenMm: number;
  /**
   * Stem angle in the conventional sense: degrees from perpendicular to the
   * steerer — the number printed on a stem (e.g. ±6°, +17°). Positive raises the
   * bar. The drawn angle vs. the ground adds the head tube's lean (90° − head
   * angle), so a stem near −18° sits roughly level on a typical frame.
   */
  stemRiseDeg: number;
  /** Spacer stack / quill height under the stem (mm), scaled with frame size. */
  spacerMm: number;
  /** Handlebar type — sets the drawn bar and its hand positions. */
  bar: BarType;
  /** Primary hand position (fwd/drop from the bar clamp, mm): hoods / grip / extensions. */
  gripFwdMm: number;
  gripDropMm: number;
}

// The per-category base cockpit (category.cockpit, from frameCategories.json) is
// defined for the category's AVERAGE frame (an 84 cm inseam); cockpitForFrame()
// scales the stem + spacers around it by frame size. gripFwd/Drop and the bar type
// stay constant per category. stemRiseDeg is the printed stem angle (from
// perpendicular to the steerer); the diagram adds the head tube's lean, so ~−18°
// draws level, more positive rises.

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

// How the stem/spacers move per cm of frame away from the category average.
const STEM_PER_CM = 1.8; // longer stem on a bigger frame
const SPACER_PER_CM = 1.0; // smaller frames run more spacers to reach the bars

/**
 * The cockpit for a frame of this style *and* size. Bigger frames get a longer
 * stem and (since their head tubes are taller) fewer spacers; smaller frames the
 * reverse — so the quoted stem length and spacer stack, and the stem drawn in the
 * diagram, both track the frame size instead of being fixed per category. Stem
 * length is snapped to the usual 10 mm increments and spacers to 5 mm.
 */
export function cockpitForFrame(category: FrameCategory, frameCm: number): CockpitSpec {
  const base = category.cockpit;
  const refCm = 84 * category.sizeMult; // frame size for the average rider
  const d = frameCm - refCm;
  return {
    ...base,
    stemLenMm: clampN(roundTo(base.stemLenMm + STEM_PER_CM * d, 10), 35, 140),
    spacerMm: clampN(roundTo(base.spacerMm - SPACER_PER_CM * d, 5), 5, 60),
  };
}

// Head-tube angle used to turn a stack shortfall into spacer height: spacers
// climb the steerer, so their vertical lift is sin(head angle) per mm.
const HEAD_ANGLE = (72 * Math.PI) / 180;

export interface CockpitFitGaps {
  /** Rider target reach − the frame's actual reach (mm). +ve = frame too short. */
  reachGapMm?: number;
  /** Rider target stack − the frame's actual stack (mm). +ve = frame too low. */
  stackGapMm?: number;
}

/**
 * The recommended cockpit for a frame, compensating a reach/stack mismatch. On
 * top of the size-scaled base ({@link cockpitForFrame}), a frame that's too short
 * for the rider gets a longer stem (≈1:1 with the reach shortfall), and one that's
 * too low gets more spacers — a vertical stack shortfall needs shortfall ÷ sin(head
 * angle) of spacer, since spacers climb the steerer. Both stay within buildable
 * limits, so a gap too big to fix this way is only partly closed (and then shows
 * up as the rider over-reaching in the diagram).
 */
export function cockpitForFit(
  category: FrameCategory,
  frameCm: number,
  gaps: CockpitFitGaps = {},
): CockpitSpec {
  const base = cockpitForFrame(category, frameCm);
  const reachGap = gaps.reachGapMm ?? 0;
  const stackGap = gaps.stackGapMm ?? 0;
  return {
    ...base,
    stemLenMm: clampN(roundTo(base.stemLenMm + reachGap, 10), 35, 150),
    spacerMm: clampN(roundTo(base.spacerMm + stackGap / Math.sin(HEAD_ANGLE), 5), 0, 80),
  };
}

// --- Crank length -----------------------------------------------------------

/** Available crank lengths (mm) commonly sold — kids' lengths through adult. */
export const CRANK_SIZES = [
  102, 114, 127, 140, 152, 155, 160, 165, 167.5, 170, 172.5, 175, 177.5, 180,
];

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

// --- Unified two-way solve --------------------------------------------------

// The frame-size page is one linked model, not a set of separate calculators:
// every measurement is editable, and each one you set fills in the rest with a
// best guess. body height, cycling inseam, frame size, reach and stack are all
// different windows onto the same rider + frame, so we resolve them from a
// single hidden body model (height, inseam, arm) and recompute every field from
// it. The inverse helpers below turn a frame-side number the user typed back
// into the body measurement it implies.

/** Cycling inseam (cm) implied by a nominal frame size — inverse of the size multiplier. */
export function inseamFromFrame(frameCm: number, category: FrameCategory): number {
  return frameCm / category.sizeMult;
}

/**
 * Cycling inseam (cm) implied by a stack height — inverse of the stack model in
 * {@link fitTargets} (stack = seat-tube vertical rise + the category front-end rise).
 */
export function inseamFromStack(stackMm: number, category: FrameCategory): number {
  const denom = 10 * category.sizeMult * Math.sin(SEAT_ANGLE);
  return (stackMm - category.frontEndRiseMm) / denom;
}

/**
 * Body height (cm) implied by a reach target, given the inseam — inverse of the
 * reach model in {@link fitTargets} (reach ∝ torso + arm). If the arm length is
 * known it's held fixed; otherwise arm is taken as its height+inseam estimate
 * and folded into the solve, so a typed reach reproduces exactly on the way back.
 */
export function heightFromReach(
  reachMm: number,
  inseamCm: number,
  category: FrameCategory,
  armCm?: number | null,
): number {
  // reach = REACH_SLOPE·10·(torso + arm) + reachBase  ⇒  torso + arm (cm):
  const reachSum = (reachMm - category.reachBaseMm) / (REACH_SLOPE * 10);
  if (typeof armCm === "number" && Number.isFinite(armCm)) {
    // torso = reachSum − arm, and torso = shoulderRatio·H − inseam.
    return (reachSum - armCm + inseamCm) / SHOULDER_HEIGHT_RATIO;
  }
  // Arm estimated from height & inseam, so reachSum is linear in H and inseam:
  //   reachSum = coefH·H + coefI·inseam   (substitute armFromHeightInseam).
  const coefH = SHOULDER_HEIGHT_RATIO + ARM_HEIGHT_RATIO - ARM_INSEAM_COEF * AVG_INSEAM_RATIO;
  const coefI = -1 + ARM_INSEAM_COEF;
  return (reachSum - coefI * inseamCm) / coefH;
}

/** A rider height used to seed the model before anything is entered. */
export const SEED_HEIGHT_CM = 178;

/**
 * The measurements the user may pin. Any left null/undefined are filled from a
 * best guess. At most one of {inseamCm, frameCm, stackCm} should be set (they all
 * pin the inseam) and at most one of {heightCm, reachMm} (they both pin height);
 * the UI enforces that by clearing the others when one is edited.
 */
export interface FitFields {
  heightCm?: number | null;
  inseamCm?: number | null;
  armCm?: number | null;
  frameCm?: number | null;
  reachMm?: number | null;
  stackMm?: number | null;
}

export interface ResolvedFit {
  heightCm: number;
  inseamCm: number;
  armCm: number;
  /** Nominal frame size (cm) — equals a typed frame size, else derived from inseam. */
  frameCm: number;
  frame: FrameSizeResult;
  /** The rider's own target reach/stack, from the resolved body. */
  targets: FitTargets;
  /**
   * The frame's reach/stack: when a frame size is pinned it drives these (via the
   * rider it implies), so they describe the frame; otherwise they equal the rider
   * target. This is what the reach/stack fields show and the diagram draws.
   */
  frameTargets: FitTargets;
  crank: CrankSuggestion;
  wheel: Wheel;
  /** Typical cockpit for the resolved frame — the default, before any user override. */
  cockpit: CockpitSpec;
  saddleHeightCm: number;
}

const isNum = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * Resolve the whole linked model from whatever the user has pinned. Nothing is
 * cleared: any field can be held, and the rest are *recommended*. A measured inseam
 * always wins; otherwise, if a body height is given the inseam (and arm) are derived
 * from it — a height fixes the rider's proportions, so a frame or stack pinned
 * alongside it drives only its own part of the bike, not the body. With no height,
 * the inseam comes from a typed frame size, else a typed stack, so the tool still
 * works back from a frame to the rider. Height is a typed height, else proposed from
 * the inseam, else the seed; a typed reach proposes the height when none is pinned.
 * Frame size is taken as typed (a real frame is its own measurement) and only
 * otherwise derived from the inseam; the wheel and typical cockpit follow it.
 */
export function resolveFit(
  fields: FitFields,
  category: FrameCategory,
  legProportion = 0.47,
): ResolvedFit {
  const { heightCm, inseamCm, armCm, frameCm: frameCm_, reachMm, stackMm } = fields;
  const iHasSource = isNum(inseamCm) || isNum(frameCm_) || isNum(stackMm);
  const hHasDirect = isNum(heightCm);

  // Inseam: a measured value wins; else a body height fixes it (and so the whole
  // body), taking priority over a frame/stack; else it's worked back from a frame
  // size or a stack.
  let I = isNum(inseamCm)
    ? inseamCm
    : hHasDirect
      ? (heightCm as number) * legProportion
      : isNum(frameCm_)
        ? inseamFromFrame(frameCm_, category)
        : isNum(stackMm)
          ? inseamFromStack(stackMm, category)
          : NaN;

  // Height: pinned directly, else proposed from the inseam, else the seed.
  let H = hHasDirect ? (heightCm as number) : NaN;
  if (!Number.isFinite(H) && !iHasSource) H = SEED_HEIGHT_CM;
  if (!Number.isFinite(H) && iHasSource) H = I / legProportion;
  if (!Number.isFinite(I)) I = H * legProportion;

  let A = isNum(armCm) ? armCm : armFromHeightInseam(H, I);

  // A typed reach proposes the height, unless one was pinned directly.
  if (isNum(reachMm) && !hHasDirect) {
    H = heightFromReach(reachMm, I, category, isNum(armCm) ? armCm : null);
    if (!iHasSource) I = H * legProportion;
    if (!isNum(armCm)) A = armFromHeightInseam(H, I);
  }

  const targets = fitTargets({ heightCm: H, inseamCm: I, armCm: A, category });
  // Reach & stack describe the FRAME, so a pinned frame size drives them (via its
  // implied rider) — mirroring how a body height drives the inseam/arm. Without a
  // pinned frame they equal the rider's own target.
  const frameTargets = isNum(frameCm_)
    ? (() => {
        const fi = inseamFromFrame(frameCm_, category);
        const fh = fi / legProportion;
        return fitTargets({ heightCm: fh, inseamCm: fi, armCm: armFromHeightInseam(fh, fi), category });
      })()
    : targets;
  const frame = frameSizeFromInseam(I, category);
  // A typed frame size is its own measurement; only fall back to the inseam-
  // derived recommendation when it's blank. The wheel and cockpit follow it.
  const frameCm = isNum(frameCm_) ? frameCm_ : frame.frameCm;
  const crank = suggestCrankLength(I);
  const wheel = wheelForFrame(category, frameCm);
  const cockpit = cockpitForFrame(category, frameCm);

  return {
    heightCm: H,
    inseamCm: I,
    armCm: A,
    frameCm,
    frame,
    targets,
    frameTargets,
    crank,
    wheel,
    cockpit,
    saddleHeightCm: saddleHeight(I, crank.suggestedMm),
  };
}
