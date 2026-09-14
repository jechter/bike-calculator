import { describe, it, expect } from 'vitest';
import {
  spokeLength,
  spokeLead,
  spokePlan,
  flangeSpokeCounts,
  wheelLayout,
  rimHoleAngle,
  readingToKgf,
  maxCross,
  checkWheelLacing,
  TENSION_CURVES,
  type TensionCurve,
} from './spokes';

describe('spokeLength', () => {
  // Drive side of the worked example in docs/calculators/wheel-building.md.
  it('matches the worked drive-side example (~292 mm)', () => {
    const L = spokeLength({
      erdMm: 602,
      spokeCount: 32,
      cross: 3,
      spokeHoleDiameterMm: 2.6,
      side: { flangeDiameterMm: 45, flangeOffsetMm: 17.5 },
    });
    expect(L).toBeGreaterThan(291);
    expect(L).toBeLessThan(294);
  });

  it('radial (0-cross) is shorter than 3-cross for the same wheel', () => {
    const common = {
      erdMm: 602,
      spokeCount: 32,
      spokeHoleDiameterMm: 2.6,
      side: { flangeDiameterMm: 45, flangeOffsetMm: 17.5 },
    };
    const radial = spokeLength({ ...common, cross: 0 });
    const threeCross = spokeLength({ ...common, cross: 3 });
    expect(radial).toBeLessThan(threeCross);
  });
});

describe('maxCross / checkWheelLacing', () => {
  it('matches the standard max-cross tables', () => {
    expect(maxCross(32)).toBe(4);
    expect(maxCross(36)).toBe(4);
    expect(maxCross(24)).toBe(3);
    expect(maxCross(20)).toBe(2);
    expect(maxCross(8)).toBe(1);
  });

  it('allows only radial when the count is not divisible by 4', () => {
    // n/2 is odd (11, 5) so the leading/trailing halves can't balance — a
    // cross-laced wheel would force two spokes into one flange hole.
    expect(maxCross(22)).toBe(0);
    expect(maxCross(10)).toBe(0);
  });

  it('accepts a normal 32h 3-cross build', () => {
    expect(checkWheelLacing(32, 3, 3).ok).toBe(true);
  });

  it('accepts radial on a count not divisible by 4', () => {
    expect(checkWheelLacing(22, 0, 0).ok).toBe(true);
  });

  it('rejects 22 spokes with 2-cross (the reported case)', () => {
    const r = checkWheelLacing(22, 2, 2);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/even spoke count per flange/);
  });

  it('rejects 10 spokes with 3-cross (odd count per flange)', () => {
    const r = checkWheelLacing(10, 3, 3);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/even spoke count per flange/);
  });

  it('rejects an odd spoke count', () => {
    const r = checkWheelLacing(31, 3, 3);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/even/);
  });

  it('allows radial on low spoke counts and flags per-side independently', () => {
    const r = checkWheelLacing(16, 0, 3); // left radial ok, right 3x too many (max 2)
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/Right/);
  });
});

describe('spokeLead (grouped lacing handedness)', () => {
  it('alternates 1L1T for group size 1', () => {
    const leads = [0, 1, 2, 3, 4, 5].map((j) => spokeLead(j, 1));
    expect(leads).toEqual([1, -1, 1, -1, 1, -1]);
  });

  it('runs two-and-two for 2L2T', () => {
    const leads = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => spokeLead(j, 2));
    expect(leads).toEqual([1, 1, -1, -1, 1, 1, -1, -1]);
  });

  it('runs three-and-three for 3L3T', () => {
    const leads = [0, 1, 2, 3, 4, 5].map((j) => spokeLead(j, 3));
    expect(leads).toEqual([1, 1, 1, -1, -1, -1]);
  });
});

describe('grouped-lacing feasibility', () => {
  // Rebuild the flange-hole map the renderer uses (flange hole = j + lead·k, mod
  // m) and confirm it's a bijection — no two spokes share a hole and all lengths
  // stay equal. This is the geometric rule the group validation encodes.
  const isBijection = (spokeCount: number, cross: number, group: number) => {
    const m = spokeCount / 2; // spokes per flange
    const holes = new Set<number>();
    for (let j = 0; j < m; j++) {
      holes.add(((j + spokeLead(j, group) * cross) % m + m) % m);
    }
    return holes.size === m;
  };

  it('accepts 2L2T with an even cross (2× on 32h)', () => {
    expect(checkWheelLacing(32, 2, 2, 2, 2).ok).toBe(true);
    expect(isBijection(32, 2, 2)).toBe(true);
  });

  it('accepts 4L4T 4-cross on 32h', () => {
    expect(checkWheelLacing(32, 4, 4, 4, 4).ok).toBe(true);
    expect(isBijection(32, 4, 4)).toBe(true);
  });

  it('accepts 3L3T 3-cross on 24h', () => {
    expect(checkWheelLacing(24, 3, 3, 3, 3).ok).toBe(true);
    expect(isBijection(24, 3, 3)).toBe(true);
  });

  it('rejects 2L2T with an odd cross — spokes would collide in a hole', () => {
    const r = checkWheelLacing(32, 3, 3, 2, 2);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/multiple of 2/);
    expect(isBijection(32, 3, 2)).toBe(false); // the rule the message guards
  });

  it('rejects 2L2T on a count whose flange (14) is not divisible by 4 (28h)', () => {
    const r = checkWheelLacing(28, 2, 2, 2, 2);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/divisible by 4/);
  });

  it('rejects grouping on a radial (no leading/trailing to group)', () => {
    const r = checkWheelLacing(32, 0, 0, 2, 2);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/needs a cross pattern/);
  });

  it('leaves the standard 1L1T build unaffected', () => {
    expect(checkWheelLacing(32, 3, 3, 1, 1).ok).toBe(true);
    expect(checkWheelLacing(32, 3, 3).ok).toBe(true); // group defaults to 1
  });
});

describe("spokePlan (crow's foot)", () => {
  const cf = (j: number) => spokePlan(j, { cross: 2, group: 1, pattern: 'crowsfoot' });

  it('cycles leading-crossed / radial / trailing-crossed every three spokes', () => {
    expect([0, 1, 2, 3, 4, 5].map((j) => cf(j).offset)).toEqual([2, 0, -2, 2, 0, -2]);
    expect([0, 1, 2, 3, 4, 5].map((j) => cf(j).lead)).toEqual([1, 0, -1, 1, 0, -1]);
  });

  it('standard pattern still maps to lead·cross', () => {
    expect(spokePlan(0, { cross: 3, group: 1, pattern: 'standard' })).toEqual({ offset: 3, lead: 1 });
    expect(spokePlan(1, { cross: 3, group: 1, pattern: 'standard' })).toEqual({ offset: -3, lead: -1 });
  });

  it('treats 0-cross (radial) lacing as radial, not leading/trailing', () => {
    expect(spokePlan(0, { cross: 0, group: 1, pattern: 'standard' })).toEqual({ offset: 0, lead: 0 });
    expect(spokePlan(1, { cross: 0, group: 1, pattern: 'standard' })).toEqual({ offset: 0, lead: 0 });
  });
});

describe("crow's foot feasibility", () => {
  // The renderer's flange-hole map (flange hole = j + offset, mod m) must stay a
  // bijection — no crossed spoke landing in the radial's hole.
  const cfBijection = (spokeCount: number, cross: number) => {
    const m = spokeCount / 2;
    const holes = new Set<number>();
    for (let j = 0; j < m; j++) {
      const o = spokePlan(j, { cross, group: 1, pattern: 'crowsfoot' }).offset;
      holes.add(((j + o) % m + m) % m);
    }
    return holes.size === m;
  };

  it('accepts 36h 2-cross crow’s foot', () => {
    expect(checkWheelLacing(36, 2, 2, 1, 1, 'crowsfoot', 'crowsfoot').ok).toBe(true);
    expect(cfBijection(36, 2)).toBe(true);
  });

  it('accepts 24h 3-cross crow’s foot', () => {
    expect(checkWheelLacing(24, 3, 3, 1, 1, 'crowsfoot', 'crowsfoot').ok).toBe(true);
    expect(cfBijection(24, 3)).toBe(true);
  });

  it('rejects 32h — flange (16) not divisible by 3', () => {
    const r = checkWheelLacing(32, 2, 2, 1, 1, 'crowsfoot', 'crowsfoot');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/divisible by 3/);
  });

  it('rejects 4-cross — a crossed spoke collides with the radial', () => {
    expect(checkWheelLacing(36, 4, 4, 1, 1, 'crowsfoot', 'crowsfoot').ok).toBe(false);
    expect(cfBijection(36, 4)).toBe(false); // the collision the message guards
  });

  it('rejects radial / 1-cross — no foot to form', () => {
    expect(checkWheelLacing(36, 1, 1, 1, 1, 'crowsfoot', 'crowsfoot').ok).toBe(false);
    expect(checkWheelLacing(36, 0, 0, 1, 1, 'crowsfoot', 'crowsfoot').ok).toBe(false);
  });

  it('mixes crow’s foot on one side with standard on the other', () => {
    expect(checkWheelLacing(36, 3, 2, 1, 1, 'standard', 'crowsfoot').ok).toBe(true);
  });
});

describe('2:1 hubs', () => {
  it('splits the count two-to-one toward the drive side', () => {
    expect(flangeSpokeCounts(24, '2:1')).toEqual({ drive: 16, nds: 8 });
    expect(flangeSpokeCounts(36, '2:1')).toEqual({ drive: 24, nds: 12 });
    expect(flangeSpokeCounts(24, '1:1')).toEqual({ drive: 12, nds: 12 });
  });

  it('lays rim holes out drive-drive-non-drive with per-flange indices', () => {
    const layout = wheelLayout(24, '2:1');
    expect(layout.filter((h) => h.isDrive)).toHaveLength(16);
    expect(layout.filter((h) => !h.isDrive)).toHaveLength(8);
    expect(layout.slice(0, 3).map((h) => h.isDrive)).toEqual([true, true, false]);
    expect(layout.every((h) => h.flangeSpokes === (h.isDrive ? 16 : 8))).toBe(true);
  });

  it('can centre the non-drive hole in each triplet (D-N-D)', () => {
    const layout = wheelLayout(24, '2:1', true);
    expect(layout.slice(0, 3).map((h) => h.isDrive)).toEqual([true, false, true]);
    expect(layout.filter((h) => !h.isDrive)).toHaveLength(8); // still 8 non-drive
  });

  it('uses the flange spoke count for the crossing angle (fewer spokes → longer)', () => {
    const common = {
      erdMm: 602,
      spokeCount: 24,
      cross: 2,
      spokeHoleDiameterMm: 2.6,
      side: { flangeDiameterMm: 45, flangeOffsetMm: 20 },
    };
    const eightSpoke = spokeLength({ ...common, flangeSpokeCount: 8 });
    const sixteenSpoke = spokeLength({ ...common, flangeSpokeCount: 16 });
    // Same cross count, but 8 spokes subtend a bigger angle → a longer spoke.
    expect(eightSpoke).toBeGreaterThan(sixteenSpoke);
  });

  it('accepts a buildable 2:1 wheel and validates each flange by its own count', () => {
    // 24h 2:1: DS = 16 (max 4-cross), NDS = 8 (max 2-cross).
    expect(checkWheelLacing(24, 2, 2, 1, 1, 'standard', 'standard', '2:1').ok).toBe(true);
    // NDS 3-cross is too many for 8 spokes.
    const tooMany = checkWheelLacing(24, 3, 2, 1, 1, 'standard', 'standard', '2:1');
    expect(tooMany.ok).toBe(false);
    expect(tooMany.errors.join(' ')).toMatch(/Left/);
  });

  it('rejects a 2:1 count not divisible by 3', () => {
    const r = checkWheelLacing(32, 2, 2, 1, 1, 'standard', 'standard', '2:1');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/divisible by 3/);
  });

  it('allows an odd multiple of 3 (21h): radial non-drive, crossed drive', () => {
    // 21h 2:1 → 7 non-drive (radial only), 14 drive (crossable). Odd total is fine.
    expect(flangeSpokeCounts(21, '2:1')).toEqual({ drive: 14, nds: 7 });
    expect(checkWheelLacing(21, 0, 2, 1, 1, 'standard', 'standard', '2:1').ok).toBe(true);
    // The old "must be even" rule must not fire for 2:1.
    const r = checkWheelLacing(21, 0, 2, 1, 1, 'standard', 'standard', '2:1');
    expect(r.errors.join(' ')).not.toMatch(/must be even/);
    // But a 7-spoke non-drive flange still can't be cross-laced.
    expect(checkWheelLacing(21, 2, 2, 1, 1, 'standard', 'standard', '2:1').ok).toBe(false);
  });
});

describe('rimHoleAngle (grouped drilling)', () => {
  const deg = (r: number) => (r * 180) / Math.PI;

  it('is plain even spacing without grouping (or with gap ≤ 1)', () => {
    for (let i = 0; i < 8; i++) {
      expect(rimHoleAngle(i, 8, 1, 2)).toBeCloseTo((2 * Math.PI * i) / 8);
      expect(rimHoleAngle(i, 8, 2, 1)).toBeCloseTo((2 * Math.PI * i) / 8);
    }
  });

  it('falls back to even when the count is not divisible by the group', () => {
    expect(rimHoleAngle(3, 10, 3, 2)).toBeCloseTo((2 * Math.PI * 3) / 10);
  });

  it('clusters holes so in-group spacing is tighter than between-group', () => {
    // 8h in pairs, gap 2×: holes cluster, wide gap between pairs.
    const A = Array.from({ length: 8 }, (_, i) => rimHoleAngle(i, 8, 2, 2));
    const inGroup = deg(A[1] - A[0]); // within a pair
    const betweenGroup = deg(A[2] - A[1]); // pair-to-pair
    expect(betweenGroup).toBeCloseTo(2 * inGroup); // gap = 2× the in-group spacing
    expect(inGroup).toBeCloseTo(30);
    expect(betweenGroup).toBeCloseTo(60);
    // still a full, monotonic circle (last-pair-to-first wrap gap is also 60°)
    for (let i = 1; i < 8; i++) expect(A[i]).toBeGreaterThan(A[i - 1]);
    expect(deg(2 * Math.PI - A[7] + A[0])).toBeCloseTo(60);
  });

  it('keeps the middle hole of an odd group on its even position', () => {
    // 24h in threes: hole 1 (centre of the first group) stays at its even angle,
    // so a radial spoke there stays truly radial regardless of the gap.
    for (const gap of [1.5, 2, 3]) {
      expect(rimHoleAngle(1, 24, 3, gap)).toBeCloseTo((2 * Math.PI * 1) / 24);
      expect(rimHoleAngle(4, 24, 3, gap)).toBeCloseTo((2 * Math.PI * 4) / 24);
    }
  });

  it('offset-pair drilling puts both holes of a pair on one angle', () => {
    // paired = true: holes 2p and 2p+1 share the even midpoint of the pair, and
    // pairs sit a doubled gap apart. Angular grouping/gap are ignored.
    for (let p = 0; p < 4; p++) {
      const a0 = rimHoleAngle(2 * p, 8, 1, 1, true);
      const a1 = rimHoleAngle(2 * p + 1, 8, 1, 1, true);
      expect(a1).toBeCloseTo(a0); // same rim angle
      expect(a0).toBeCloseTo(((2 * Math.PI) / 8) * (2 * p + 0.5)); // even midpoint
    }
    // consecutive pairs are one even-pair-spacing (2 · 2π/n) apart
    expect(rimHoleAngle(2, 8, 1, 1, true) - rimHoleAngle(0, 8, 1, 1, true)).toBeCloseTo(
      (2 * (2 * Math.PI)) / 8,
    );
  });
});

describe('readingToKgf', () => {
  // Local fixture so the interpolation logic is tested independently of the
  // shipped data in data/tension-curves.json.
  const curve: TensionCurve = {
    tool: 'Test',
    spokeType: 'test',
    points: [
      { reading: 10, kgf: 40 },
      { reading: 15, kgf: 70 },
      { reading: 20, kgf: 110 },
      { reading: 24, kgf: 160 },
    ],
  };

  it('interpolates between table points', () => {
    // midpoint between reading 15 (70 kgf) and 20 (110 kgf) -> ~90 kgf
    expect(readingToKgf(curve, 17.5)).toBeCloseTo(90, 0);
  });

  it('clamps below/above the table', () => {
    expect(readingToKgf(curve, 5)).toBe(40);
    expect(readingToKgf(curve, 30)).toBe(160);
  });

  it('ships tension curves that are sorted and monotonically increasing', () => {
    for (const c of TENSION_CURVES) {
      for (let i = 1; i < c.points.length; i++) {
        expect(c.points[i].reading).toBeGreaterThan(c.points[i - 1].reading);
        expect(c.points[i].kgf).toBeGreaterThan(c.points[i - 1].kgf);
      }
    }
  });
});
