import { describe, it, expect } from 'vitest';
import {
  frameSizeFromInseam,
  fitFromFrameSize,
  inseamFromHeight,
  suggestCrankLength,
  wheelForFrame,
  cockpitForFrame,
  cockpitForFit,
  fitTargets,
  armFromHeight,
  armFromHeightInseam,
  torsoFromHeightInseam,
  findCategory,
  resolveFit,
  inseamFromFrame,
  inseamFromStack,
  heightFromReach,
  saddleHeight,
  SEED_HEIGHT_CM,
} from './frameSize';

const ROAD = findCategory('road-endurance');
const AERO = findCategory('road-aero');
const VINTAGE = findCategory('vintage-road');
const TT = findCategory('tt');
const CITY = findCategory('city');
const MTB = findCategory('mtb');

describe('inseamFromHeight', () => {
  it('is ~47% of height', () => {
    expect(inseamFromHeight(178)).toBeCloseTo(83.66, 1);
    expect(inseamFromHeight(170)).toBeCloseTo(79.9, 1);
  });
});

describe('frameSizeFromInseam', () => {
  it('respects the category (road taller frame than mtb for same inseam)', () => {
    const road = frameSizeFromInseam(84, ROAD);
    const mtb = frameSizeFromInseam(84, MTB);
    expect(road.frameCm).toBeGreaterThan(mtb.frameCm);
  });

  it('nominal size is by rider, consistent across categories (not XS for a tall rider)', () => {
    const inseam = inseamFromHeight(185); // ~87 cm
    const road = frameSizeFromInseam(inseam, ROAD);
    const mtb = frameSizeFromInseam(inseam, MTB);
    expect(mtb.nominalSize).toBe(road.nominalSize);
    expect(mtb.nominalSize).not.toBe('XS');
    expect(['L', 'XL']).toContain(mtb.nominalSize);
  });

  it('nominal scales with rider size', () => {
    expect(frameSizeFromInseam(74, MTB).nominalSize).toBe('XS');
    expect(frameSizeFromInseam(82, MTB).nominalSize).toBe('M');
    expect(frameSizeFromInseam(93, ROAD).nominalSize).toBe('XXL');
  });

  it('saddle height is the LeMond 0.883 factor', () => {
    expect(frameSizeFromInseam(84, ROAD).saddleHeightCm).toBeCloseTo(84 * 0.883, 3);
  });
});

describe('fitFromFrameSize', () => {
  it('inverts frameSizeFromInseam (frame → inseam round-trips)', () => {
    const forward = frameSizeFromInseam(84, ROAD);
    const back = fitFromFrameSize({ frameCm: forward.frameCm, category: ROAD });
    expect(back.inseamCm).toBeCloseTo(84, 6);
    expect(back.nominalSize).toBe(forward.nominalSize);
    expect(back.saddleHeightCm).toBeCloseTo(forward.saddleHeightCm, 6);
  });

  it('a bigger road frame fits a taller rider', () => {
    const small = fitFromFrameSize({ frameCm: 52, category: ROAD });
    const large = fitFromFrameSize({ frameCm: 58, category: ROAD });
    expect(large.heightCm).toBeGreaterThan(small.heightCm);
  });

  it('same frame cm reads as a taller rider on an mtb than on a road bike', () => {
    const road = fitFromFrameSize({ frameCm: 48, category: ROAD });
    const mtb = fitFromFrameSize({ frameCm: 48, category: MTB });
    expect(mtb.inseamCm).toBeGreaterThan(road.inseamCm);
  });

  it('leg proportion shifts the height band but not the inseam', () => {
    const avg = fitFromFrameSize({ frameCm: 56, category: ROAD, legProportion: 0.47 });
    const longLegs = fitFromFrameSize({ frameCm: 56, category: ROAD, legProportion: 0.49 });
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

describe('wheelForFrame', () => {
  const GRAVEL = findCategory('gravel-adventure');
  const VINTAGE_MTB = findCategory('vintage-mtb');
  const VINTAGE_CITY = findCategory('vintage-city');

  it('road/gravel frames run 700c, dropping to 650b on the smallest sizes', () => {
    expect(wheelForFrame(ROAD, 56).label).toBe('700c');
    expect(wheelForFrame(GRAVEL, 54).label).toBe('700c');
    expect(wheelForFrame(ROAD, 44).label).toBe('650b'); // small frame
  });

  it('trail bikes run 29", the smallest frames dropping to 27.5"', () => {
    expect(wheelForFrame(MTB, 48).label).toBe('29"');
    expect(wheelForFrame(MTB, 40).label).toBe('27.5"');
  });

  it('vintage frames keep their traditional sizes', () => {
    expect(wheelForFrame(VINTAGE, 56).label).toBe('27"');
    expect(wheelForFrame(VINTAGE_MTB, 48).label).toBe('26"');
    expect(wheelForFrame(VINTAGE_CITY, 56).label).toBe('28"');
  });

  it('a 29" wheel is drawn larger than a 26" one', () => {
    expect(wheelForFrame(MTB, 50).outerMm).toBeGreaterThan(wheelForFrame(VINTAGE_MTB, 50).outerMm);
  });

  it("steps down to kids' wheels as the frame (rider) shrinks", () => {
    // Road multiplier 0.665: pick frames whose implied inseam lands in each band.
    expect(wheelForFrame(ROAD, 0.665 * 63).label).toBe('24"'); // inseam ~63
    expect(wheelForFrame(ROAD, 0.665 * 56).label).toBe('20"'); // inseam ~56
    expect(wheelForFrame(ROAD, 0.665 * 49).label).toBe('16"'); // inseam ~49
    expect(wheelForFrame(ROAD, 0.665 * 44).label).toBe('14"'); // inseam ~44
    expect(wheelForFrame(ROAD, 0.665 * 40).label).toBe('12"'); // inseam ~40
  });

  it("the kids' ladder is keyed on the rider, so a small road and mtb frame agree", () => {
    // Same-sized child: pick each category's frame cm for a 56 cm inseam.
    expect(wheelForFrame(ROAD, 0.665 * 56).label).toBe('20"');
    expect(wheelForFrame(MTB, 0.57 * 56).label).toBe('20"');
  });

  it("a small-adult mtb still gets 27.5\", not a kids' wheel", () => {
    // 160 cm adult, ~75 cm inseam → well above the kids' range.
    expect(wheelForFrame(MTB, 0.57 * 75).label).toBe('27.5"');
  });

  it('kids wheels are drawn smaller than adult ones', () => {
    expect(wheelForFrame(ROAD, 0.665 * 56).outerMm).toBeLessThan(wheelForFrame(ROAD, 56).outerMm);
  });
});

describe('cockpitForFrame', () => {
  it('matches the category base at the average frame size', () => {
    const refCm = 84 * ROAD.sizeMult;
    const c = cockpitForFrame(ROAD, refCm);
    expect(c.stemLenMm).toBe(100);
    expect(c.spacerMm).toBe(30);
    expect(c.bar).toBe('drop');
  });

  it('gives a bigger frame a longer stem and fewer spacers', () => {
    const refCm = 84 * ROAD.sizeMult;
    const big = cockpitForFrame(ROAD, refCm + 8);
    const small = cockpitForFrame(ROAD, refCm - 8);
    expect(big.stemLenMm).toBeGreaterThan(small.stemLenMm);
    expect(big.spacerMm).toBeLessThan(small.spacerMm);
  });

  it('keeps the stem within a sensible range and snapped to 10 mm', () => {
    const c = cockpitForFrame(ROAD, 62);
    expect(c.stemLenMm % 10).toBe(0);
    expect(c.stemLenMm).toBeGreaterThanOrEqual(35);
    expect(c.stemLenMm).toBeLessThanOrEqual(140);
  });

  it('carries the category bar type', () => {
    expect(cockpitForFrame(MTB, 48).bar).toBe('flat');
    expect(cockpitForFrame(TT, 54).bar).toBe('aero');
  });
});

describe('cockpitForFit (reach/stack compensation)', () => {
  const refCm = 84 * ROAD.sizeMult;

  it('matches the plain cockpit when there is no gap', () => {
    const base = cockpitForFrame(ROAD, refCm);
    const fit = cockpitForFit(ROAD, refCm, { reachGapMm: 0, stackGapMm: 0 });
    expect(fit.stemLenMm).toBe(base.stemLenMm);
    expect(fit.spacerMm).toBe(base.spacerMm);
  });

  it('lengthens the stem to cover a frame that is too short in reach', () => {
    const base = cockpitForFrame(ROAD, refCm);
    const fit = cockpitForFit(ROAD, refCm, { reachGapMm: 30 });
    expect(fit.stemLenMm).toBeGreaterThan(base.stemLenMm);
    expect(fit.stemLenMm - base.stemLenMm).toBeGreaterThanOrEqual(20);
  });

  it('adds spacers to raise a frame that is too low in stack', () => {
    const base = cockpitForFrame(ROAD, refCm);
    const fit = cockpitForFit(ROAD, refCm, { stackGapMm: 30 });
    expect(fit.spacerMm).toBeGreaterThan(base.spacerMm);
  });

  it('shortens the stem for a frame longer than the rider needs', () => {
    const base = cockpitForFrame(ROAD, refCm);
    const fit = cockpitForFit(ROAD, refCm, { reachGapMm: -30 });
    expect(fit.stemLenMm).toBeLessThan(base.stemLenMm);
  });

  it('keeps the stem within buildable limits for a huge gap', () => {
    const fit = cockpitForFit(ROAD, refCm, { reachGapMm: 400 });
    expect(fit.stemLenMm).toBeLessThanOrEqual(150);
  });
});

describe('body-segment estimates', () => {
  it('arm is ~33% of height', () => {
    expect(armFromHeight(178)).toBeCloseTo(58.7, 1);
  });

  it('arm-from-height-and-inseam equals the height estimate at an average inseam', () => {
    const avgInseam = 0.47 * 178;
    expect(armFromHeightInseam(178, avgInseam)).toBeCloseTo(armFromHeight(178), 6);
  });

  it('arm-from-height-and-inseam grows with a leggier build (same height)', () => {
    const leggy = armFromHeightInseam(178, 90);
    const stocky = armFromHeightInseam(178, 78);
    expect(leggy).toBeGreaterThan(stocky);
  });

  it('torso is shoulder height minus inseam, floored at zero', () => {
    expect(torsoFromHeightInseam(178, 82)).toBeCloseTo(178 * 0.818 - 82, 5);
    expect(torsoFromHeightInseam(178, 200)).toBe(0); // never negative
  });
});

describe('fitTargets (reach & stack)', () => {
  const base = { heightCm: 178, inseamCm: 82, armCm: 59, category: ROAD };

  it('gives realistic reach & stack for a typical rider', () => {
    const t = fitTargets(base);
    expect(t.reachMm).toBeGreaterThan(360);
    expect(t.reachMm).toBeLessThan(410);
    expect(t.stackMm).toBeGreaterThan(555);
    expect(t.stackMm).toBeLessThan(615);
  });

  it('surrounds the target with a band', () => {
    const t = fitTargets(base);
    expect(t.reachRangeMm[0]).toBeLessThan(t.reachMm);
    expect(t.reachRangeMm[1]).toBeGreaterThan(t.reachMm);
    expect(t.stackRangeMm[0]).toBeLessThan(t.stackMm);
    expect(t.stackRangeMm[1]).toBeGreaterThan(t.stackMm);
  });

  it('a race category is longer & lower than an upright one', () => {
    const aero = fitTargets({ ...base, category: AERO });
    const city = fitTargets({ ...base, category: CITY });
    expect(aero.reachMm).toBeGreaterThan(city.reachMm);
    expect(aero.stackMm).toBeLessThan(city.stackMm);
    expect(city.stackReach).toBeGreaterThan(aero.stackReach); // more upright = higher ratio
  });

  it('a longer torso/arm lengthens reach without touching stack', () => {
    const longer = fitTargets({ ...base, armCm: base.armCm + 5 });
    expect(longer.reachMm).toBeGreaterThan(fitTargets(base).reachMm);
    expect(longer.stackMm).toBeCloseTo(fitTargets(base).stackMm, 6);
  });

  it('a longer inseam raises stack', () => {
    const taller = fitTargets({ ...base, inseamCm: base.inseamCm + 4 });
    expect(taller.stackMm).toBeGreaterThan(fitTargets(base).stackMm);
  });

  it('ranks stack sensibly across road positions: TT lowest, vintage above aero, below endurance', () => {
    const body = { heightCm: 178, inseamCm: 82, armCm: 59 };
    const tt = fitTargets({ ...body, category: TT }).stackMm;
    const aero = fitTargets({ ...body, category: AERO }).stackMm;
    const vintage = fitTargets({ ...body, category: VINTAGE }).stackMm;
    const endurance = fitTargets({ ...body, category: ROAD }).stackMm;
    // TT is the most aggressive; vintage is not more aggressive than modern aero.
    expect(tt).toBeLessThan(aero);
    expect(vintage).toBeGreaterThan(aero);
    expect(vintage).toBeLessThan(endurance);
  });

  it('TT gives the longest reach', () => {
    const body = { heightCm: 178, inseamCm: 82, armCm: 59 };
    const tt = fitTargets({ ...body, category: TT }).reachMm;
    const aero = fitTargets({ ...body, category: AERO }).reachMm;
    expect(tt).toBeGreaterThan(aero);
  });
});

describe('saddleHeight (crank-aware)', () => {
  it('is the plain LeMond figure at the suggested crank', () => {
    expect(saddleHeight(84)).toBeCloseTo(84 * 0.883, 6);
    // A kid's short-crank bike also sits at the LeMond height — no spurious raise.
    expect(saddleHeight(63)).toBeCloseTo(63 * 0.883, 6);
  });
  it('drops for a crank longer than suggested, rises for a shorter one', () => {
    const ref = suggestCrankLength(84).suggestedMm;
    expect(saddleHeight(84, ref + 10)).toBeCloseTo(84 * 0.883 - 1.0, 6);
    expect(saddleHeight(84, ref - 10)).toBeCloseTo(84 * 0.883 + 1.0, 6);
  });
});

describe('inverse helpers', () => {
  it('inseamFromFrame inverts the size multiplier', () => {
    const f = frameSizeFromInseam(84, ROAD);
    expect(inseamFromFrame(f.frameCm, ROAD)).toBeCloseTo(84, 9);
  });

  it('inseamFromStack inverts the stack model', () => {
    const t = fitTargets({ heightCm: 178, inseamCm: 82, armCm: 59, category: ROAD });
    expect(inseamFromStack(t.stackMm, ROAD)).toBeCloseTo(82, 6);
  });

  it('heightFromReach inverts reach for both an estimated and a known arm', () => {
    // Estimated arm: reproduce the height whose reach we started from.
    const H = 178;
    const inseam = inseamFromHeight(H);
    const arm = armFromHeightInseam(H, inseam);
    const t = fitTargets({ heightCm: H, inseamCm: inseam, armCm: arm, category: ROAD });
    expect(heightFromReach(t.reachMm, inseam, ROAD)).toBeCloseTo(H, 4);
    // Known (measured) arm held fixed.
    const t2 = fitTargets({ heightCm: H, inseamCm: inseam, armCm: 62, category: ROAD });
    expect(heightFromReach(t2.reachMm, inseam, ROAD, 62)).toBeCloseTo(H, 4);
  });
});

describe('resolveFit (unified two-way solve)', () => {
  it('seeds a full rider + frame from nothing', () => {
    const r = resolveFit({}, ROAD);
    expect(r.heightCm).toBeCloseTo(SEED_HEIGHT_CM, 6);
    expect(r.inseamCm).toBeGreaterThan(70);
    expect(r.frameCm).toBeGreaterThan(45);
    expect(r.targets.reachMm).toBeGreaterThan(300);
  });

  it('a body height fills inseam, arm, frame and reach/stack', () => {
    const tall = resolveFit({ heightCm: 190 }, ROAD);
    const short = resolveFit({ heightCm: 160 }, ROAD);
    expect(tall.inseamCm).toBeGreaterThan(short.inseamCm);
    expect(tall.frameCm).toBeGreaterThan(short.frameCm);
    expect(tall.targets.reachMm).toBeGreaterThan(short.targets.reachMm);
    expect(tall.targets.stackMm).toBeGreaterThan(short.targets.stackMm);
  });

  it('a typed frame size reproduces on the way back and proposes a height', () => {
    const r = resolveFit({ frameCm: 50 }, ROAD);
    expect(r.frameCm).toBeCloseTo(50, 6); // round-trips
    expect(r.inseamCm).toBeCloseTo(inseamFromFrame(50, ROAD), 6);
    // Height is proposed from the frame, not the seed.
    expect(r.heightCm).not.toBeCloseTo(SEED_HEIGHT_CM, 1);
    expect(r.heightCm).toBeCloseTo(inseamFromFrame(50, ROAD) / 0.47, 4);
  });

  it('a typed reach & stack reproduce, and propose a matching rider', () => {
    const r = resolveFit({ reachMm: 400, stackMm: 600 }, ROAD);
    expect(r.targets.reachMm).toBeCloseTo(400, 3);
    expect(r.targets.stackMm).toBeCloseTo(600, 3);
    expect(r.inseamCm).toBeGreaterThan(60);
    expect(r.heightCm).toBeGreaterThan(140);
  });

  it('honours a measured inseam independent of height', () => {
    const r = resolveFit({ heightCm: 178, inseamCm: 90 }, ROAD);
    expect(r.heightCm).toBeCloseTo(178, 6); // height stays
    expect(r.inseamCm).toBeCloseTo(90, 6); // measured inseam kept
    expect(r.frameCm).toBeCloseTo(frameSizeFromInseam(90, ROAD).frameCm, 6);
  });

  it('derives the inseam from a body height even when a frame is pinned too', () => {
    // Height fixes the rider's proportions; the frame drives only its own parts.
    const r = resolveFit({ heightCm: 178, frameCm: 50 }, ROAD, 0.47);
    expect(r.inseamCm).toBeCloseTo(178 * 0.47, 6); // from height, not the frame
    expect(r.frameCm).toBeCloseTo(50, 6); // frame kept as typed
    expect(r.wheel.label).toBe(wheelForFrame(ROAD, 50).label); // wheel follows the frame
  });

  it('still works back from a frame when no height is given', () => {
    const r = resolveFit({ frameCm: 50 }, ROAD, 0.47);
    expect(r.inseamCm).toBeCloseTo(50 / ROAD.sizeMult, 6);
  });

  it('resolves the saddle at the plain LeMond height (suggested crank)', () => {
    // resolveFit uses the suggested crank, so no spurious crank adjustment.
    expect(resolveFit({ inseamCm: 84 }, ROAD).saddleHeightCm).toBeCloseTo(84 * 0.883, 6);
  });

  it('keeps a pinned frame independent of a measured inseam', () => {
    // Frame and inseam disagree (frame is bigger than the inseam recommends):
    // both are kept — inseam drives the body, the frame drives wheel/cockpit.
    const r = resolveFit({ inseamCm: 78, frameCm: 60 }, ROAD);
    expect(r.inseamCm).toBeCloseTo(78, 6); // body from the measured inseam
    expect(r.frameCm).toBeCloseTo(60, 6); // frame kept as typed
    expect(r.wheel.label).toBe(wheelForFrame(ROAD, 60).label);
    expect(r.cockpit.stemLenMm).toBe(cockpitForFrame(ROAD, 60).stemLenMm);
  });

  it('leg proportion proposes a different height from the same frame', () => {
    const avg = resolveFit({ frameCm: 56 }, ROAD, 0.47);
    const leggy = resolveFit({ frameCm: 56 }, ROAD, 0.49);
    expect(avg.inseamCm).toBeCloseTo(leggy.inseamCm, 6); // inseam unchanged
    expect(leggy.heightCm).toBeLessThan(avg.heightCm); // longer legs → shorter rider
  });
});
