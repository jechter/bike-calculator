import { describe, it, expect } from 'vitest';
import {
  computeGears,
  chainLength,
  singleSpeedChainLength,
  beltCenterDistanceMm,
  idealBeltTeeth,
  nearbyBeltOptions,
  BELT_PITCH_MM,
  GATES_BELT_TEETH,
  gearRange,
  chainWearThresholdsFor,
  HUB_PRESETS,
  CASSETTE_PRESETS,
  deriveCassetteSpacing,
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

describe('CASSETTE_PRESETS (loaded from data/cassette-presets.json)', () => {
  it('loads a large brand/model dataset with ascending cog counts', () => {
    expect(CASSETTE_PRESETS.length).toBeGreaterThan(100);
    for (const p of CASSETTE_PRESETS) {
      expect(p.brand.length).toBeGreaterThan(0);
      // speeds match the cog count, and cogs are sorted smallest-first.
      expect(p.cogs.length).toBe(p.speeds);
      for (let i = 1; i < p.cogs.length; i++) {
        expect(p.cogs[i]).toBeGreaterThan(p.cogs[i - 1]);
      }
      // every row resolves to a known spacing standard.
      expect(['shimano-sram', 'campagnolo', 'linkglide', 'proprietary']).toContain(p.spacing);
    }
  });

  it('every Campagnolo-branded cassette is Campagnolo spacing', () => {
    for (const p of CASSETTE_PRESETS) {
      if (p.brand === 'Campagnolo') expect(p.spacing).toBe('campagnolo');
    }
  });
});

describe('deriveCassetteSpacing', () => {
  const base = { brand: 'X', model: 'Y', speeds: 11, sprockets: [] as number[] };

  it('honours an explicit spacing override', () => {
    expect(deriveCassetteSpacing({ ...base, freehub: 'Campagnolo', spacing: 'shimano-sram' })).toBe(
      'shimano-sram',
    );
  });
  it('treats a Campagnolo freehub as Campagnolo pitch (incl. third-party)', () => {
    expect(deriveCassetteSpacing({ ...base, brand: 'Edco', freehub: 'Campagnolo' })).toBe(
      'campagnolo',
    );
    expect(deriveCassetteSpacing({ ...base, brand: 'Campagnolo', freehub: 'Campagnolo' })).toBe(
      'campagnolo',
    );
  });
  it('tags LinkGlide by its special marker (shares the HG freehub body)', () => {
    expect(
      deriveCassetteSpacing({ ...base, brand: 'Shimano', freehub: 'HG 8, HG 11', special: 'LinkGlide' }),
    ).toBe('linkglide');
  });
  it('leaves closed systems (Classified, Rotor) proprietary', () => {
    expect(deriveCassetteSpacing({ ...base, freehub: 'Classified' })).toBe('proprietary');
    expect(deriveCassetteSpacing({ ...base, freehub: 'Rotor' })).toBe('proprietary');
  });
  it('defaults everything else to the shared Shimano/SRAM pitch', () => {
    expect(deriveCassetteSpacing({ ...base, brand: 'SRAM', freehub: 'XDR' })).toBe('shimano-sram');
    expect(deriveCassetteSpacing({ ...base, brand: 'Shimano', freehub: 'Micro Spline' })).toBe(
      'shimano-sram',
    );
  });
});

describe('singleSpeedChainLength', () => {
  it('is the wrap length rounded up to a whole even link count', () => {
    const r = singleSpeedChainLength(410, 50, 28);
    // ~104 half-inch links (no derailleur +1"), 104 * 12.7 ≈ 1321 mm.
    expect(r.exactLinks).toBeCloseTo(103.9, 0);
    expect(r.links).toBe(104);
    expect(r.links % 2).toBe(0);
    expect(r.mm).toBe(1321);
  });

  it('never rounds down below the exact wrap length', () => {
    for (const cs of [360, 405, 430, 470]) {
      const r = singleSpeedChainLength(cs, 44, 18);
      expect(r.links).toBeGreaterThanOrEqual(r.exactLinks);
      expect(r.links % 2).toBe(0);
    }
  });
});

describe('belt drive', () => {
  it('belt length is teeth * 11 mm pitch', () => {
    expect(BELT_PITCH_MM).toBe(11);
    expect(GATES_BELT_TEETH).toContain(118);
    // 111T = 1221 mm, 125T = 1375 mm (Gates catalogue).
    expect(111 * BELT_PITCH_MM).toBe(1221);
    expect(125 * BELT_PITCH_MM).toBe(1375);
  });

  it('centre distance for a 118T belt on 50/24 is ~443 mm', () => {
    expect(beltCenterDistanceMm(118, 50, 24)).toBeCloseTo(443, 0);
  });

  it('returns null when the belt is too short to span the sprockets', () => {
    expect(beltCenterDistanceMm(30, 50, 24)).toBeNull();
  });

  it('idealBeltTeeth inverts beltCenterDistanceMm', () => {
    for (const B of [113, 118, 125]) {
      const cd = beltCenterDistanceMm(B, 46, 22)!;
      expect(idealBeltTeeth(cd, 46, 22)).toBeCloseTo(B, 3);
    }
  });

  it('nearbyBeltOptions returns catalogued sizes ordered by tooth count', () => {
    const opts = nearbyBeltOptions(440, 50, 22, 5);
    expect(opts).toHaveLength(5);
    for (const o of opts) {
      expect(GATES_BELT_TEETH).toContain(o.teeth);
      expect(o.lengthMm).toBe(o.teeth * BELT_PITCH_MM);
      // deltaMm is how far the frame's centre distance must move from the target.
      expect(o.deltaMm).toBeCloseTo(o.centerDistanceMm - 440, 6);
    }
    for (let i = 1; i < opts.length; i++) {
      expect(opts[i].teeth).toBeGreaterThan(opts[i - 1].teeth);
    }
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
