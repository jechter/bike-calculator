import { describe, it, expect } from 'vitest';
import {
  computeGears,
  chainLength,
  gearRange,
  chainWearThresholdsFor,
  HUB_PRESETS,
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

describe('HUB_PRESETS (loaded from data/hub-gears.json)', () => {
  it('loads presets with valid, ratio-ordered gears', () => {
    expect(HUB_PRESETS.length).toBeGreaterThan(10);
    for (const p of HUB_PRESETS) {
      expect(p.gears.length).toBeGreaterThanOrEqual(2);
      for (const g of p.gears) expect(g.ratio).toBeGreaterThan(0);
    }
  });

  it('names discrete gears by ordinal and exposes CVT endpoints as Low/High', () => {
    const rohloff = HUB_PRESETS.find((p) => p.label === 'Rohloff Speedhub')!;
    expect(rohloff.continuouslyVariable).toBe(false);
    expect(rohloff.gears).toHaveLength(14);
    expect(rohloff.gears[0].name).toBe('1st');
    expect(rohloff.gears[10].name).toBe('11th');

    const cvt = HUB_PRESETS.find((p) => p.continuouslyVariable)!;
    expect(cvt.gears.map((g) => g.name)).toEqual(['Low', 'High']);
    expect(cvt.gears[1].ratio).toBeGreaterThan(cvt.gears[0].ratio);
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

describe('chainWearThresholdsFor', () => {
  it('11/12-speed cassette -> single 0.5% row', () => {
    expect(chainWearThresholdsFor(true, 12).map((t) => t.replaceAtPercent)).toEqual([0.5]);
    expect(chainWearThresholdsFor(true, 11).map((t) => t.replaceAtPercent)).toEqual([0.5]);
  });
  it('6-10 speed cassette -> single 0.75% row', () => {
    expect(chainWearThresholdsFor(true, 10).map((t) => t.replaceAtPercent)).toEqual([0.75]);
    expect(chainWearThresholdsFor(true, 8).map((t) => t.replaceAtPercent)).toEqual([0.75]);
  });
  it('single speed / hub -> both narrow (0.75%) and wide (1.0%) rows', () => {
    expect(chainWearThresholdsFor(false, 1).map((t) => t.replaceAtPercent)).toEqual([0.75, 1.0]);
  });
});

describe('chainLength', () => {
  it('matches the worked example (410mm / 50 / 28 -> 53in / 106 links / ~1346mm)', () => {
    const r = chainLength({ chainstayMm: 410, largestChainring: 50, largestCog: 28 });
    expect(r.rawInches).toBeCloseTo(52.78, 1);
    expect(r.inches).toBe(53);
    expect(r.links).toBe(106);
    expect(r.mm).toBe(1346);
  });
});
