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

// --- Single-speed / belt wrap geometry --------------------------------------
// A single-speed chain or a belt has no derailleur cage to take up slack, so its
// length is set by the two-pulley wrap around the front ring and rear cog at a
// given centre distance (≈ chainstay). Both share the exact synchronous-drive
// geometry below; a chain then rounds to whole links, while a belt can only be a
// stock tooth count and the FRAME's centre distance moves to suit it instead.

/** Chain pitch — a roller every ½ inch, so each "link" (in the common count) is
 *  12.7 mm and a chain joins on an even count. */
export const CHAIN_PITCH_MM = MM_PER_INCH / 2;

/**
 * Fractional pitch count (belt teeth, or ½" chain links) that runs taut around
 * two sprockets at centre distance `cdMm`. Standard two-pulley synchronous-belt
 * wrap:  N = 2C/p + (T1+T2)/2 + p·(T1−T2)²/(4π²·C).
 */
function wrapPitchCount(cdMm: number, t1: number, t2: number, pitchMm: number): number {
  return (
    (2 * cdMm) / pitchMm +
    (t1 + t2) / 2 +
    (pitchMm * (t1 - t2) ** 2) / (4 * Math.PI ** 2 * cdMm)
  );
}

export interface SingleChainLengthResult {
  /** Exact ½" links that run taut at this chainstay (before rounding). */
  exactLinks: number;
  /** Rounded UP to a whole even link count — the shortest chain that reaches. */
  links: number;
  /** Length of that link count in mm. */
  mm: number;
}

/**
 * Minimum chain length for a single-speed / hub chain (no derailleur to absorb
 * slack) at a fixed centre distance. Uses the wrap geometry above at the chain's
 * ½" pitch, then rounds UP to a whole even link count — chains join on a full
 * link (a half-link fine-tunes between). This is the shortest chain that reaches
 * at this chainstay; the wheel's fore/aft range sets the exact fit from there.
 */
export function singleSpeedChainLength(
  chainstayMm: number,
  frontTeeth: number,
  rearTeeth: number,
): SingleChainLengthResult {
  const exactLinks = wrapPitchCount(chainstayMm, frontTeeth, rearTeeth, CHAIN_PITCH_MM);
  const links = 2 * Math.ceil(exactLinks / 2);
  return { exactLinks, links, mm: Math.round(links * CHAIN_PITCH_MM) };
}

// --- Belt drive (Gates Carbon Drive) ----------------------------------------
// A belt is a closed loop that only comes in whole stock tooth counts — it can't
// be cut or shortened. So instead of sizing the belt to the frame, you pick a
// stock belt and the frame's adjustable centre distance (sliding dropout,
// eccentric BB, or eccentric hub) moves to the exact distance that belt needs.
// Gates CDX/CDN run an 11 mm pitch; a belt's pitch-line length is teeth × 11 mm.

export const BELT_PITCH_MM = 11;

// A frame takes up the gap between a stock belt's required centre distance and
// its nominal chainstay with an adjustable dropout / eccentric BB / eccentric
// hub — typically ~20 mm of travel at most. If the nearest stock belt sits
// further than this from the target chainstay, no belt reasonably fits (the
// chainstay is too short or too long, or falls in a gap between catalogued
// sizes).
export const BELT_ADJUST_TOLERANCE_MM = 20;

// Catalogued Gates CDX/CDN CenterTrack belt tooth counts, smallest first. The
// everyday range steps ~2–3 T; the large sizes are cargo/tandem. Sourced from
// Gates dealer listings (see memory: gates-belt-sizes-source).
export const GATES_BELT_TEETH: number[] = [
  108, 111, 113, 115, 118, 120, 122, 125, 128, 132, 143, 150, 168, 174, 250,
];

/**
 * Exact centre distance (mm) at which a belt of `beltTeeth` runs taut around the
 * front/rear sprockets — the inverse of the wrap geometry:
 *   C = (p/4)·[ m + √(m² − 2·(F−R)²/π²) ],  m = B − (F+R)/2.
 * Returns null when the belt is too short to span both sprockets (negative
 * discriminant) — no real centre distance exists.
 */
export function beltCenterDistanceMm(
  beltTeeth: number,
  frontTeeth: number,
  rearTeeth: number,
  pitchMm = BELT_PITCH_MM,
): number | null {
  const m = beltTeeth - (frontTeeth + rearTeeth) / 2;
  const disc = m * m - (2 * (frontTeeth - rearTeeth) ** 2) / Math.PI ** 2;
  if (disc < 0) return null;
  return (pitchMm / 4) * (m + Math.sqrt(disc));
}

/**
 * Fractional belt tooth count that would run taut at centre distance `cdMm` — the
 * ideal, before snapping to a stock size (see nearbyBeltOptions).
 */
export function idealBeltTeeth(
  cdMm: number,
  frontTeeth: number,
  rearTeeth: number,
  pitchMm = BELT_PITCH_MM,
): number {
  return wrapPitchCount(cdMm, frontTeeth, rearTeeth, pitchMm);
}

export interface BeltOption {
  teeth: number;
  /** mm — pitch-line length (teeth × pitch). */
  lengthMm: number;
  /** Exact centre distance this belt needs. */
  centerDistanceMm: number;
  /** centerDistanceMm − targetChainstayMm: how far the axle / EBB must move. */
  deltaMm: number;
}

/**
 * The catalogued belt sizes nearest to what the target centre distance
 * (chainstay) wants, each with the exact centre distance it needs and how far
 * that sits from the target. `count` sizes closest to the ideal are returned,
 * ordered by tooth count. Sizes too short to span the sprockets are skipped.
 */
export function nearbyBeltOptions(
  targetCdMm: number,
  frontTeeth: number,
  rearTeeth: number,
  count = 5,
  teeth: number[] = GATES_BELT_TEETH,
  pitchMm = BELT_PITCH_MM,
): BeltOption[] {
  const ideal = idealBeltTeeth(targetCdMm, frontTeeth, rearTeeth, pitchMm);
  return teeth
    .map((t) => {
      const cd = beltCenterDistanceMm(t, frontTeeth, rearTeeth, pitchMm);
      return cd == null ? null : { teeth: t, cd };
    })
    .filter((x): x is { teeth: number; cd: number } => x != null)
    .sort((a, b) => Math.abs(a.teeth - ideal) - Math.abs(b.teeth - ideal))
    .slice(0, count)
    .sort((a, b) => a.teeth - b.teeth)
    .map(({ teeth: t, cd }) => ({
      teeth: t,
      lengthMm: t * pitchMm,
      centerDistanceMm: cd,
      deltaMm: cd - targetCdMm,
    }));
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

/**
 * Cog-pitch (sprocket-spacing) standard — the indexing convention a cassette is
 * cut to. Same cog COUNT but different pitch won't index together, so this is a
 * fit dimension in its own right (see fitCassette). The distinct, indexing-
 * relevant standards:
 * - `shimano-sram` — the shared Shimano/SRAM HG pitch (7–12sp, road + MTB); the
 *   "everything else" most cassettes use. (Shimano-12 vs SRAM-12 differ only
 *   slightly and cross-work with a matched drivetrain, so they're one family
 *   here — the derailleur actuation-family check separates them where it counts.)
 * - `campagnolo` — Campagnolo's own pitch (distinct at every speed count); needs
 *   a Campagnolo drivetrain. Third-party Campagnolo-compatible cassettes (Edco,
 *   IRD, OMNI Racer, Prestacycle, Recon, Token…) fall here too — they ship on a
 *   Campagnolo freehub.
 * - `linkglide` — Shimano LinkGlide / CUES; its parts must be used together and
 *   are NOT interchangeable with Hyperglide.
 * - `proprietary` — a closed system (Classified, Rotor 13…) whose cassette isn't
 *   meant to index a generic derailleur; the fit check leaves it unjudged.
 */
export type CassetteSpacing = 'shimano-sram' | 'campagnolo' | 'linkglide' | 'proprietary';

/** Human labels for each cog-pitch standard (for the fit readout). */
export const CASSETTE_SPACING_LABELS: Record<CassetteSpacing, string> = {
  'shimano-sram': 'Shimano / SRAM',
  campagnolo: 'Campagnolo',
  linkglide: 'Shimano LinkGlide',
  proprietary: 'Proprietary',
};

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
  /** Cog-pitch standard this cassette indexes to (derived; see deriveCassetteSpacing). */
  spacing: CassetteSpacing;
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
  /** Explicit cog-pitch standard, when the derivation below would be wrong
   *  (e.g. a Shimano-spaced cassette sold on a Campagnolo freehub body). */
  spacing?: CassetteSpacing;
  source?: CassetteSource;
}

/**
 * Best-effort cog-pitch standard for a cassette (see CassetteSpacing). Derived
 * from the tags/freehub the same way the derailleur actuation family is derived,
 * so the ~1000 rows don't each need a hand-set field. An explicit `spacing` in
 * the JSON always wins. The freehub body is the strongest signal for Campagnolo:
 * a Campagnolo-compatible cassette (any brand) ships on a Campagnolo freehub.
 */
export function deriveCassetteSpacing(c: RawCassette): CassetteSpacing {
  if (c.spacing) return c.spacing;
  if (c.special === 'LinkGlide') return 'linkglide';
  if (c.brand === 'Campagnolo' || /Campagnolo/i.test(c.freehub)) return 'campagnolo';
  // Closed systems that ship their own cassette — don't judge indexing against a
  // generic derailleur.
  if (/Classified|Rotor/i.test(c.freehub)) return 'proprietary';
  return 'shimano-sram';
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
  spacing: deriveCassetteSpacing(c),
  source: c.source,
}));

// Internal-gears presets: internally geared hubs, bottom-bracket gearboxes and
// CVTs. Ratios are
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
  /** True for systems meant to run alongside a rear derailleur + cassette
   *  (Schlumpf, Classified, Brompton, Sachs 3×7…). The app can then multiply
   *  the hub ratios through a cassette's cogs. */
  derailleurCompatible: boolean;
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
  derailleurCompatible?: boolean;
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
  derailleurCompatible: !!h.derailleurCompatible,
  source: h.source,
}));

/** Number of discrete speeds for sorting; CVT units sort last. */
export function hubSpeedCount(p: HubPreset): number {
  return p.continuouslyVariable ? Number.MAX_SAFE_INTEGER : p.gears.length;
}
