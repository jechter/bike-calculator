import { describe, it, expect } from 'vitest';
import { powerForSpeed, speedForPower, powerBreakdown } from './power';
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

describe('powerBreakdown', () => {
  it('is dominated by aero on the flat, and the parts sum to pedal power', () => {
    const b = powerBreakdown(kmhToMs(35), flat);
    expect(b.aero).toBeGreaterThan(b.rolling);
    expect(b.gravity).toBeCloseTo(0, 3);
    expect(b.drivetrain).toBeGreaterThan(0);
    expect(b.gravity + b.rolling + b.aero + b.drivetrain).toBeCloseTo(b.total, 6);
    expect(b.total).toBeCloseTo(powerForSpeed(kmhToMs(35), flat), 6);
  });

  it('is dominated by gravity on a steep climb', () => {
    const b = powerBreakdown(kmhToMs(10), { ...flat, gradient: 0.08 });
    expect(b.gravity).toBeGreaterThan(b.aero);
    expect(b.gravity).toBeGreaterThan(b.rolling);
  });

  it('shows gravity assisting (negative watts) on a descent', () => {
    const b = powerBreakdown(kmhToMs(30), { ...flat, gradient: -0.015 });
    expect(b.gravity).toBeLessThan(0);
    expect(b.rolling).toBeGreaterThan(0);
    expect(b.aero).toBeGreaterThan(0);
  });

  it('drivetrain loss is the road power times (1/eff - 1)', () => {
    const b = powerBreakdown(kmhToMs(30), flat);
    const road = b.gravity + b.rolling + b.aero;
    expect(b.drivetrain).toBeCloseTo(road * (1 / flat.drivetrainEfficiency - 1), 6);
  });
});
