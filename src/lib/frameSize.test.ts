import { describe, it, expect } from 'vitest';
import {
  frameSizeFromInseam,
  fitFromFrameSize,
  inseamFromHeight,
  suggestCrankLength,
} from './frameSize';

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

describe('fitFromFrameSize', () => {
  it('inverts frameSizeFromInseam (frame → inseam round-trips)', () => {
    const forward = frameSizeFromInseam({ inseamCm: 84, style: 'road' });
    const back = fitFromFrameSize({ frameCm: forward.frameCm, style: 'road' });
    expect(back.inseamCm).toBeCloseTo(84, 6);
    expect(back.nominalSize).toBe(forward.nominalSize);
    expect(back.saddleHeightCm).toBeCloseTo(forward.saddleHeightCm, 6);
  });

  it('the inseam band matches the forward frame range, inverted', () => {
    const back = fitFromFrameSize({ frameCm: 56, style: 'road' });
    // A rider at each end of the band sizes back onto (roughly) the frame range.
    const lo = frameSizeFromInseam({ inseamCm: back.inseamRangeCm[0], style: 'road' });
    const hi = frameSizeFromInseam({ inseamCm: back.inseamRangeCm[1], style: 'road' });
    expect(lo.frameCm).toBeCloseTo(54.5, 6);
    expect(hi.frameCm).toBeCloseTo(57.5, 6);
  });

  it('a bigger road frame fits a taller rider', () => {
    const small = fitFromFrameSize({ frameCm: 52, style: 'road' });
    const large = fitFromFrameSize({ frameCm: 58, style: 'road' });
    expect(large.heightCm).toBeGreaterThan(small.heightCm);
  });

  it('same frame cm reads as a taller rider on an mtb than on a road bike', () => {
    // MTB's smaller multiplier means a given seat-tube cm belongs to a longer leg.
    const road = fitFromFrameSize({ frameCm: 48, style: 'road' });
    const mtb = fitFromFrameSize({ frameCm: 48, style: 'mtb' });
    expect(mtb.inseamCm).toBeGreaterThan(road.inseamCm);
  });

  it('leg proportion shifts the height band but not the inseam', () => {
    const avg = fitFromFrameSize({ frameCm: 56, style: 'road', legProportion: 0.47 });
    const longLegs = fitFromFrameSize({ frameCm: 56, style: 'road', legProportion: 0.49 });
    expect(longLegs.inseamCm).toBeCloseTo(avg.inseamCm, 6);
    expect(longLegs.heightCm).toBeLessThan(avg.heightCm); // longer legs → shorter rider
  });
});

describe('suggestCrankLength', () => {
  it('lands on an available crank size within a sensible range', () => {
    const r = suggestCrankLength(84);
    expect(r.suggestedMm).toBeGreaterThanOrEqual(165);
    expect(r.suggestedMm).toBeLessThanOrEqual(180);
  });
});
