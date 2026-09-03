// Drivetrain math: gear ratios, gear inches, development, gain ratio, speed at
// cadence, chain length, and chain-wear. Pure functions — see
// docs/calculators/drivetrain.md for formulas and worked examples.

import { MM_PER_INCH } from './units';

export interface GearResult {
  chainring: number;
  cog: number;
  /** Optional internally-geared-hub step, if any. */
  hubGear?: HubGear;
  ratio: number; // effective transmission ratio (includes hub ratio)
  gearInches: number;
  developmentM: number; // metres per crank revolution
  gainRatio: number;
  speedKmh: number;
}

export interface HubGear {
  name: string; // e.g. "3rd"
  ratio: number; // internal ratio (1.0 == direct drive)
}

export interface DrivetrainInput {
  chainrings: number[];
  cogs: number[];
  circumferenceMm: number;
  cadenceRpm: number;
  crankLengthMm: number;
  /** Optional internally-geared-hub gears; when present, each combo is
   *  multiplied through every hub gear. */
  hubGears?: HubGear[];
}

/**
 * Compute the gear table. Effective ratio = (chainring/cog) * hubRatio.
 */
export function computeGears(input: DrivetrainInput): GearResult[] {
  const { chainrings, cogs, circumferenceMm, cadenceRpm, crankLengthMm } = input;
  const circM = circumferenceMm / 1000;
  const wheelDiaInches = circumferenceMm / Math.PI / MM_PER_INCH;
  const wheelRadiusMm = circumferenceMm / Math.PI / 2;
  const hubGears = input.hubGears && input.hubGears.length ? input.hubGears : [undefined];

  const out: GearResult[] = [];
  for (const chainring of chainrings) {
    for (const cog of cogs) {
      for (const hubGear of hubGears) {
        const baseRatio = chainring / cog;
        const ratio = baseRatio * (hubGear ? hubGear.ratio : 1);
        const developmentM = ratio * circM;
        out.push({
          chainring,
          cog,
          hubGear,
          ratio,
          gearInches: ratio * wheelDiaInches,
          developmentM,
          gainRatio: crankLengthMm > 0 ? (wheelRadiusMm / crankLengthMm) * ratio : 0,
          // distance per minute -> km/h
          speedKmh: developmentM * cadenceRpm * 60 / 1000,
        });
      }
    }
  }
  return out;
}

/** Overall gear range = highest ratio / lowest ratio. */
export function gearRange(gears: GearResult[]): number {
  if (gears.length === 0) return 0;
  const ratios = gears.map((g) => g.ratio);
  return Math.max(...ratios) / Math.min(...ratios);
}

// --- Chain length -----------------------------------------------------------

export interface ChainLengthInput {
  chainstayMm: number;
  largestChainring: number;
  largestCog: number;
}

export interface ChainLengthResult {
  rawInches: number; // before rounding
  inches: number; // rounded up to whole inch
  links: number; // whole links (inches * 2)
}

/**
 * Park Tool rigid-formula method:
 *   L = 2*(chainstay_in) + ring/4 + cog/4 + 1, rounded UP to a whole inch.
 * Each inch = 2 links.
 */
export function chainLength(input: ChainLengthInput): ChainLengthResult {
  const { chainstayMm, largestChainring, largestCog } = input;
  const chainstayIn = chainstayMm / MM_PER_INCH;
  const raw = 2 * chainstayIn + largestChainring / 4 + largestCog / 4 + 1;
  const inches = Math.ceil(raw);
  return { rawInches: raw, inches, links: inches * 2 };
}

// --- Chain wear -------------------------------------------------------------

export interface ChainWearInput {
  /** Measured length across the pins spanning `links` links, in mm. */
  measuredMm: number;
  /** Number of links measured over (12 links = 12 inches nominal). */
  links: number;
}

export type ChainWearVerdict = 'ok' | 'replace-soon' | 'replace-now';

export interface ChainWearResult {
  elongationPercent: number;
  verdict: ChainWearVerdict;
  message: string;
}

const NOMINAL_LINK_MM = 12.7; // 0.5 inch pitch

/**
 * Chain elongation as a percentage over nominal. Thresholds follow the common
 * guidance in docs/calculators/drivetrain.md (conservative, suitable for
 * modern 11/12-speed where <0.5% is the usual replace point).
 */
export function chainWear(input: ChainWearInput): ChainWearResult {
  const nominal = input.links * NOMINAL_LINK_MM;
  const elongationPercent = (input.measuredMm / nominal - 1) * 100;
  let verdict: ChainWearVerdict;
  let message: string;
  if (elongationPercent < 0.5) {
    verdict = 'ok';
    message = 'Chain wear is within limits.';
  } else if (elongationPercent < 0.75) {
    verdict = 'replace-soon';
    message =
      'Replace the chain soon. On 11/12-speed, 0.5% is the usual replacement point; the cassette is likely still fine.';
  } else {
    verdict = 'replace-now';
    message =
      'Replace the chain now. Past ~0.75% the cassette (and possibly chainrings) are likely worn and may skip with a new chain.';
  }
  return { elongationPercent, verdict, message };
}

// --- Common presets ---------------------------------------------------------

export interface CassettePreset {
  label: string;
  cogs: number[];
}

export const CASSETTE_PRESETS: CassettePreset[] = [
  { label: '7sp 11-28', cogs: [11, 13, 15, 17, 19, 23, 28] },
  { label: '8sp 11-32', cogs: [11, 13, 15, 18, 21, 24, 28, 32] },
  { label: '9sp 11-34', cogs: [11, 13, 15, 17, 20, 23, 26, 30, 34] },
  { label: '10sp 11-28', cogs: [11, 12, 13, 14, 15, 17, 19, 21, 24, 28] },
  { label: '11sp 11-32', cogs: [11, 12, 13, 14, 16, 18, 20, 22, 25, 28, 32] },
  { label: '11sp 11-42', cogs: [11, 13, 15, 17, 19, 21, 24, 28, 32, 37, 42] },
  { label: '12sp 10-52', cogs: [10, 12, 14, 16, 18, 21, 24, 28, 32, 38, 44, 52] },
  { label: 'Single speed 18t', cogs: [18] },
];

// Internally geared hub presets. Ratios are widely-published nominal values;
// treat as reference data to verify (see docs). 1.000 == direct drive.
export interface HubPreset {
  label: string;
  gears: HubGear[];
}

export const HUB_PRESETS: HubPreset[] = [
  {
    label: 'Sturmey-Archer AW (3-speed)',
    gears: [
      { name: '1st', ratio: 0.75 },
      { name: '2nd', ratio: 1.0 },
      { name: '3rd', ratio: 1.333 },
    ],
  },
  {
    label: 'Shimano Nexus (3-speed)',
    gears: [
      { name: '1st', ratio: 0.733 },
      { name: '2nd', ratio: 1.0 },
      { name: '3rd', ratio: 1.36 },
    ],
  },
  {
    label: 'Shimano Alfine (8-speed)',
    gears: [
      { name: '1st', ratio: 0.527 },
      { name: '2nd', ratio: 0.644 },
      { name: '3rd', ratio: 0.748 },
      { name: '4th', ratio: 0.851 },
      { name: '5th', ratio: 1.0 },
      { name: '6th', ratio: 1.223 },
      { name: '7th', ratio: 1.419 },
      { name: '8th', ratio: 1.615 },
    ],
  },
];
