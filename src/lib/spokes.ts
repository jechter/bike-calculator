// Spoke length geometry and spoke-tension conversion.
// See docs/calculators/wheel-building.md.
//
// The hub geometry presets and tensiometer curves live in
// data/hub-geometry.json and data/tension-curves.json so they can be added or
// edited without touching code — see src/data/README.md.

import hubGeometryData from '../data/hub-geometry.json';
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
  const thetaRad = (2 * Math.PI * cross) / (spokeCount / 2);
  const d1 = R * Math.sin(thetaRad);
  const d2 = erdMm / 2 - R * Math.cos(thetaRad);
  const d3 = side.flangeOffsetMm;
  return Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3) - holeDia / 2;
}

// --- Lacing feasibility -----------------------------------------------------
// A k-cross spoke subtends 720°·k/n at the hub. Past 90° the spoke would have to
// wrap backwards, which isn't buildable, so the max cross is floor(n/8) — the
// same limit as the standard max-cross tables (e.g. 32h → 4x, 24h → 3x).

export function maxCross(spokeCount: number): number {
  return Math.floor(spokeCount / 8);
}

export interface LacingCheck {
  ok: boolean;
  errors: string[];
}

export function checkWheelLacing(
  spokeCount: number,
  leftCross: number,
  rightCross: number,
): LacingCheck {
  const errors: string[] = [];
  if (!Number.isFinite(spokeCount) || spokeCount < 8) {
    errors.push("Spoke count should be at least 8.");
  } else if (spokeCount % 2 !== 0) {
    errors.push("Spoke count must be even — each side takes half the spokes.");
  } else {
    const kmax = maxCross(spokeCount);
    const maxLabel = kmax === 0 ? "radial (0-cross)" : `${kmax}-cross`;
    const sideCheck = (label: string, k: number) => {
      if (!Number.isInteger(k) || k < 0) {
        errors.push(`${label}: cross count must be 0 or a positive whole number.`);
      } else if (k > kmax) {
        errors.push(
          `${label}: ${k}-cross isn't buildable with ${spokeCount} spokes ` +
            `(the spoke angle would exceed 90°). Max is ${maxLabel}.`,
        );
      }
    };
    sideCheck("Left / non-drive", leftCross);
    sideCheck("Right / drive", rightCross);
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
  spokeType: string; // e.g. "round 2.0mm", "bladed 2.0x1.2"
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

export interface HubGeometryPreset {
  label: string;
  leftFlangeDiaMm: number;
  rightFlangeDiaMm: number;
  leftOffsetMm: number;
  rightOffsetMm: number;
  spokeHoleMm: number;
}

// The rows live in data/hub-geometry.json — add or edit hubs there (no code change).
export const HUB_GEOMETRY_PRESETS: HubGeometryPreset[] = hubGeometryData as HubGeometryPreset[];

// Tensiometer conversion curves. The rows live in data/tension-curves.json — add
// tools/spoke types there (no code change). Values are reference data generated
// from the Park Tool TM-1 Wheel Tension App (parktool.com/wta) — spot-check
// against the official chart/app for the exact tool before trusting.
export const TENSION_CURVES: TensionCurve[] = tensionCurvesData as TensionCurve[];
