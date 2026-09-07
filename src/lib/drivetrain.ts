// Drivetrain math: gear ratios, gear inches, development, gain ratio, speed at
// cadence, chain length, and chain-wear. Pure functions — see
// docs/calculators/drivetrain.md for formulas and worked examples.

import { MM_PER_INCH } from './units';
import hubGearsData from '../data/hub-gears.json';
import chainringPresetsData from '../data/chainring-presets.json';
import cassettePresetsData from '../data/cassette-presets.json';

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

// Common cranksets (chainring combinations) for a derailleur setup.
// The rows live in data/chainring-presets.json — add or edit there (no code change).
export interface ChainringPreset {
  label: string;
  rings: number[];
}

export const CHAINRING_PRESETS: ChainringPreset[] = chainringPresetsData as ChainringPreset[];

// Cassette / sprocket sets. The rows live in data/cassette-presets.json — add or
// edit there (no code change). Each carries brand/model/freehub/weight/price and
// a source, so the drivetrain picker can group models under a brand.
export interface CassetteSource {
  url: string;
  sourceType: 'primary' | 'secondary';
  note?: string;
}

export interface CassettePreset {
  brand: string;
  model: string;
  freehub: string;
  speeds: number;
  cogs: number[]; // sprocket tooth counts, smallest first
  weightGrams: number | null;
  priceUsd: number | null;
  /** Special drivetrain family, e.g. "LinkGlide" or "T-Type", if any. */
  special?: string;
  source?: CassetteSource;
}

// Raw shape of an entry in data/cassette-presets.json.
interface RawCassette {
  brand: string;
  model: string;
  freehub: string;
  speeds: number;
  sprockets: number[];
  weightGrams?: number | null;
  priceUsd?: number | null;
  special?: string;
  source?: CassetteSource;
}

export const CASSETTE_PRESETS: CassettePreset[] = (
  cassettePresetsData.cassettes as RawCassette[]
).map((c) => ({
  brand: c.brand,
  model: c.model,
  freehub: c.freehub,
  speeds: c.speeds,
  cogs: c.sprockets,
  weightGrams: c.weightGrams ?? null,
  priceUsd: c.priceUsd ?? null,
  special: c.special,
  source: c.source,
}));

// Internally geared hub / bottom-bracket gearbox / CVT presets. Ratios are
// gear ratios relative to 1:1 direct drive (1.000 == direct drive), each with a
// primary/secondary source. The rows live in data/hub-gears.json — add or edit
// hubs there (no code change). See src/data/README.md.
export type HubKind = 'hub' | 'bottomBracket';

export interface HubSource {
  url: string;
  sourceType: 'primary' | 'secondary';
  note: string;
}

export interface HubPreset {
  label: string;
  manufacturer: string;
  gears: HubGear[];
  kind: HubKind;
  /** True for CVT units; `gears` then holds just the range endpoints. */
  continuouslyVariable: boolean;
  source?: HubSource;
}

// Raw shape of an entry in data/hub-gears.json.
interface RawHub {
  name: string;
  manufacturer: string;
  type: HubKind;
  continuouslyVariable: boolean;
  numGears: number | null;
  ratios: number[];
  source?: HubSource;
}

/** English ordinal for a gear position: 1 -> "1st", 2 -> "2nd", 11 -> "11th". */
function gearOrdinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Gear steps for a preset. CVT units expose only their low/high endpoints. */
function hubGears(h: RawHub): HubGear[] {
  if (h.continuouslyVariable) {
    const lo = h.ratios[0];
    const hi = h.ratios[h.ratios.length - 1];
    return [
      { name: 'Low', ratio: lo },
      { name: 'High', ratio: hi },
    ];
  }
  return h.ratios.map((ratio, i) => ({ name: gearOrdinal(i + 1), ratio }));
}

export const HUB_PRESETS: HubPreset[] = (hubGearsData.hubs as RawHub[]).map((h) => ({
  label: h.name,
  manufacturer: h.manufacturer,
  gears: hubGears(h),
  kind: h.type,
  continuouslyVariable: h.continuouslyVariable,
  source: h.source,
}));

/** Number of discrete speeds for sorting; CVT units sort last. */
export function hubSpeedCount(p: HubPreset): number {
  return p.continuouslyVariable ? Number.MAX_SAFE_INTEGER : p.gears.length;
}
