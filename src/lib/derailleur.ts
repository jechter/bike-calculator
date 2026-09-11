// Derailleur compatibility: capacity check plus a reference chart of systems.
// See docs/calculators/derailleur-compatibility.md.
//
// The derailleur database itself lives in data/derailleurs.json so entries can be
// added or edited without touching code — see src/data/README.md.
//
// IMPORTANT: actuation ratios are approximate reference values. The per-model
// `pullRatio` in the data is sourced and preferred; the actuation *family* is
// DERIVED here (from brand/type/speeds/electronic) so each row still links to the
// compatibility reference chart, and is a best-effort guide — verify before
// relying on it. The universally-true rule is: shifter and rear derailleur must
// share an actuation family, and the cassette speed count must match the shifter.

import derailleursData from '../data/derailleurs.json';
import type { CassetteSpacing } from './drivetrain';

export interface CapacityInput {
  largestChainring: number;
  smallestChainring: number;
  largestCog: number;
  smallestCog: number;
  ratedCapacity: number; // derailleur total capacity (teeth)
  maxSprocket: number; // largest cog the cage clears
}

export interface CapacityResult {
  requiredCapacity: number;
  capacityOk: boolean;
  maxSprocketOk: boolean;
  frontDifference: number;
  rearDifference: number;
}

export function checkCapacity(input: CapacityInput): CapacityResult {
  const frontDifference = input.largestChainring - input.smallestChainring;
  const rearDifference = input.largestCog - input.smallestCog;
  const requiredCapacity = frontDifference + rearDifference;
  return {
    requiredCapacity,
    frontDifference,
    rearDifference,
    capacityOk: requiredCapacity <= input.ratedCapacity,
    maxSprocketOk: input.largestCog <= input.maxSprocket,
  };
}

export interface DerailleurSystem {
  family: string;
  speeds: string;
  discipline: 'Road' | 'MTB' | 'Both';
  /** Approximate actuation / cable-pull ratio; VERIFY before trusting. */
  actuationNote: string;
  notes: string;
}

// Reference chart. actuationNote deliberately qualitative/qualified — see the
// warning at the top of this file and in the docs. The family names here must
// stay in sync with deriveActuation() below (and PULL_RATIOS).
export const DERAILLEUR_SYSTEMS: DerailleurSystem[] = [
  {
    family: 'Shimano road 1.7 (classic)',
    speeds: '6/7/8/9/10',
    discipline: 'Road',
    actuationNote: '≈1.7:1 — the "classic" Shimano road pull',
    notes:
      'Cross-compatible 6–10 incl. Dura-Ace 7700–7900. NOT the old DA 7400 (1.9), Tiagra 4700 (1.4), or 11-speed road (1.4).',
  },
  {
    family: 'Shimano road 1.9 (Dura-Ace 7400)',
    speeds: '6/7/8',
    discipline: 'Road',
    actuationNote: '≈1.9:1 — old Dura-Ace only',
    notes: 'Dura-Ace 7400-series (6–8sp). Own pull; not compatible with classic 1.7.',
  },
  {
    family: 'Shimano road 1.4 (11-speed & Tiagra 4700)',
    speeds: '10/11',
    discipline: 'Road',
    actuationNote: '≈1.4:1',
    notes:
      '11-speed road and Tiagra RD-4700 (10sp) share this pull. NOT compatible with classic 1.7 (8/9/10) road.',
  },
  {
    family: 'Shimano road 12-speed',
    speeds: '12',
    discipline: 'Road',
    actuationNote: 'own 12-speed ratio (mechanical 105 R7100 etc.)',
    notes: 'Own standard; mechanical 12sp road. Di2 12sp is electronic.',
  },
  {
    family: 'Shimano MTB 6/7/8/9-speed',
    speeds: '6/7/8/9',
    discipline: 'MTB',
    actuationNote: 'the older ("1.7:1") ratio; shares it with same-era road',
    notes: 'Pre-Dynasys MTB.',
  },
  {
    family: 'Shimano MTB 10-speed (Dynasys)',
    speeds: '10',
    discipline: 'MTB',
    actuationNote: 'changed ratio vs road 10sp',
    notes: 'Not compatible with road 10-speed.',
  },
  {
    family: 'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)',
    speeds: '11/12',
    discipline: 'MTB',
    actuationNote: 'own standards',
    notes: 'Micro Spline freehub; own actuation.',
  },
  {
    family: 'Shimano CUES / LinkGlide',
    speeds: '9/10/11',
    discipline: 'Both',
    actuationNote: 'own LinkGlide actuation',
    notes: 'Cross-series within CUES/LinkGlide; not interchangeable with Hyperglide+.',
  },
  {
    family: 'Shimano Di2 (electronic)',
    speeds: '11/12',
    discipline: 'Both',
    actuationNote: 'electronic',
    notes: 'Wired/semi-wireless electronic; no cable pull.',
  },
  {
    family: 'SRAM Exact Actuation',
    speeds: '10/11',
    discipline: 'Both',
    actuationNote: '~1.1:1 family',
    notes: 'SRAM road 10/11 and 10/11-speed MTB.',
  },
  {
    family: 'SRAM 1:1 (older MTB)',
    speeds: '7/8/9',
    discipline: 'MTB',
    actuationNote: '1:1 pull',
    notes: 'Older SRAM MTB.',
  },
  {
    family: 'SRAM Eagle (X-Actuation)',
    speeds: '12',
    discipline: 'MTB',
    actuationNote: 'own standard',
    notes: '12-speed mechanical MTB.',
  },
  {
    family: 'SRAM 12-speed road (mechanical)',
    speeds: '12',
    discipline: 'Both',
    actuationNote: 'own 12-speed road ratio',
    notes: 'Mechanical Apex 12sp road/gravel.',
  },
  {
    family: 'SRAM AXS / eTap (electronic)',
    speeds: '12',
    discipline: 'Both',
    actuationNote: 'electronic',
    notes: 'Wireless; cross-family via app for some "mullet" setups.',
  },
  {
    family: 'Campagnolo 10-speed',
    speeds: '10',
    discipline: 'Road',
    actuationNote: 'Campagnolo-specific',
    notes: 'Not interchangeable with Shimano/SRAM.',
  },
  {
    family: 'Campagnolo 11-speed',
    speeds: '11',
    discipline: 'Road',
    actuationNote: 'Campagnolo-specific',
    notes: 'Own standard (Super Record/Record/Chorus/Potenza/Centaur 11).',
  },
  {
    family: 'Campagnolo 12-speed',
    speeds: '12',
    discipline: 'Road',
    actuationNote: 'Campagnolo-specific',
    notes: 'Mechanical 12s (Chorus/Record/Super Record 12).',
  },
  {
    family: 'Campagnolo WRL (electronic)',
    speeds: '12/13',
    discipline: 'Road',
    actuationNote: 'electronic',
    notes: 'Wireless (Super Record Wireless 12s, Super Record / Record 13s).',
  },
];

// --- Derailleur database ----------------------------------------------------
// APPROXIMATE, sourced specs (from data/derailleurs.json) — verify against the
// manufacturer before relying on them. Add or edit entries in the JSON (no code
// change needed).

/** A raw row as stored in data/derailleurs.json. Optional fields are omitted
 *  when unknown. */
interface RawDerailleur {
  brand: string;
  model: string;
  series?: string;
  type: string; // "MTB" | "Road" | "Gravel"
  introduced?: number;
  discontinued?: number;
  cage?: string | null;
  nominalSpeeds: number;
  pullRatio?: number;
  maxLow?: number;
  minLow?: number;
  capacity?: number;
  electronic?: string; // e.g. "Di2", "AXS", "eTap", "WT"
  source?: DerailleurSource;
}

export interface DerailleurSource {
  url: string;
  sourceType: 'primary' | 'secondary';
  note?: string;
}

export interface DerailleurSpec {
  /** Stable slug key, generated at load (not stored in the JSON). */
  key: string;
  brand: string;
  model: string;
  series?: string; // "-" in the data means "none"
  discipline: 'Road' | 'MTB' | 'Gravel';
  speeds: number; // nominal indexed speed count
  cage?: string; // cage-length label (SS/GS/SGS/S/M/L…); may be missing
  maxSprocket?: number; // largest cog it clears (T)
  minSprocket?: number; // smallest cog (T), where known
  totalCapacity?: number; // rated total capacity (T)
  pullRatio?: number; // sourced numeric cable-pull ratio (:1); absent for many
  electronic?: string; // electronic group label if electronic (no cable pull)
  introduced?: number; // model-year introduced
  discontinued?: number; // model-year discontinued (absent = current/unknown)
  /** Derived actuation family; matches a family in DERAILLEUR_SYSTEMS, or
   *  undefined when it can't be derived confidently (shown as "unknown"). */
  actuation?: string;
  source?: DerailleurSource;
}

/** Full human name: brand, series/family, model, cage — e.g.
 *  "Shimano Ultegra RD-R8050 SS". Series and cage are dropped when absent. */
export function derailleurFullName(d: DerailleurSpec): string {
  return [d.brand, d.series, d.model, d.cage].filter(Boolean).join(' ');
}

const rawData = derailleursData as { derailleurs: RawDerailleur[] };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The Shimano family a Shimano-cloning third-party row copies, keyed off
 * discipline + sourced pull ratio + speed count. Used for brands whose road and
 * classic-MTB groups deliberately match a Shimano cable-pull ratio (Sunrace,
 * L-TWOO road, S-Ride). Returns undefined for the ratios OUTSIDE the confidently-
 * Shimano set (notably the ~1.1 MTB zone, which is SRAM-family or proprietary
 * depending on brand) — the caller decides those per brand.
 */
function shimanoCloneFamily(r: RawDerailleur): string | undefined {
  const road = r.type === 'Road' || r.type === 'Gravel';
  if (road) {
    if (r.pullRatio === 1.4) return 'Shimano road 1.4 (11-speed & Tiagra 4700)';
    if (r.pullRatio === 1.7) return 'Shimano road 1.7 (classic)';
    return undefined;
  }
  if (r.pullRatio === 1.7 && r.nominalSpeeds <= 9) return 'Shimano MTB 6/7/8/9-speed';
  if (r.pullRatio === 1.2) return 'Shimano MTB 10-speed (Dynasys)';
  return undefined;
}

/**
 * Best-effort actuation family from brand + discipline + speeds + electronic.
 * Third-party brands and genuinely ambiguous cases return undefined ("unknown")
 * — better to say so than to guess a family. Ratios/families are DISPUTED; this
 * is a guide, and the per-model numeric `pullRatio` is the sourced value.
 */
function deriveActuation(r: RawDerailleur): string | undefined {
  const s = r.nominalSpeeds;
  const road = r.type === 'Road' || r.type === 'Gravel';
  const series = (r.series ?? '').toLowerCase();
  if (r.brand === 'Shimano') {
    if (r.electronic) return 'Shimano Di2 (electronic)';
    if (series.includes('cues') || series.includes('linkglide'))
      return 'Shimano CUES / LinkGlide';
    if (road) {
      // Road actuation is set by the cable-pull ratio, NOT the speed count:
      // "classic" Shimano (1.7) is cross-compatible 6–10 incl. Dura-Ace 7700–
      // 7900; old Dura-Ace 7400 is 1.9 (6–8 only); Tiagra RD-4700 shares the
      // 11-speed 1.4 ratio. Prefer the sourced pullRatio; fall back to speed.
      if (r.pullRatio === 1.9) return 'Shimano road 1.9 (Dura-Ace 7400)';
      if (r.pullRatio === 1.7) return 'Shimano road 1.7 (classic)';
      if (r.pullRatio === 1.4) return 'Shimano road 1.4 (11-speed & Tiagra 4700)';
      if (s >= 12) return 'Shimano road 12-speed';
      if (s === 11) return 'Shimano road 1.4 (11-speed & Tiagra 4700)';
      return 'Shimano road 1.7 (classic)'; // 6/7/8/9/10 default
    }
    if (s >= 11) return 'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)';
    if (s === 10) return 'Shimano MTB 10-speed (Dynasys)';
    return 'Shimano MTB 6/7/8/9-speed';
  }
  if (r.brand === 'SRAM') {
    if (r.electronic) return 'SRAM AXS / eTap (electronic)';
    if (road) {
      if (s >= 12) return 'SRAM 12-speed road (mechanical)';
      return 'SRAM Exact Actuation'; // 10/11
    }
    if (s >= 12) return 'SRAM Eagle (X-Actuation)';
    if (s === 10 || s === 11) return 'SRAM Exact Actuation';
    return 'SRAM 1:1 (older MTB)'; // 7/8/9
  }
  if (r.brand === 'Campagnolo') {
    if (r.electronic) return 'Campagnolo WRL (electronic)'; // wireless 12/13s
    if (s <= 10) return 'Campagnolo 10-speed';
    if (s === 11) return 'Campagnolo 11-speed';
    return 'Campagnolo 12-speed'; // mechanical 12s (13s is always electronic)
  }
  if (r.brand === 'Microshift') {
    // Microshift deliberately builds most groups to a Shimano actuation ratio so
    // they cross-index with Shimano shifters/derailleurs — its road groups
    // (R8/R9/R10, Centos, Arsis, M21) and its traditional MTB groups (Mezzo,
    // Marvo, XLE, XCD) all do. The EXCEPTIONS are its modern 1x groups — Advent,
    // Advent X, Advent MX, Sword — and the entry-level Acolyte, which use
    // Microshift's OWN proprietary cable pull and are NOT Shimano-compatible;
    // leave those unknown. (Verified against Microshift's FAQ and BikeRadar's
    // Microshift groupset guide.) For the Shimano-compatible groups, reuse the
    // same family split as the equivalent Shimano part, keyed off the sourced
    // pullRatio + discipline + speeds.
    const proprietary = ['advent', 'sword', 'acolyte'];
    if (proprietary.some((p) => series.includes(p))) return undefined;
    if (road) {
      if (r.pullRatio === 1.4) return 'Shimano road 1.4 (11-speed & Tiagra 4700)';
      return 'Shimano road 1.7 (classic)'; // R-series / Centos / Arsis 1.7 road
    }
    if (s >= 11) return 'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)'; // XLE 11 / XCD
    if (s === 10) return 'Shimano MTB 10-speed (Dynasys)'; // XLE 10
    return 'Shimano MTB 6/7/8/9-speed'; // Mezzo / Marvo
  }
  if (r.brand === 'Sunrace') {
    // Sunrace's own FAQ: its derailleurs/shifters are Shimano-compatible cable
    // pull by default unless explicitly marked SRAM (none here are). The U-series
    // (U/US/UX) targets Shimano's CUES/LinkGlide standard; the R-series copies
    // classic Shimano road; the M-series copies Shimano MTB by generation. The
    // 11/12-speed wide-range MTB (MS/MX/MZ) follow the Shimano MTB HG+ pull by
    // design (SRAM shifters only work by fiddling — not native).
    if (series.startsWith('u')) return 'Shimano CUES / LinkGlide';
    if (road) return shimanoCloneFamily(r) ?? 'Shimano road 1.7 (classic)';
    if (s <= 9) return 'Shimano MTB 6/7/8/9-speed';
    if (s === 10) return 'Shimano MTB 10-speed (Dynasys)';
    return 'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)';
  }
  if (r.brand === 'L-TWOO') {
    // eRX/eGR are a closed wireless protocol (no Di2/AXS interop) — unknown.
    if (r.electronic) return undefined;
    // Road & gravel R/GR series copy Shimano road pull (1.7 ≤10sp, 1.4 at 11sp).
    if (road) return shimanoCloneFamily(r);
    // 12-speed MTB (A12/AX) is SRAM Eagle 1:1 per L-TWOO's own OEM spec ("1:1
    // Sram"), on an XD driver — NOT Shimano. The 10/11-speed MTB (A7/AX-11)
    // evidence conflicts (Shimano-Deore marketing vs the 1:1 spec) — leave those
    // unknown.
    if (s >= 12) return 'SRAM Eagle (X-Actuation)';
    return undefined;
  }
  if (r.brand === 'S-Ride') {
    // S-Ride tags groups "2:1" (Shimano-family) or "1:1"/"SRAM" (SRAM-family);
    // the sourced pull ratios split them. 1.7/1.2 MTB copy classic/Dynasys
    // Shimano; the 1.4 11-speed is Shimano road/GRX (bench-verified with GRX600);
    // the ~1.1 ≤9-speed E-series/M310 are SRAM 1:1. The ~1.1 12/13-speed
    // (M500C/M600C/M610C/M700) claim Shimano 12sp but the pull conflicts and is
    // unverified — leave unknown.
    if (road) return shimanoCloneFamily(r);
    if (r.pullRatio === 1.7 && s <= 9) return 'Shimano MTB 6/7/8/9-speed';
    if (r.pullRatio === 1.2) return 'Shimano MTB 10-speed (Dynasys)';
    if (r.pullRatio === 1.4) return 'Shimano road 1.4 (11-speed & Tiagra 4700)';
    if (r.pullRatio === 1.1 && s <= 9) return 'SRAM 1:1 (older MTB)';
    return undefined;
  }
  if (r.brand === 'Box') {
    // Box One/Two 11-speed cross-index with Shimano 11-speed MTB shifters
    // (verified both directions). Prime 9, the e-bike -E groups, and the 7-speed
    // DH use Box's own proprietary "wide" pull — leave unknown.
    if (r.model === '11-Speed') return 'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)';
    return undefined;
  }
  // Remaining third-party (Ingrid version-specific "fins", TRP/Tektro own-shifter
  // systems, WheelTop closed wireless): compatibility is version-specific or
  // proprietary and isn't reliably derivable — leave as unknown.
  return undefined;
}

function loadDerailleurs(): DerailleurSpec[] {
  const seen = new Map<string, number>();
  return rawData.derailleurs.map((r) => {
    // Slug from brand+model (+ cage/speeds to disambiguate the many shared
    // model numbers), de-duped deterministically by input order.
    const base = slugify(
      [r.brand, r.model, r.cage ?? '', `${r.nominalSpeeds}s`].join(' '),
    );
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const key = n === 1 ? base : `${base}-${n}`;
    const discipline = (r.type === 'Road'
      ? 'Road'
      : r.type === 'Gravel'
        ? 'Gravel'
        : 'MTB') as DerailleurSpec['discipline'];
    return {
      key,
      brand: r.brand,
      model: r.model,
      series: r.series && r.series !== '-' ? r.series : undefined,
      discipline,
      speeds: r.nominalSpeeds,
      cage: r.cage ?? undefined,
      maxSprocket: r.maxLow,
      minSprocket: r.minLow,
      totalCapacity: r.capacity,
      pullRatio: r.pullRatio,
      electronic: r.electronic,
      introduced: r.introduced,
      discontinued: r.discontinued,
      actuation: deriveActuation(r),
      source: r.source,
    };
  });
}

export const DERAILLEURS: DerailleurSpec[] = loadDerailleurs();

// Approximate actuation ("pull") ratio by family — used only as a fallback when
// a row has no sourced numeric pullRatio. DISPUTED between sources; treat as a
// rough guide. Electronic groups have no cable-pull ratio.
export const PULL_RATIOS: Record<string, string> = {
  'Shimano road 1.7 (classic)': '≈1.7:1',
  'Shimano road 1.9 (Dura-Ace 7400)': '≈1.9:1',
  'Shimano road 1.4 (11-speed & Tiagra 4700)': '≈1.4:1',
  // 'Shimano road 12-speed' intentionally omitted — mechanical 12s road pull is
  // not well documented; rows show their sourced numeric ratio or "—".
  'Shimano MTB 6/7/8/9-speed': '≈1.7:1',
  'Shimano MTB 10-speed (Dynasys)': '≈1.2:1',
  'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)': '≈1.3:1',
  'Shimano CUES / LinkGlide': '≈1.4:1',
  'Shimano Di2 (electronic)': 'electronic',
  'SRAM Exact Actuation': '≈1.1:1',
  'SRAM 1:1 (older MTB)': '1:1',
  'SRAM Eagle (X-Actuation)': '≈1.3:1',
  'SRAM 12-speed road (mechanical)': '≈1.1:1',
  'SRAM AXS / eTap (electronic)': 'electronic',
  'Campagnolo 10-speed': 'Campagnolo-specific',
  'Campagnolo 11-speed': 'Campagnolo-specific',
  'Campagnolo 12-speed': 'Campagnolo-specific',
  'Campagnolo WRL (electronic)': 'electronic',
};

/**
 * Pull/actuation ratio for a derailleur. Prefers the sourced numeric value;
 * falls back to the family estimate; "electronic" for electronic groups; "—"
 * when nothing is known.
 */
export function pullRatioFor(d: DerailleurSpec): string {
  if (d.pullRatio != null) return `${d.pullRatio}:1`;
  if (d.electronic) return 'electronic';
  if (d.actuation && PULL_RATIOS[d.actuation]) return PULL_RATIOS[d.actuation];
  return '—';
}

/** The nominal indexed speed count as a single-element list, for symmetry with
 *  the old multi-speed API and speedMatches(). */
export function derailleurSpeeds(d: DerailleurSpec): number[] {
  return [d.speeds];
}

/** Does the derailleur nominally match an N-cog (N-speed) cassette? */
export function speedMatches(d: DerailleurSpec, cogCount: number): boolean {
  return d.speeds === cogCount;
}

/**
 * The speed counts an actuation family can drive. Because a family groups
 * derailleurs that share one actuation (cable-pull) ratio, a derailleur in the
 * family indexes correctly at any of these counts given the matching shifter —
 * e.g. an 8-speed Shimano road RD works in a 9- or 10-speed setup. Parsed from
 * the family's `speeds` label (e.g. "8/9/10" -> [8, 9, 10]).
 */
export function familySupportedSpeeds(family: string | undefined): number[] {
  if (!family) return [];
  const sys = DERAILLEUR_SYSTEMS.find((s) => s.family === family);
  if (!sys) return [];
  return sys.speeds
    .split('/')
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

/**
 * How compatible a derailleur is with an N-cog cassette, by actuation:
 * - `match`        — its nominal speed count equals the cassette's.
 * - `family`       — a different count, but its actuation family also covers it,
 *                    so it indexes with the matching same-family shifter.
 * - `friction`     — mechanical, outside its family's counts: no indexed shifter
 *                    will line up, but a friction shifter can (indexing is in the
 *                    shifter, not the derailleur).
 * - `incompatible` — electronic: shifts in fixed pre-programmed steps and can't
 *                    be re-indexed for another cog count (no friction option).
 * - `unknown`      — third-party / underived family: can't judge from actuation.
 */
export type SpeedCompatStatus =
  | 'match'
  | 'family'
  | 'friction'
  | 'incompatible'
  | 'unknown';

export function speedCompatibility(d: DerailleurSpec, cogCount: number): SpeedCompatStatus {
  if (d.speeds === cogCount) return 'match';
  if (d.electronic) return 'incompatible';
  if (!d.actuation) return 'unknown';
  if (familySupportedSpeeds(d.actuation).includes(cogCount)) return 'family';
  return 'friction';
}

/**
 * The cog-pitch (sprocket-spacing) standard an actuation family expects a
 * cassette to use — the other half of the same-cog-count-isn't-enough story.
 * A matching shifter+derailleur index in fixed steps sized for a particular
 * cog pitch, so the cassette must be cut to it (e.g. an 11-speed Shimano/SRAM
 * drivetrain won't index an 11-speed *Campagnolo* cassette — the pitch differs).
 * Returns null for friction/unknown/third-party families, where pitch can't be
 * judged (friction indexes nothing, so any pitch works). See CassetteSpacing.
 */
export function expectedCassetteSpacing(family: string | undefined): CassetteSpacing | null {
  if (!family) return null;
  if (family.startsWith('Campagnolo')) return 'campagnolo';
  if (family === 'Shimano CUES / LinkGlide') return 'linkglide';
  if (family.startsWith('Shimano') || family.startsWith('SRAM')) return 'shimano-sram';
  return null;
}

/**
 * A little over spec often still works (a big cog with a long hanger / extra
 * B-tension; a little extra required capacity only shows as slack in the
 * small-small gear you'd avoid anyway). Within this many teeth over → caution;
 * beyond it → over. Shared by the detailed fit view and the cassette-picker dots.
 */
export const FIT_CAUTION_TEETH = 4;

/** Tri-state for a single fit dimension; `unknown` when the spec is missing. */
export type FitDimension = 'ok' | 'caution' | 'over' | 'unknown';

/** Overall traffic-light fit level for the picker dots and summary badge. */
export type FitLevel = 'ok' | 'caution' | 'incompatible';

export interface CassetteFit {
  /** Combined verdict across cog-clearance, capacity and speed count. */
  level: FitLevel;
  /** Largest cog vs the derailleur's max sprocket. */
  cog: FitDimension;
  /** Required vs rated total capacity. */
  capacity: FitDimension;
  /** Speed-count compatibility (by actuation family), derailleur-only heuristic. */
  speed: SpeedCompatStatus;
  /** Cassette cog-pitch vs the drivetrain's expected standard: `ok` when they
   *  match, `over` when they clash (e.g. Campagnolo cassette on a Shimano/SRAM
   *  drivetrain), `unknown` when the cassette's or drivetrain's standard can't be
   *  judged (custom cogs, friction shifter, third-party/proprietary). */
  spacing: FitDimension;
  /** The cassette's own cog-pitch standard, when known. */
  cassetteSpacing?: CassetteSpacing;
  /** The cog-pitch standard the drivetrain expects, when derivable. */
  expectedSpacing?: CassetteSpacing;
  /** Shifter-aware verdict, present only when a shifter was supplied. */
  shifter?: ShifterVerdict;
  /** Required capacity (front + rear difference), or null when uncomputable. */
  requiredCapacity: number | null;
  /** Teeth the largest cog is over the max sprocket (0 when within). */
  cogOver: number;
  /** Teeth the required capacity is over the rating (0 when within). */
  capOver: number;
}

// --- Shifter ----------------------------------------------------------------
// The derailleur only moves sideways; the *shifter* is what indexes to each cog.
// So an accurate compatibility verdict needs both. A shifter is an actuation
// family plus a speed count. `Friction` is modelled as just another family — it
// doesn't index, so it drives any mechanical derailleur at any cog count (and is
// the native "family" of older friction-shifted derailleurs). The universally-
// true rule: an indexed shifter and the rear derailleur must share an actuation
// family, and the shifter's speed count must equal the cassette's cog count.

/** Pseudo actuation family for a friction shifter — no indexing, so the speed
 *  count is ignored and it works with any mechanical derailleur + cassette. */
export const FRICTION_FAMILY = 'Friction';

export interface Shifter {
  /** Actuation family, FRICTION_FAMILY for friction, or '' when unspecified. */
  family: string;
  /** Indexed speed count; ignored for friction (any cog count works). */
  speeds: number;
}

/** The shifter a derailleur nominally ships with: an indexed shifter in its own
 *  actuation family at its nominal speed count (electronic groups included — the
 *  matching electronic control). `null` when no derailleur is chosen. Family is
 *  '' for third-party rows whose actuation can't be derived. */
export function defaultShifterFor(d: DerailleurSpec | undefined): Shifter | null {
  if (!d) return null;
  return { family: d.actuation ?? '', speeds: d.speeds };
}

/** Short label for a shifter, e.g. "Friction" or "11-speed · Shimano road…".
 *  Unspecified (no family) has no meaningful speed count, so it reads as such. */
export function shifterLabel(sh: Shifter): string {
  if (sh.family === FRICTION_FAMILY) return 'Friction';
  if (!sh.family) return 'Other / unspecified';
  return `${sh.speeds}-speed · ${sh.family}`;
}

// Distinct family names that nonetheless share an actuation (cable-pull) ratio,
// so a shifter of one drives a derailleur of the other. The classic case: 1990s
// Shimano road (the "1.7 classic" pull) and same-era Shimano MTB (6/7/8/9-speed)
// share ≈1.7:1 and cross-index. NOTE numeric ratios alone aren't enough (e.g.
// CUES/LinkGlide and 11-speed road both read ≈1.4 but are NOT interchangeable),
// so equivalence is listed explicitly rather than derived.
const ACTUATION_EQUIVALENTS: string[][] = [
  ['Shimano road 1.7 (classic)', 'Shimano MTB 6/7/8/9-speed'],
];

/** Whether two actuation families share a pull ratio (so their shifters and
 *  derailleurs cross-index). Reflexive; friction/'' aren't real families here. */
export function familiesCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  return ACTUATION_EQUIVALENTS.some((set) => set.includes(a) && set.includes(b));
}

/**
 * Whether a chosen shifter can drive a derailleur on an N-cog cassette:
 * - `match`            — indexed, family matches, count matches → works.
 * - `friction`         — friction lever on a mechanical derailleur → works (by feel).
 * - `friction-electronic` — friction can't drive an electronic derailleur → no.
 * - `wrong-count`      — indexed count ≠ cassette cogs (mechanical) → won't index.
 * - `electronic-count` — same, but electronic: no friction fallback → hard no.
 * - `wrong-family`     — indexed family ≠ derailleur's actuation → wrong pull.
 * - `unknown-family`   — count matches but the derailleur's family is unknown, so
 *                        the pull-ratio match can't be verified → caution.
 * - `unspecified`      — the shifter family isn't set, so shifting can't be
 *                        checked at all → neutral (doesn't affect the fit level).
 */
export type ShifterStatus =
  | 'match'
  | 'friction'
  | 'friction-electronic'
  | 'wrong-count'
  | 'electronic-count'
  | 'wrong-family'
  | 'unknown-family'
  | 'unspecified';

export interface ShifterVerdict {
  level: FitLevel;
  status: ShifterStatus;
}

export function shifterCompatibility(
  d: DerailleurSpec,
  shifter: Shifter,
  cogCount: number,
): ShifterVerdict {
  if (shifter.family === FRICTION_FAMILY) {
    if (d.electronic) return { level: 'incompatible', status: 'friction-electronic' };
    return { level: 'ok', status: 'friction' };
  }
  // Unspecified family: nothing to check the pull ratio against, so shifting
  // can't be verified. Neutral — it doesn't raise or lower the fit level.
  if (!shifter.family) return { level: 'ok', status: 'unspecified' };
  // Indexed shifter. Electronic derailleurs are driven by their matching
  // electronic control in fixed pre-programmed steps — they can only work when
  // the count (and family) match, with no friction fallback.
  if (d.electronic) {
    if (cogCount > 0 && shifter.speeds !== cogCount)
      return { level: 'incompatible', status: 'electronic-count' };
    if (d.actuation && !familiesCompatible(shifter.family, d.actuation))
      return { level: 'incompatible', status: 'wrong-family' };
    return { level: 'ok', status: 'match' };
  }
  // Mechanical indexed shifter: the count must line up cog-to-cog…
  if (cogCount > 0 && shifter.speeds !== cogCount)
    return { level: 'incompatible', status: 'wrong-count' };
  // …and the pull ratio (actuation family) must match. Unknown derailleur
  // family → can't verify → caution.
  if (!d.actuation) return { level: 'caution', status: 'unknown-family' };
  if (!familiesCompatible(shifter.family, d.actuation))
    return { level: 'incompatible', status: 'wrong-family' };
  return { level: 'ok', status: 'match' };
}

/**
 * How well a derailleur fits a given crankset + cassette, combining the three
 * checks the tool cares about: max-cog clearance, chain-wrap capacity, and
 * speed-count compatibility. Dimensions with no spec (or no drivetrain numbers
 * yet) report `unknown` and don't drag the overall level down. Used both for the
 * detailed fit readout and for the green/amber/red dots in the cassette picker.
 *
 * When a `shifter` is supplied, the speed-count/actuation verdict comes from the
 * shifter (the accurate check — see shifterCompatibility); without one it falls
 * back to the derailleur-only heuristic in speedCompatibility.
 */
export function fitCassette(
  d: DerailleurSpec,
  chainrings: number[],
  cogs: number[],
  shifter?: Shifter | null,
  cassetteSpacing?: CassetteSpacing,
): CassetteFit {
  const largestCog = cogs.length ? Math.max(...cogs) : 0;
  const smallestCog = cogs.length ? Math.min(...cogs) : 0;
  const largestRing = chainrings.length ? Math.max(...chainrings) : 0;
  const smallestRing = chainrings.length ? Math.min(...chainrings) : 0;

  let cog: FitDimension = 'unknown';
  let cogOver = 0;
  if (d.maxSprocket != null && largestCog > 0) {
    cogOver = Math.max(0, largestCog - d.maxSprocket);
    cog = cogOver === 0 ? 'ok' : cogOver <= FIT_CAUTION_TEETH ? 'caution' : 'over';
  }

  let capacity: FitDimension = 'unknown';
  let capOver = 0;
  let requiredCapacity: number | null = null;
  if (d.totalCapacity != null && chainrings.length && cogs.length) {
    requiredCapacity = largestRing - smallestRing + (largestCog - smallestCog);
    capOver = Math.max(0, requiredCapacity - d.totalCapacity);
    capacity = capOver === 0 ? 'ok' : capOver <= FIT_CAUTION_TEETH ? 'caution' : 'over';
  }

  const speed = cogs.length ? speedCompatibility(d, cogs.length) : 'match';
  const shifterVerdict = shifter ? shifterCompatibility(d, shifter, cogs.length) : undefined;

  // Cog-pitch (spacing) check: the cassette must be cut to the pitch the
  // drivetrain indexes to. A friction shifter indexes nothing, so any pitch
  // works; a proprietary cassette belongs to a closed system we don't judge.
  // Otherwise compare the cassette's standard against the one the drivetrain's
  // actuation family expects (the shifter's family when set, else the
  // derailleur's own). Unknown on either side → unjudged (doesn't fail the fit).
  let spacing: FitDimension = 'unknown';
  let expectedSpacing: CassetteSpacing | undefined;
  const frictionShifter = shifter?.family === FRICTION_FAMILY;
  if (cassetteSpacing && cassetteSpacing !== 'proprietary' && !frictionShifter) {
    const family = shifter && shifter.family ? shifter.family : d.actuation;
    expectedSpacing = expectedCassetteSpacing(family) ?? undefined;
    if (expectedSpacing) spacing = cassetteSpacing === expectedSpacing ? 'ok' : 'over';
  }

  // The speed/actuation contribution to the overall level: the shifter verdict
  // when a shifter was chosen (the accurate check), otherwise the derailleur-only
  // heuristic — where a mismatch that "might work with the right shifter" is amber.
  const speedLevel: FitLevel = shifterVerdict
    ? shifterVerdict.level
    : speed === 'incompatible'
      ? 'incompatible'
      : speed === 'match'
        ? 'ok'
        : 'caution';

  // Red for anything clearly out of range: too big a cog, way over capacity, or a
  // speed/actuation combination that can't work. Amber for the "might work" cases:
  // slightly over spec, or an unverifiable actuation match. Green only when every
  // known dimension is clean.
  let level: FitLevel = 'ok';
  if (cog === 'over' || capacity === 'over' || speedLevel === 'incompatible' || spacing === 'over') {
    level = 'incompatible';
  } else if (cog === 'caution' || capacity === 'caution' || speedLevel === 'caution') {
    level = 'caution';
  }

  return {
    level,
    cog,
    capacity,
    speed,
    spacing,
    cassetteSpacing,
    expectedSpacing,
    shifter: shifterVerdict,
    requiredCapacity,
    cogOver,
    capOver,
  };
}

/**
 * For an incompatible fit, what's driving it: a physical `range` problem (the cog
 * won't clear the cage, or the chain wrap is way over capacity); a `spacing`
 * problem (the cassette's cog pitch doesn't match the drivetrain's, e.g.
 * Campagnolo cassette + Shimano/SRAM drivetrain); or an `indexing` problem (the
 * shifter can't index this cog count / actuation). null when the fit isn't
 * incompatible. Lets the UI name the specific cause.
 */
export function incompatibleReason(
  fit: CassetteFit,
): 'range' | 'spacing' | 'indexing' | null {
  if (fit.level !== 'incompatible') return null;
  if (fit.cog === 'over' || fit.capacity === 'over') return 'range';
  if (fit.spacing === 'over') return 'spacing';
  return 'indexing';
}

export function searchDerailleurs(query: string): DerailleurSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return DERAILLEURS;
  const terms = q.split(/\s+/);
  return DERAILLEURS.filter((d) => {
    const hay = (
      `${d.brand} ${d.model} ${d.series ?? ''} ${d.discipline} ${d.speeds}sp ` +
      `${d.cage ?? ''} ${d.electronic ?? ''} ${d.actuation ?? ''}`
    ).toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export function derailleurByKey(key: string): DerailleurSpec | undefined {
  return DERAILLEURS.find((d) => d.key === key);
}
