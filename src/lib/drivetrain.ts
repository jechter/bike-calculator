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
  /** Only needed for gain ratio; optional. */
  crankLengthMm?: number;
  /** Optional internally-geared-hub gears; when present, each combo is
   *  multiplied through every hub gear. */
  hubGears?: HubGear[];
}

/**
 * Compute the gear table. Effective ratio = (chainring/cog) * hubRatio.
 */
export function computeGears(input: DrivetrainInput): GearResult[] {
  const { chainrings, cogs, circumferenceMm, cadenceRpm } = input;
  const crankLengthMm = input.crankLengthMm ?? 0;
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
  mm: number; // length in mm (inches * 25.4, rounded)
}

/**
 * Park Tool rigid-formula method:
 *   L = 2*(chainstay_in) + ring/4 + cog/4 + 1, rounded UP to a whole inch.
 * Rounding to a whole inch keeps the link count even (each inch = 2 links).
 * We report the length in mm and the link count.
 */
export function chainLength(input: ChainLengthInput): ChainLengthResult {
  const { chainstayMm, largestChainring, largestCog } = input;
  const chainstayIn = chainstayMm / MM_PER_INCH;
  const raw = 2 * chainstayIn + largestChainring / 4 + largestCog / 4 + 1;
  const inches = Math.ceil(raw);
  return { rawInches: raw, inches, links: inches * 2, mm: Math.round(inches * MM_PER_INCH) };
}

// --- Chain wear replacement thresholds --------------------------------------
// We don't calculate wear (a chain-wear gauge does that at the bench). This is
// just the reference for the %-elongation at which to replace, which depends on
// chain/drivetrain type. Narrower chains wear the cassette faster, so they get
// replaced earlier.

export interface ChainWearThreshold {
  chainType: string;
  replaceAtPercent: number;
  note: string;
}

export const CHAIN_WEAR_THRESHOLDS: ChainWearThreshold[] = [
  {
    chainType: '11- & 12-speed',
    replaceAtPercent: 0.5,
    note: 'Narrow chains; replace early to protect the cassette.',
  },
  {
    chainType: '6- to 10-speed',
    replaceAtPercent: 0.75,
    note: 'Standard derailleur drivetrains.',
  },
  {
    chainType: 'Single speed, narrow (3/32")',
    replaceAtPercent: 0.75,
    note: 'A derailleur-width chain run single speed — wears like a geared chain.',
  },
  {
    chainType: 'Single speed / hub, wide (1/8")',
    replaceAtPercent: 1.0,
    note: 'Thicker, more wear-tolerant chain (track / BMX / most hub-geared).',
  },
];

/**
 * Replacement thresholds relevant to the current drivetrain. A cassette resolves
 * to a single row (speed inferred from the cog count). Single-speed and
 * hub-geared bikes can run either a narrow 3/32" or a wide 1/8" chain, so both
 * rows are returned to pick from.
 */
export function chainWearThresholdsFor(
  isDerailleurCassette: boolean,
  cogCount: number,
): ChainWearThreshold[] {
  if (isDerailleurCassette) {
    return [cogCount >= 11 ? CHAIN_WEAR_THRESHOLDS[0] : CHAIN_WEAR_THRESHOLDS[1]];
  }
  return [CHAIN_WEAR_THRESHOLDS[2], CHAIN_WEAR_THRESHOLDS[3]];
}

// --- Common presets ---------------------------------------------------------

export interface ChainringPreset {
  label: string;
  rings: number[];
}

// Common cranksets (chainring combinations) for a derailleur setup.
export const CHAINRING_PRESETS: ChainringPreset[] = [
  { label: 'Road compact 50/34', rings: [50, 34] },
  { label: 'Road semi-compact 52/36', rings: [52, 36] },
  { label: 'Road standard 53/39', rings: [53, 39] },
  { label: 'Sub-compact 48/32', rings: [48, 32] },
  { label: 'Gravel 2× 46/30', rings: [46, 30] },
  { label: 'Road triple 50/39/30', rings: [50, 39, 30] },
  { label: 'Touring triple 48/36/26', rings: [48, 36, 26] },
  { label: 'MTB 2× 36/26', rings: [36, 26] },
  { label: '1× 42', rings: [42] },
  { label: '1× 40', rings: [40] },
  { label: '1× 32', rings: [32] },
  { label: '1× 30', rings: [30] },
];

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
