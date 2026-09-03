import { describe, it, expect } from 'vitest';
import {
  computeGears,
  chainLength,
  chainWear,
  gearRange,
} from './drivetrain';

describe('computeGears', () => {
  const base = {
    chainrings: [50, 34],
    cogs: [11, 28],
    circumferenceMm: 2111,
    cadenceRpm: 90,
    crankLengthMm: 170,
  };

  it('computes ratio and speed (worked example 50x11 ~51.8 km/h)', () => {
    const gears = computeGears(base);
    const g = gears.find((x) => x.chainring === 50 && x.cog === 11)!;
    expect(g.ratio).toBeCloseTo(4.545, 2);
    expect(g.speedKmh).toBeCloseTo(51.8, 0);
  });

  it('computes the low gear 34x28 ~13.8 km/h', () => {
    const gears = computeGears(base);
    const g = gears.find((x) => x.chainring === 34 && x.cog === 28)!;
    expect(g.speedKmh).toBeCloseTo(13.8, 0);
  });

  it('applies internally geared hub ratios', () => {
    const gears = computeGears({
      ...base,
      chainrings: [44],
      cogs: [18],
      hubGears: [
        { name: '1st', ratio: 0.75 },
        { name: '2nd', ratio: 1.0 },
        { name: '3rd', ratio: 1.333 },
      ],
    });
    expect(gears).toHaveLength(3);
    const direct = gears.find((g) => g.hubGear?.name === '2nd')!;
    expect(direct.ratio).toBeCloseTo(44 / 18, 5);
    const low = gears.find((g) => g.hubGear?.name === '1st')!;
    expect(low.ratio).toBeCloseTo((44 / 18) * 0.75, 5);
  });
});

describe('gearRange', () => {
  it('is highest/lowest ratio', () => {
    const gears = computeGears({
      chainrings: [50],
      cogs: [11, 22],
      circumferenceMm: 2111,
      cadenceRpm: 90,
      crankLengthMm: 170,
    });
    expect(gearRange(gears)).toBeCloseTo(2.0, 5);
  });
});

describe('chainLength', () => {
  it('matches the worked example (410mm / 50 / 28 -> 53in / 106 links)', () => {
    const r = chainLength({ chainstayMm: 410, largestChainring: 50, largestCog: 28 });
    expect(r.rawInches).toBeCloseTo(52.78, 1);
    expect(r.inches).toBe(53);
    expect(r.links).toBe(106);
  });
});

describe('chainWear', () => {
  it('flags a fresh chain as ok', () => {
    const r = chainWear({ measuredMm: 12 * 12.7, links: 12 });
    expect(r.elongationPercent).toBeCloseTo(0, 5);
    expect(r.verdict).toBe('ok');
  });

  it('flags 0.6% as replace-soon', () => {
    const nominal = 12 * 12.7;
    const r = chainWear({ measuredMm: nominal * 1.006, links: 12 });
    expect(r.verdict).toBe('replace-soon');
  });

  it('flags 1% as replace-now', () => {
    const nominal = 12 * 12.7;
    const r = chainWear({ measuredMm: nominal * 1.01, links: 12 });
    expect(r.verdict).toBe('replace-now');
  });
});
