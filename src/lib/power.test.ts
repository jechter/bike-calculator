import { describe, it, expect } from 'vitest';
import { powerForSpeed, speedForPower, powerSplit } from './power';
import { kmhToMs } from './units';

const flat = {
  massKg: 80,
  gradient: 0,
  crr: 0.005,
  rho: 1.225,
  cda: 0.32,
  headwindMs: 0,
  drivetrainEfficiency: 0.97,
};

describe('powerForSpeed', () => {
  it('matches the flat worked example (~150 W at 30 km/h)', () => {
    const p = powerForSpeed(kmhToMs(30), flat);
    expect(p).toBeGreaterThan(145);
    expect(p).toBeLessThan(155);
  });

  it('matches the climb worked example (~180 W, 6% at 12 km/h)', () => {
    const p = powerForSpeed(kmhToMs(12), { ...flat, gradient: 0.06 });
    expect(p).toBeGreaterThan(175);
    expect(p).toBeLessThan(190);
  });
});

describe('speedForPower', () => {
  it('is the inverse of powerForSpeed', () => {
    const v = kmhToMs(30);
    const p = powerForSpeed(v, flat);
    const vBack = speedForPower(p, flat);
    expect(vBack).toBeCloseTo(v, 3);
  });
});

describe('powerSplit', () => {
  it('is dominated by aero on the flat', () => {
    const s = powerSplit(kmhToMs(35), flat);
    expect(s.aero).toBeGreaterThan(s.rolling);
    expect(s.gravity).toBeCloseTo(0, 3);
  });

  it('is dominated by gravity on a steep climb', () => {
    const s = powerSplit(kmhToMs(10), { ...flat, gradient: 0.08 });
    expect(s.gravity).toBeGreaterThan(s.aero);
    expect(s.gravity).toBeGreaterThan(s.rolling);
  });

  it('shows gravity assisting (negative) on a descent, resisting forces summing to 100%', () => {
    const s = powerSplit(kmhToMs(30), { ...flat, gradient: -0.015 });
    // gravity assists (negative share) rather than distorting the split
    expect(s.gravity).toBeLessThan(0);
    // the forces actually resisting (rolling + aero) are shares of the
    // resisting power, so they add up to ~100%
    expect(s.rolling + s.aero).toBeCloseTo(100, 3);
    expect(s.rolling).toBeGreaterThan(0);
    expect(s.aero).toBeGreaterThan(0);
  });
});
