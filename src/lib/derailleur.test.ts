import { describe, it, expect } from 'vitest';
import {
  checkCapacity,
  searchDerailleurs,
  derailleurById,
  derailleurSpeeds,
  speedMatches,
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

describe('searchDerailleurs / derailleurById', () => {
  it('returns everything for an empty query', () => {
    expect(searchDerailleurs('').length).toBe(DERAILLEURS.length);
  });
  it('matches all terms across brand/model/discipline/speeds', () => {
    const r = searchDerailleurs('shimano 12');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((d) => d.brand === 'Shimano' && d.speeds.includes('12'))).toBe(true);
  });
  it('finds a specific model and looks it up by id', () => {
    const r = searchDerailleurs('tourney');
    expect(r).toHaveLength(1);
    expect(derailleurById(r[0].id)?.model).toMatch(/Tourney/);
  });
});

describe('derailleurSpeeds / speedMatches', () => {
  it('parses single and multi-speed nominal counts', () => {
    expect(derailleurSpeeds(derailleurById('sh-ultegra-r8000-gs')!)).toEqual([11]);
    expect(derailleurSpeeds(derailleurById('sh-tourney-ty300')!)).toEqual([6, 7]);
  });
  it('matches a cassette cog count against the nominal speeds', () => {
    const ultegra = derailleurById('sh-ultegra-r8000-gs')!; // 11-speed
    expect(speedMatches(ultegra, 11)).toBe(true);
    expect(speedMatches(ultegra, 10)).toBe(false);
    const tourney = derailleurById('sh-tourney-ty300')!; // 6/7-speed
    expect(speedMatches(tourney, 7)).toBe(true);
    expect(speedMatches(tourney, 8)).toBe(false);
  });
});

describe('pullRatioFor', () => {
  it('returns the family pull ratio (11-sp road ≈1.4:1, electronic for AXS)', async () => {
    const { pullRatioFor, derailleurById } = await import('./derailleur');
    expect(pullRatioFor(derailleurById('sh-105-r7000-gs')!)).toBe('≈1.4:1');
    expect(pullRatioFor(derailleurById('sh-tourney-ty300')!)).toBe('≈1.7:1');
    expect(pullRatioFor(derailleurById('sram-force-axs')!)).toBe('electronic');
  });
});
