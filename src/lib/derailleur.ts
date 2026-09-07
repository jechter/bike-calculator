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

const rawData = derailleursData as { derailleurs: RawDerailleur[] };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  // Third-party (Microshift, Sunrace, L-TWOO, Box, …): their compatibility
  // varies by model and isn't reliably derivable — leave as unknown.
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
