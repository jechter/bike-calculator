import { describe, it, expect } from 'vitest';
import {
  spokeLength,
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
    expect(maxCross(10)).toBe(1);
  });

  it('accepts a normal 32h 3-cross build', () => {
    expect(checkWheelLacing(32, 3, 3).ok).toBe(true);
  });

  it('rejects 10 spokes with 3-cross (the reported case)', () => {
    const r = checkWheelLacing(10, 3, 3);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/isn't buildable with 10 spokes/);
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
