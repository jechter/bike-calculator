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
