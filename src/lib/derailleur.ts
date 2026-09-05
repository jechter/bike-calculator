// Derailleur compatibility: capacity check plus a reference chart of systems.
// See docs/calculators/derailleur-compatibility.md.
//
// IMPORTANT: actuation ratios are approximate reference values gathered from
// commonly-cited sources. They should be verified before relying on them, and
// the app lets users treat them as a starting point only. The universally-true
// rule is: shifter and rear derailleur must share an actuation family, and the
// cassette speed count must match the shifter.

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
// warning at the top of this file and in the docs.
export const DERAILLEUR_SYSTEMS: DerailleurSystem[] = [
  {
    family: 'Shimano road 8/9/10-speed',
    speeds: '8/9/10',
    discipline: 'Road',
    actuationNote: '"old" Shimano road pull ratio',
    notes:
      'Cross-compatible among 8/9/10 road; NOT with 11-speed road or Dynasys MTB 10sp.',
  },
  {
    family: 'Shimano road 11-speed',
    speeds: '11',
    discipline: 'Road',
    actuationNote: 'different ratio to 10-speed road',
    notes: 'Own standard; not compatible with 10sp road or MTB 11sp.',
  },
  {
    family: 'Shimano MTB 8/9-speed',
    speeds: '8/9',
    discipline: 'MTB',
    actuationNote: 'shares the older ratio with same-era road',
    notes: 'Pre-Dynasys.',
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
    family: 'SRAM Exact Actuation',
    speeds: '10/11',
    discipline: 'Both',
    actuationNote: '~1.1:1 family',
    notes: 'SRAM road 10/11 and older MTB.',
  },
  {
    family: 'SRAM 1:1 (older MTB)',
    speeds: '8/9',
    discipline: 'MTB',
    actuationNote: '1:1 pull',
    notes: 'Older SRAM MTB.',
  },
  {
    family: 'SRAM Eagle (X-Actuation)',
    speeds: '12',
    discipline: 'MTB',
    actuationNote: 'own standard',
    notes: '12-speed MTB.',
  },
  {
    family: 'SRAM AXS / eTap',
    speeds: '12',
    discipline: 'Both',
    actuationNote: 'electronic',
    notes: 'Wireless; cross-family via app for some "mullet" setups.',
  },
  {
    family: 'Campagnolo 9/10/11/12-speed',
    speeds: '9/10/11/12',
    discipline: 'Road',
    actuationNote: 'Campagnolo-specific',
    notes: 'Generally not interchangeable with Shimano/SRAM.',
  },
];

// --- Derailleur database ----------------------------------------------------
// APPROXIMATE, community-sourced specs — verify against the manufacturer before
// relying on them. A seed list weighted toward what turns up in a community
// workshop (budget/older Shimano alongside current groupsets).

export interface DerailleurSpec {
  id: string;
  brand: string;
  model: string;
  discipline: 'Road' | 'MTB' | 'Gravel';
  speeds: string; // e.g. "11"
  cage: string; // SS/GS/SGS + plain-language
  maxSprocket: number; // largest cog it clears (T)
  minSprocket?: number; // smallest cog (T), where meaningful
  totalCapacity: number; // rated total capacity (T)
  actuation: string; // matches a family in DERAILLEUR_SYSTEMS
  oneBy?: boolean; // true for dedicated 1× (no front difference)
  notes?: string;
}

export const DERAILLEURS: DerailleurSpec[] = [
  // Shimano road
  { id: 'sh-claris-r2000-gs', brand: 'Shimano', model: 'Claris RD-R2000 GS', discipline: 'Road', speeds: '8', cage: 'GS (medium)', maxSprocket: 34, minSprocket: 11, totalCapacity: 39, actuation: 'Shimano road 8/9/10-speed' },
  { id: 'sh-sora-r3000-gs', brand: 'Shimano', model: 'Sora RD-R3000 GS', discipline: 'Road', speeds: '9', cage: 'GS (medium)', maxSprocket: 34, minSprocket: 11, totalCapacity: 39, actuation: 'Shimano road 8/9/10-speed' },
  { id: 'sh-tiagra-4700-gs', brand: 'Shimano', model: 'Tiagra RD-4700 GS', discipline: 'Road', speeds: '10', cage: 'GS (medium)', maxSprocket: 34, minSprocket: 11, totalCapacity: 39, actuation: 'Shimano 4700 (own 10sp ratio)', notes: 'Tiagra 4700 uses its own actuation, not older 10sp.' },
  { id: 'sh-105-r7000-ss', brand: 'Shimano', model: '105 RD-R7000 SS', discipline: 'Road', speeds: '11', cage: 'SS (short)', maxSprocket: 30, minSprocket: 11, totalCapacity: 35, actuation: 'Shimano road 11-speed' },
  { id: 'sh-105-r7000-gs', brand: 'Shimano', model: '105 RD-R7000 GS', discipline: 'Road', speeds: '11', cage: 'GS (medium)', maxSprocket: 34, minSprocket: 11, totalCapacity: 39, actuation: 'Shimano road 11-speed' },
  { id: 'sh-ultegra-r8000-gs', brand: 'Shimano', model: 'Ultegra RD-R8000 GS', discipline: 'Road', speeds: '11', cage: 'GS (medium)', maxSprocket: 34, minSprocket: 11, totalCapacity: 39, actuation: 'Shimano road 11-speed' },
  { id: 'sh-grx-rx810-gs', brand: 'Shimano', model: 'GRX RD-RX810 GS', discipline: 'Gravel', speeds: '11', cage: 'GS (medium)', maxSprocket: 34, minSprocket: 11, totalCapacity: 40, actuation: 'Shimano road 11-speed', notes: 'Clutch; gravel.' },
  // Shimano MTB (budget/common first)
  { id: 'sh-tourney-ty300', brand: 'Shimano', model: 'Tourney RD-TY300', discipline: 'MTB', speeds: '6/7', cage: 'SGS (long)', maxSprocket: 34, minSprocket: 14, totalCapacity: 43, actuation: 'Shimano MTB 8/9-speed', notes: 'Budget; very common on entry bikes.' },
  { id: 'sh-altus-m2000-sgs', brand: 'Shimano', model: 'Altus RD-M2000 SGS', discipline: 'MTB', speeds: '9', cage: 'SGS (long)', maxSprocket: 36, minSprocket: 11, totalCapacity: 45, actuation: 'Shimano MTB 8/9-speed' },
  { id: 'sh-acera-m3020-sgs', brand: 'Shimano', model: 'Acera RD-M3020 SGS', discipline: 'MTB', speeds: '9', cage: 'SGS (long)', maxSprocket: 36, minSprocket: 11, totalCapacity: 45, actuation: 'Shimano MTB 8/9-speed' },
  { id: 'sh-alivio-m3100-sgs', brand: 'Shimano', model: 'Alivio RD-M3100 SGS', discipline: 'MTB', speeds: '9', cage: 'SGS (long)', maxSprocket: 36, minSprocket: 11, totalCapacity: 45, actuation: 'Shimano MTB 8/9-speed' },
  { id: 'sh-deore-m6000-sgs', brand: 'Shimano', model: 'Deore RD-M6000 SGS', discipline: 'MTB', speeds: '10', cage: 'SGS (long)', maxSprocket: 46, minSprocket: 11, totalCapacity: 47, actuation: 'Shimano MTB 10-speed (Dynasys)' },
  { id: 'sh-deore-m6100-sgs', brand: 'Shimano', model: 'Deore RD-M6100 SGS', discipline: 'MTB', speeds: '12', cage: 'SGS (long)', maxSprocket: 51, minSprocket: 10, totalCapacity: 41, actuation: 'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)', oneBy: true, notes: 'Micro Spline; 1×.' },
  { id: 'sh-slx-m7100-sgs', brand: 'Shimano', model: 'SLX RD-M7100 SGS', discipline: 'MTB', speeds: '12', cage: 'SGS (long)', maxSprocket: 51, minSprocket: 10, totalCapacity: 41, actuation: 'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)', oneBy: true },
  { id: 'sh-xt-m8100-sgs', brand: 'Shimano', model: 'XT RD-M8100 SGS', discipline: 'MTB', speeds: '12', cage: 'SGS (long)', maxSprocket: 51, minSprocket: 10, totalCapacity: 41, actuation: 'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)', oneBy: true },
  // SRAM road
  { id: 'sram-apex1', brand: 'SRAM', model: 'Apex 1 (1×11)', discipline: 'Gravel', speeds: '11', cage: 'long', maxSprocket: 42, minSprocket: 11, totalCapacity: 31, actuation: 'SRAM Exact Actuation', oneBy: true },
  { id: 'sram-rival22', brand: 'SRAM', model: 'Rival 22', discipline: 'Road', speeds: '11', cage: 'medium', maxSprocket: 32, minSprocket: 11, totalCapacity: 37, actuation: 'SRAM Exact Actuation' },
  { id: 'sram-force-axs', brand: 'SRAM', model: 'Force eTap AXS', discipline: 'Road', speeds: '12', cage: 'medium', maxSprocket: 36, minSprocket: 10, totalCapacity: 36, actuation: 'SRAM AXS / eTap', notes: 'Wireless.' },
  // SRAM MTB
  { id: 'sram-nx-eagle', brand: 'SRAM', model: 'NX Eagle', discipline: 'MTB', speeds: '12', cage: 'long', maxSprocket: 50, minSprocket: 11, totalCapacity: 39, actuation: 'SRAM Eagle (X-Actuation)', oneBy: true },
  { id: 'sram-gx-eagle', brand: 'SRAM', model: 'GX Eagle', discipline: 'MTB', speeds: '12', cage: 'long', maxSprocket: 52, minSprocket: 10, totalCapacity: 42, actuation: 'SRAM Eagle (X-Actuation)', oneBy: true },
  // Campagnolo
  { id: 'campy-chorus-12', brand: 'Campagnolo', model: 'Chorus 12', discipline: 'Road', speeds: '12', cage: 'medium', maxSprocket: 34, minSprocket: 11, totalCapacity: 39, actuation: 'Campagnolo 9/10/11/12-speed' },
];

// Approximate actuation ("pull") ratio by family — roughly the derailleur's
// lateral movement per unit of cable pull. These are DISPUTED between sources and
// definitions; treat as a rough guide and verify. Electronic groups have no
// cable-pull ratio.
export const PULL_RATIOS: Record<string, string> = {
  'Shimano road 8/9/10-speed': '≈1.7:1',
  'Shimano 4700 (own 10sp ratio)': '≈1.4:1',
  'Shimano road 11-speed': '≈1.4:1',
  'Shimano MTB 8/9-speed': '≈1.7:1',
  'Shimano MTB 10-speed (Dynasys)': '≈1.2:1',
  'Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)': '≈1.3:1',
  'SRAM Exact Actuation': '≈1.1:1',
  'SRAM AXS / eTap': 'electronic',
  'SRAM Eagle (X-Actuation)': '≈1.3:1',
  'Campagnolo 9/10/11/12-speed': 'Campagnolo-specific',
};

/** Approximate pull/actuation ratio for a derailleur, from its family. */
export function pullRatioFor(d: DerailleurSpec): string {
  return PULL_RATIOS[d.actuation] ?? '—';
}

/**
 * The nominal speed counts a derailleur is sold for. The `speeds` field can list
 * several (e.g. "8/9" -> [8, 9]) because some derailleurs cover a range of
 * indexed drivetrains within one actuation family.
 */
export function derailleurSpeeds(d: DerailleurSpec): number[] {
  return d.speeds
    .split('/')
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

/** Does the derailleur nominally match an N-cog (N-speed) cassette? */
export function speedMatches(d: DerailleurSpec, cogCount: number): boolean {
  return derailleurSpeeds(d).includes(cogCount);
}

export function searchDerailleurs(query: string): DerailleurSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return DERAILLEURS;
  const terms = q.split(/\s+/);
  return DERAILLEURS.filter((d) => {
    const hay = `${d.brand} ${d.model} ${d.discipline} ${d.speeds}sp ${d.cage} ${d.actuation}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export function derailleurById(id: string): DerailleurSpec | undefined {
  return DERAILLEURS.find((d) => d.id === id);
}
