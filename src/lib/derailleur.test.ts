import { describe, it, expect } from 'vitest';
import {
  checkCapacity,
  searchDerailleurs,
  derailleurByKey,
  derailleurSpeeds,
  speedMatches,
  speedCompatibility,
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
      'Shimano road 11-speed',
    );
    const eagle = DERAILLEURS.find(
      (d) => d.brand === 'SRAM' && d.discipline === 'MTB' && d.speeds === 12 && !d.electronic,
    );
    expect(eagle?.actuation).toBe('SRAM Eagle (X-Actuation)');
    const microshift = DERAILLEURS.find((d) => d.brand === 'Microshift');
    expect(microshift?.actuation).toBeUndefined();
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
    // Tiagra RD-4700 is 10-speed road; its family covers 8/9/10.
    const t = searchDerailleurs('4700').find((d) => d.cage === 'GS')!;
    expect(t.speeds).toBe(10);
    expect(speedCompatibility(t, 9)).toBe('family');
  });
  it('falls to friction for a mechanical count outside its family', () => {
    // RD-R7000 (11-sp road) family is 11 only, so a 10-sp cassette needs friction.
    expect(speedCompatibility(derailleurByKey('shimano-rd-r7000-ss-11s')!, 10)).toBe('friction');
  });
  it('is unknown when the family could not be derived (third-party)', () => {
    const ms = DERAILLEURS.find((d) => d.brand === 'Microshift' && !d.electronic)!;
    expect(speedCompatibility(ms, ms.speeds + 1)).toBe('unknown');
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
