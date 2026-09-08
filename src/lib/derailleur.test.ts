import { describe, it, expect } from 'vitest';
import {
  checkCapacity,
  searchDerailleurs,
  derailleurByKey,
  derailleurSpeeds,
  speedMatches,
  speedCompatibility,
  fitCassette,
  pullRatioFor,
  DERAILLEURS,
} from './derailleur';

describe('checkCapacity', () => {
  it('computes required capacity (worked example 50/34, 11-32 -> 37T)', () => {
    const r = checkCapacity({
      largestChainring: 50,
      smallestChainring: 34,
      largestCog: 32,
      smallestCog: 11,
      ratedCapacity: 37,
      maxSprocket: 32,
    });
    expect(r.requiredCapacity).toBe(37);
    expect(r.capacityOk).toBe(true);
    expect(r.maxSprocketOk).toBe(true);
  });

  it('fails when capacity or max sprocket exceeded', () => {
    const r = checkCapacity({
      largestChainring: 50,
      smallestChainring: 34,
      largestCog: 36,
      smallestCog: 11,
      ratedCapacity: 35,
      maxSprocket: 32,
    });
    expect(r.capacityOk).toBe(false);
    expect(r.maxSprocketOk).toBe(false);
  });
});

describe('searchDerailleurs / derailleurByKey', () => {
  it('returns everything for an empty query', () => {
    expect(searchDerailleurs('').length).toBe(DERAILLEURS.length);
  });
  it('matches all terms across brand/model/series/speeds', () => {
    const r = searchDerailleurs('shimano deore');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((d) => d.brand === 'Shimano')).toBe(true);
    expect(r.some((d) => d.series === 'Deore')).toBe(true);
  });
  it('looks a row up by its generated key', () => {
    const first = DERAILLEURS[0];
    expect(derailleurByKey(first.key)).toBe(first);
    expect(derailleurByKey('no-such-key')).toBeUndefined();
  });
  it('generates a unique key per row', () => {
    const keys = new Set(DERAILLEURS.map((d) => d.key));
    expect(keys.size).toBe(DERAILLEURS.length);
  });
});

describe('derailleurSpeeds / speedMatches', () => {
  it('reports the nominal speed count and matches a cassette cog count', () => {
    const r7000 = derailleurByKey('shimano-rd-r7000-ss-11s');
    expect(r7000).toBeDefined();
    expect(derailleurSpeeds(r7000!)).toEqual([11]);
    expect(speedMatches(r7000!, 11)).toBe(true);
    expect(speedMatches(r7000!, 10)).toBe(false);
  });
});

describe('deriveActuation', () => {
  it('derives families for Shimano/SRAM, leaves third-party unknown', () => {
    expect(derailleurByKey('shimano-rd-r7000-ss-11s')?.actuation).toBe(
      'Shimano road 1.4 (11-speed & Tiagra 4700)',
    );
    const eagle = DERAILLEURS.find(
      (d) => d.brand === 'SRAM' && d.discipline === 'MTB' && d.speeds === 12 && !d.electronic,
    );
    expect(eagle?.actuation).toBe('SRAM Eagle (X-Actuation)');
    const microshift = DERAILLEURS.find((d) => d.brand === 'Microshift');
    expect(microshift?.actuation).toBeUndefined();
  });

  it('splits Shimano road families by pull ratio, not speed count', () => {
    // Classic 1.7 spans 6–10 (incl. Dura-Ace 7700–7900); old DA 7400 is its own
    // 1.9; Tiagra RD-4700 (10s) shares the 11-speed 1.4 pull — not the classic.
    const da7400 = DERAILLEURS.find((d) => d.model === 'RD-7400');
    expect(da7400?.actuation).toBe('Shimano road 1.9 (Dura-Ace 7400)');
    const tiagra4700 = DERAILLEURS.find((d) => d.model === 'RD-4700')!;
    expect(tiagra4700.speeds).toBe(10);
    expect(tiagra4700.actuation).toBe('Shimano road 1.4 (11-speed & Tiagra 4700)');
    const classic = DERAILLEURS.filter((d) => d.actuation === 'Shimano road 1.7 (classic)');
    expect(classic.some((d) => d.speeds === 10)).toBe(true); // e.g. 105/Ultegra 10s
    // A classic 10-speed and a 4700 are 10-speed but NOT the same family.
    const classic10 = classic.find((d) => d.speeds === 10)!;
    expect(classic10.actuation).not.toBe(tiagra4700.actuation);
  });
  it('classifies Campagnolo by speeds and electronic', () => {
    const campy = DERAILLEURS.filter((d) => d.brand === 'Campagnolo');
    expect(campy.length).toBeGreaterThan(0);
    expect(campy.find((d) => d.speeds === 10)?.actuation).toBe('Campagnolo 10-speed');
    expect(campy.find((d) => d.speeds === 11)?.actuation).toBe('Campagnolo 11-speed');
    expect(campy.find((d) => d.speeds === 12 && !d.electronic)?.actuation).toBe(
      'Campagnolo 12-speed',
    );
    expect(campy.find((d) => d.electronic)?.actuation).toBe('Campagnolo WRL (electronic)');
  });
});

describe('speedCompatibility', () => {
  it('is a match at the nominal speed count', () => {
    expect(speedCompatibility(derailleurByKey('shimano-rd-r7000-ss-11s')!, 11)).toBe('match');
  });
  it('treats electronic mismatches as incompatible (no re-indexing)', () => {
    const axs = searchDerailleurs('sram').find((d) => d.electronic && d.speeds === 12);
    expect(axs).toBeDefined();
    expect(speedCompatibility(axs!, 11)).toBe('incompatible');
  });
  it('allows other counts within the actuation family', () => {
    // A classic-1.7 10-speed road RD indexes a 9-speed setup (family spans 6–10).
    const classic10 = DERAILLEURS.find(
      (d) => d.actuation === 'Shimano road 1.7 (classic)' && d.speeds === 10,
    )!;
    expect(speedCompatibility(classic10, 9)).toBe('family');
  });
  it('falls to friction for a mechanical count outside its family', () => {
    // Tiagra RD-4700 is 1.4 (family 10/11), so a 9-speed cassette needs friction —
    // it is NOT part of the classic 6–10 family despite being 10-speed.
    const t = DERAILLEURS.find((d) => d.model === 'RD-4700')!;
    expect(t.speeds).toBe(10);
    expect(speedCompatibility(t, 9)).toBe('friction');
    // And a classic-1.7 RD can't index 11-speed (11 is the 1.4 family).
    const classic = DERAILLEURS.find((d) => d.actuation === 'Shimano road 1.7 (classic)')!;
    expect(speedCompatibility(classic, 11)).toBe('friction');
  });
  it('is unknown when the family could not be derived (third-party)', () => {
    const ms = DERAILLEURS.find((d) => d.brand === 'Microshift' && !d.electronic)!;
    expect(speedCompatibility(ms, ms.speeds + 1)).toBe('unknown');
  });
});

describe('fitCassette', () => {
  const r7000 = () => derailleurByKey('shimano-rd-r7000-ss-11s')!; // 11sp, max 30T, cap 35T

  it('is ok (green) when cog, capacity and speed all pass', () => {
    // 11-speed cassette 11-28 with a 50/34: required 33T ≤ 35T, cog 28 ≤ 30.
    const fit = fitCassette(r7000(), [50, 34], [11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 30].slice(0, 11));
    expect(fit.cog).toBe('ok');
    expect(fit.capacity).toBe('ok');
    expect(fit.speed).toBe('match');
    expect(fit.level).toBe('ok');
    expect(fit.requiredCapacity).toBe(50 - 34 + (30 - 11));
  });

  it('flags a slightly oversized cog as caution (amber)', () => {
    // 1×42, 11–32 on an SS (max 30T): cog +2T over, capacity tiny.
    const fit = fitCassette(r7000(), [42], [11, 32]);
    expect(fit.cog).toBe('caution');
    expect(fit.cogOver).toBe(2);
    expect(fit.level).toBe('caution');
  });

  it('marks a way-oversized cog as incompatible (red)', () => {
    const fit = fitCassette(r7000(), [42], [11, 40]); // +10T over the 30T max
    expect(fit.cog).toBe('over');
    expect(fit.level).toBe('incompatible');
  });

  it('an electronic speed mismatch is incompatible even when cog/cap fit', () => {
    const axs = searchDerailleurs('sram').find((d) => d.electronic && d.speeds === 12)!;
    const fit = fitCassette(axs, [40], [10, 11, 12, 13, 14, 16, 18, 21, 24, 28, 33]); // 11 cogs
    expect(fit.speed).toBe('incompatible');
    expect(fit.level).toBe('incompatible');
  });

  it('reports unknown dimensions without dragging the level down', () => {
    // A Campagnolo row with no capacity/max-cog data still judges by speed only.
    const noData = DERAILLEURS.find(
      (d) => d.totalCapacity == null && d.maxSprocket == null && d.actuation,
    )!;
    const fit = fitCassette(noData, [50, 34], Array.from({ length: noData.speeds }, (_, i) => 11 + i));
    expect(fit.cog).toBe('unknown');
    expect(fit.capacity).toBe('unknown');
    expect(fit.speed).toBe('match');
    expect(fit.level).toBe('ok');
  });
});

describe('pullRatioFor', () => {
  it('prefers the sourced numeric ratio, "electronic" for electronic groups', () => {
    expect(pullRatioFor(derailleurByKey('shimano-rd-r7000-ss-11s')!)).toBe('1.4:1');
    const axs = searchDerailleurs('sram').find((d) => d.electronic);
    expect(axs).toBeDefined();
    expect(pullRatioFor(axs!)).toBe('electronic');
  });
});
