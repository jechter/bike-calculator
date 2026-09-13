// Spoke length geometry and spoke-tension conversion.
// See docs/calculators/wheel-building.md.
//
// The hub database and tensiometer curves live in data/hubs.json and
// data/tension-curves.json so they can be added or edited without touching
// code — see src/data/README.md.

import hubsData from '../data/hubs.json';
import tensionCurvesData from '../data/tension-curves.json';

export interface SpokeSideInput {
  /** Flange diameter (mm): diameter of the circle through the spoke holes. */
  flangeDiameterMm: number;
  /** Distance from wheel centreline to this flange (mm). */
  flangeOffsetMm: number;
}

export interface SpokeInput {
  erdMm: number; // effective rim diameter
  spokeCount: number; // total spokes (both sides)
  cross: number; // number of crosses per spoke (0 = radial)
  spokeHoleDiameterMm?: number; // flange hole diameter, default 2.6
  side: SpokeSideInput;
  /** Spokes on THIS flange. Defaults to spokeCount/2 (symmetric); for a 2:1 hub
   *  it's 2·n/3 on the drive side and n/3 on the non-drive side. */
  flangeSpokeCount?: number;
}

// How the total spoke count is split between the two flanges.
//  "1:1" — the usual even split (n/2 each).
//  "2:1" — twice as many on the drive side (2n/3 drive, n/3 non-drive), a
//          tension-balancing layout for heavily dished rear wheels.
export type HubRatio = '1:1' | '2:1';

export interface FlangeCounts {
  drive: number;
  nds: number;
}

export function flangeSpokeCounts(spokeCount: number, ratio: HubRatio): FlangeCounts {
  if (ratio === '2:1') return { nds: spokeCount / 3, drive: (2 * spokeCount) / 3 };
  return { nds: spokeCount / 2, drive: spokeCount / 2 };
}

export interface SpokeHole {
  isDrive: boolean;
  /** This spoke's index within its own flange (0-based, around the wheel). */
  flangeIndex: number;
  /** Total spokes on this flange (for the crossing angle + flange pitch). */
  flangeSpokes: number;
}

/**
 * Which flange each rim hole feeds, and its per-flange index. Rim holes stay
 * evenly spaced; only the flange assignment changes. 1:1 alternates drive/non-
 * drive; 2:1 repeats drive-drive-non-drive so the drive flange gets two thirds.
 */
export function wheelLayout(spokeCount: number, ratio: HubRatio): SpokeHole[] {
  const { drive, nds } = flangeSpokeCounts(spokeCount, ratio);
  const out: SpokeHole[] = [];
  let jd = 0;
  let jn = 0;
  for (let i = 0; i < spokeCount; i++) {
    const isDrive = ratio === '2:1' ? i % 3 !== 2 : i % 2 === 0;
    out.push(
      isDrive
        ? { isDrive: true, flangeIndex: jd++, flangeSpokes: drive }
        : { isDrive: false, flangeIndex: jn++, flangeSpokes: nds },
    );
  }
  return out;
}

/**
 * Spoke length for one side.
 *   theta = 720 * cross / spokeCount   (degrees)
 *   d1 = R sin theta
 *   d2 = ERD/2 - R cos theta
 *   d3 = flange offset
 *   L  = sqrt(d1^2 + d2^2 + d3^2) - holeDia/2
 */
export function spokeLength(input: SpokeInput): number {
  const { erdMm, spokeCount, cross, side } = input;
  const holeDia = input.spokeHoleDiameterMm ?? 2.6;
  const R = side.flangeDiameterMm / 2;
  const perFlange = input.flangeSpokeCount ?? spokeCount / 2;
  const thetaRad = (2 * Math.PI * cross) / perFlange;
  const d1 = R * Math.sin(thetaRad);
  const d2 = erdMm / 2 - R * Math.cos(thetaRad);
  const d3 = side.flangeOffsetMm;
  return Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3) - holeDia / 2;
}

/**
 * Handedness (leading = +1, trailing = -1) of a flange's spokes for a gLgT
 * grouped-lacing pattern. `flangeIndex` counts a single flange's spokes in order
 * around it (0 … n/2-1); `group` is the run length: 1 = standard 1L1T alternation
 * (leading, trailing, leading, …), 2 = 2L2T (two leading, two trailing, …), and
 * so on. Grouping only re-pairs which hub hole each spoke uses — every spoke still
 * spans the same k flange-hole pitches, so it never changes spoke length.
 */
export function spokeLead(flangeIndex: number, group: number): 1 | -1 {
  const g = Math.max(1, Math.floor(group) || 1);
  return Math.floor(flangeIndex / g) % 2 === 0 ? 1 : -1;
}

export type LacingPattern = 'standard' | 'crowsfoot';

export interface SpokePlan {
  /** Flange-hole offset from the radial position, in flange-hole pitches. */
  offset: number;
  /** Weave role: +1 leading, -1 trailing, 0 radial (never crosses). */
  lead: 1 | -1 | 0;
}

/**
 * Per-spoke lacing plan for a flange's j-th spoke. Standard (and grouped) lacing
 * sends every spoke `lead·cross` hole-pitches from radial. Crow's foot repeats a
 * group of three — a leading crossed spoke (+cross), a radial spoke (0), and a
 * trailing crossed spoke (−cross) — so the two crossed spokes flank the radial and
 * cross each other, forming the "foot". Spoke length still follows `offset` only:
 * the crossed spokes get the cross-length, the radial ones the 0-cross length.
 */
export function spokePlan(
  flangeIndex: number,
  opts: { cross: number; group: number; pattern: LacingPattern },
): SpokePlan {
  if (opts.pattern === 'crowsfoot') {
    const r = ((flangeIndex % 3) + 3) % 3;
    if (r === 0) return { offset: opts.cross, lead: 1 };
    if (r === 1) return { offset: 0, lead: 0 };
    return { offset: -opts.cross, lead: -1 };
  }
  // A 0-cross spoke sits radially and never crosses another, so it has no
  // leading/trailing role — treat it as radial (lead 0) like a crow's foot centre.
  if (opts.cross === 0) return { offset: 0, lead: 0 };
  const lead = spokeLead(flangeIndex, opts.group);
  return { offset: lead * opts.cross, lead };
}

// --- Lacing feasibility -----------------------------------------------------
// Two limits bound the cross count:
//  1. Symmetric cross lacing splits each side's n/2 spokes into equal leading
//     and trailing halves, so it needs n/4 spokes per group — the count must be
//     divisible by 4. Counts like 22 or 26 (n/2 odd) can't be cross-laced at all
//     (two spokes would be forced to share a flange hole); they lace radially only.
//  2. A k-cross spoke subtends 720°·k/n at the hub. Past 90° it would have to wrap
//     backwards, so the max is floor(n/8) — the standard table (32h → 4x, 24h → 3x).

export function maxCross(spokeCount: number): number {
  if (spokeCount % 4 !== 0) return 0; // not divisible by 4 → radial only
  return Math.floor(spokeCount / 8);
}

export interface LacingCheck {
  ok: boolean;
  errors: string[];
}

// Grouped lacing (gLgT) is a bijective, equal-length pattern on a normally-drilled
// hub + rim only when two extra rules hold, on top of the ordinary cross limits:
//   a. spokeCount % (4·g) === 0  — so each flange splits into balanced runs of g
//      leading and g trailing spokes.
//   b. cross % g === 0           — otherwise a leading and a trailing spoke land in
//      the same flange hole (the shift between a group's ends is 2k mod 2g, which is
//      only zero when k is a multiple of g). Odd crosses with 2L2T, etc., need a
//      specially paired-drilled rim, which this calculator doesn't model.
export function checkWheelLacing(
  spokeCount: number,
  leftCross: number,
  rightCross: number,
  leftGroup: number = 1,
  rightGroup: number = 1,
  leftPattern: LacingPattern = 'standard',
  rightPattern: LacingPattern = 'standard',
  ratio: HubRatio = '1:1',
): LacingCheck {
  const errors: string[] = [];
  // The count rule depends on the layout: 1:1 splits in half (needs an even total),
  // 2:1 splits two-to-one (needs a multiple of 3 — odd totals like 21 are fine).
  let countError: string | null = null;
  if (!Number.isFinite(spokeCount) || spokeCount < 8) {
    countError = "Spoke count should be at least 8.";
  } else if (ratio === '2:1') {
    if (spokeCount % 3 !== 0)
      countError =
        "A 2:1 hub splits the spokes two-to-one between the flanges, so the count " +
        "must be divisible by 3 (e.g. 21, 24, 27, 30 or 36).";
  } else if (spokeCount % 2 !== 0) {
    countError = "Spoke count must be even — each side takes half the spokes.";
  }
  if (countError) {
    errors.push(countError);
  } else {
    // Each flange is checked against its own spoke count: max cross is fSide/4
    // (a k-cross spoke subtends 360°·k/fSide, capped at 90°), cross lacing needs
    // an even fSide, grouping needs fSide divisible by 2·g, crow's foot by 3.
    const { drive, nds } = flangeSpokeCounts(spokeCount, ratio);
    const sideCheck = (label: string, k: number, g: number, pattern: LacingPattern, fSide: number) => {
      const kmax = Math.floor(fSide / 4);
      const maxLabel = kmax === 0 ? 'radial (0-cross)' : `${kmax}-cross`;
      if (pattern === 'crowsfoot') {
        if (fSide % 3 !== 0) {
          errors.push(
            `${label}: crow's foot laces three spokes per foot, so this flange's ` +
              `${fSide} spokes must be divisible by 3.`,
          );
          return;
        }
        if (!Number.isInteger(k) || k < 2) {
          errors.push(
            `${label}: crow's foot needs at least a 2-cross for each foot's two outer ` +
              `spokes — radial or 1-cross can't form a foot.`,
          );
        } else if (k % 3 === 1) {
          errors.push(
            `${label}: ${k}-cross can't lace crow's foot — a crossed spoke would land ` +
              `in the radial spoke's hole. Use 2- or 3-cross.`,
          );
        } else if (k > kmax) {
          errors.push(
            `${label}: ${k}-cross crossed spokes would exceed 90° on this ${fSide}-spoke ` +
              `flange — max is ${maxLabel}.`,
          );
        }
        return;
      }
      let crossOk = true;
      if (!Number.isInteger(k) || k < 0) {
        errors.push(`${label}: cross count must be 0 or a positive whole number.`);
        crossOk = false;
      } else if (fSide % 2 !== 0 && k > 0) {
        errors.push(
          `${label}: cross lacing splits a flange into equal leading/trailing halves, ` +
            `so it needs an even spoke count per flange — this flange's ${fSide} can only ` +
            `be laced radially (0-cross).`,
        );
        crossOk = false;
      } else if (k > kmax) {
        errors.push(
          `${label}: ${k}-cross isn't buildable on this ${fSide}-spoke flange ` +
            `(the spoke angle would exceed 90°). Max is ${maxLabel}.`,
        );
        crossOk = false;
      }
      // Grouped lacing only matters once the cross count itself is buildable.
      if (crossOk && Number.isInteger(g) && g > 1) {
        if (k === 0) {
          errors.push(
            `${label}: ${g}L${g}T grouping needs a cross pattern — radial spokes ` +
              `have no leading/trailing to group.`,
          );
        } else {
          if (fSide % (2 * g) !== 0) {
            errors.push(
              `${label}: ${g}L${g}T needs this flange's spokes divisible by ${2 * g} to ` +
                `split into balanced groups — ${fSide} won't.`,
            );
          }
          if (k % g !== 0) {
            errors.push(
              `${label}: ${g}L${g}T laces cleanly only when the cross count is a multiple ` +
                `of ${g} (e.g. ${g}-cross) — ${k}-cross would force two spokes into one ` +
                `flange hole on a standard hub.`,
            );
          }
        }
      }
    };
    sideCheck('Left / non-drive', leftCross, leftGroup, leftPattern, nds);
    sideCheck('Right / drive', rightCross, rightGroup, rightPattern, drive);
  }
  return { ok: errors.length === 0, errors };
}

// --- Spoke tension ----------------------------------------------------------

/**
 * A tensiometer conversion curve: pairs of (reading, tension in kgf) for a
 * given tool + spoke type. Real tables are tool/spoke-specific reference data;
 * these are illustrative and interpolated linearly. Replace/extend with cited
 * data. Keyed by tool + spoke type.
 */
export interface TensionCurve {
  tool: string;
  spokeType: string; // e.g. "steel round 2.0 mm", "steel blade 0.9 x 2.3 mm"
  points: Array<{ reading: number; kgf: number }>; // sorted by reading asc
}

/** Interpolate a tensiometer reading to tension (kgf) using a curve. */
export function readingToKgf(curve: TensionCurve, reading: number): number {
  const pts = curve.points;
  if (pts.length === 0) return NaN;
  if (reading <= pts[0].reading) return pts[0].kgf;
  if (reading >= pts[pts.length - 1].reading) return pts[pts.length - 1].kgf;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (reading >= a.reading && reading <= b.reading) {
      const t = (reading - a.reading) / (b.reading - a.reading);
      return a.kgf + t * (b.kgf - a.kgf);
    }
  }
  return NaN;
}

export const KGF_TO_N = 9.80665;
export const kgfToN = (kgf: number): number => kgf * KGF_TO_N;

// --- Rim & hub presets ------------------------------------------------------
// APPROXIMATE reference values only. ERD and hub flange geometry vary a lot
// between models — always measure your actual parts. Presets are starting
// points to sanity-check against.

export interface RimPreset {
  label: string;
  erdMm: number;
}

export const RIM_PRESETS: RimPreset[] = [
  { label: '700C / 29" box rim (~602)', erdMm: 602 },
  { label: '700C mid-depth (~592)', erdMm: 592 },
  { label: '700C deep aero (~575)', erdMm: 575 },
  { label: '650B / 27.5" (~565)', erdMm: 565 },
  { label: '26" MTB (~538)', erdMm: 538 },
  { label: '20" (406) (~390)', erdMm: 390 },
];

// A real hub from the database, with the flange geometry a spoke-length build
// needs plus the metadata the picker filters on (maker, type, width, drillings).
// Left/right follow the wheel convention: left = non-drive, right = drive.
export type HubType =
  | 'front'
  | 'front-dynamo'
  | 'rear-cassette'
  | 'rear-internal'
  | 'rear-single';

export interface HubSource {
  url: string;
  sourceType?: 'primary' | 'secondary';
  note?: string;
}

export interface Hub {
  manufacturer: string;
  model: string;
  type: HubType;
  /** Over-locknut dimension / frame spacing (mm). */
  widthMm: number;
  /** Spoke-hole drillings the hub is offered in (e.g. [28, 32, 36]). */
  spokeCounts: number[];
  leftFlangeDiaMm: number;
  rightFlangeDiaMm: number;
  leftOffsetMm: number;
  rightOffsetMm: number;
  /** Flange spoke-hole diameter (mm). Omitted when the maker doesn't publish it
   *  (e.g. SON, Onyx); the calculator then falls back to its 2.6 mm default. */
  spokeHoleMm?: number;
  source?: HubSource;
}

// Human labels for the hub-type filter, in the order they read best.
export const HUB_TYPE_LABELS: Record<HubType, string> = {
  front: 'Front',
  'front-dynamo': 'Front (dynamo)',
  'rear-cassette': 'Rear (cassette)',
  'rear-internal': 'Rear (internal gears)',
  'rear-single': 'Rear (single speed)',
};

// The rows live in data/hubs.json — add or edit hubs there (no code change).
export const HUBS: Hub[] = hubsData as Hub[];

// Tensiometer conversion curves. The rows live in data/tension-curves.json — add
// tools/spoke types there (no code change). Values are reference data generated
// from the Park Tool TM-1 Wheel Tension App (parktool.com/wta) — spot-check
// against the official chart/app for the exact tool before trusting.
export const TENSION_CURVES: TensionCurve[] = tensionCurvesData as TensionCurve[];
