import { describe, it, expect } from 'vitest';
import {
  checkCapacity,
  searchDerailleurs,
  derailleurByKey,
  derailleurSpeeds,
  speedMatches,
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
});

describe('pullRatioFor', () => {
  it('prefers the sourced numeric ratio, "electronic" for electronic groups', () => {
    expect(pullRatioFor(derailleurByKey('shimano-rd-r7000-ss-11s')!)).toBe('1.4:1');
    const axs = searchDerailleurs('sram').find((d) => d.electronic);
    expect(axs).toBeDefined();
    expect(pullRatioFor(axs!)).toBe('electronic');
  });
});
