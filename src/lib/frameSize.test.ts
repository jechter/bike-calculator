import { describe, it, expect } from 'vitest';
import { frameSizeFromInseam, inseamFromHeight, suggestCrankLength } from './frameSize';

describe('inseamFromHeight', () => {
  it('is ~47% of height', () => {
    expect(inseamFromHeight(178)).toBeCloseTo(83.66, 1);
    expect(inseamFromHeight(170)).toBeCloseTo(79.9, 1);
  });
});

describe('frameSizeFromInseam', () => {
  it('respects frame style (road taller frame than mtb for same inseam)', () => {
    const road = frameSizeFromInseam({ inseamCm: 84, style: 'road' });
    const mtb = frameSizeFromInseam({ inseamCm: 84, style: 'mtb' });
    expect(road.frameCm).toBeGreaterThan(mtb.frameCm);
  });

  it('height path matches an equivalent measured inseam (consistency)', () => {
    const viaHeight = frameSizeFromInseam({ inseamCm: inseamFromHeight(180), style: 'road' });
    const viaInseam = frameSizeFromInseam({ inseamCm: 180 * 0.47, style: 'road' });
    expect(viaHeight.frameCm).toBeCloseTo(viaInseam.frameCm, 6);
  });

  it('nominal size is by rider, consistent across styles (not XS for a tall rider)', () => {
    const inseam = inseamFromHeight(185); // ~87 cm
    const road = frameSizeFromInseam({ inseamCm: inseam, style: 'road' });
    const mtb = frameSizeFromInseam({ inseamCm: inseam, style: 'mtb' });
    expect(mtb.nominalSize).toBe(road.nominalSize);
    expect(mtb.nominalSize).not.toBe('XS');
    expect(['L', 'XL']).toContain(mtb.nominalSize);
  });

  it('nominal scales with rider size', () => {
    expect(frameSizeFromInseam({ inseamCm: 74, style: 'mtb' }).nominalSize).toBe('XS');
    expect(frameSizeFromInseam({ inseamCm: 82, style: 'mtb' }).nominalSize).toBe('M');
    expect(frameSizeFromInseam({ inseamCm: 93, style: 'road' }).nominalSize).toBe('XXL');
  });

  it('saddle height is the LeMond 0.883 factor', () => {
    expect(frameSizeFromInseam({ inseamCm: 84, style: 'road' }).saddleHeightCm).toBeCloseTo(
      84 * 0.883,
      3,
    );
  });
});

describe('suggestCrankLength', () => {
  it('lands on an available crank size within a sensible range', () => {
    const r = suggestCrankLength(84);
    expect(r.suggestedMm).toBeGreaterThanOrEqual(165);
    expect(r.suggestedMm).toBeLessThanOrEqual(180);
  });
});
