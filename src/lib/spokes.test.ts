import { describe, it, expect } from 'vitest';
import { spokeLength, readingToKgf, EXAMPLE_TENSION_CURVES } from './spokes';

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

describe('readingToKgf', () => {
  const curve = EXAMPLE_TENSION_CURVES[0];

  it('interpolates between table points', () => {
    // midpoint between reading 15 (70 kgf) and 20 (110 kgf) -> ~90 kgf
    expect(readingToKgf(curve, 17.5)).toBeCloseTo(90, 0);
  });

  it('clamps below/above the table', () => {
    expect(readingToKgf(curve, 5)).toBe(40);
    expect(readingToKgf(curve, 30)).toBe(160);
  });
});
