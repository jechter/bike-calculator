import { describe, it, expect } from 'vitest';
import {
  checkCapacity,
  searchDerailleurs,
  derailleurByKey,
  derailleurSpeeds,
  speedMatches,
  speedCompatibility,
  expectedCassetteSpacing,
  fitCassette,
  pullRatioFor,
  defaultShifterFor,
  shifterCompatibility,
  shifterLabel,
  familiesCompatible,
  incompatibleReason,
  FRICTION_FAMILY,
  DERAILLEURS,
  type Shifter,
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
  it('derives families for Shimano/SRAM, leaves other third-party unknown', () => {
    expect(derailleurByKey('shimano-rd-r7000-ss-11s')?.actuation).toBe(
      'Shimano road 1.4 (11-speed & Tiagra 4700)',
    );
    const eagle = DERAILLEURS.find(
      (d) => d.brand === 'SRAM' && d.discipline === 'MTB' && d.speeds === 12 && !d.electronic,
    );
    expect(eagle?.actuation).toBe('SRAM Eagle (X-Actuation)');
    // Proprietary / version-specific third-party stays unknown (TRP and Ingrid
    // use their own or shifter-specific actuation — not derivable).
    expect(DERAILLEURS.find((d) => d.brand === 'TRP')?.actuation).toBeUndefined();
    expect(DERAILLEURS.find((d) => d.brand === 'Ingrid')?.actuation).toBeUndefined();
  });

  it('maps Shimano/SRAM-cloning third-party brands, leaves proprietary ones unknown', () => {
    const one = (brand: string, pred: (d: (typeof DERAILLEURS)[number]) => boolean) =>
      DERAILLEURS.find((d) => d.brand === brand && pred(d))!;
    // L-TWOO: road/gravel copy Shimano road; 12-speed MTB is SRAM Eagle; the
    // 10/11-speed MTB (conflicting evidence) and wireless eRX stay unknown.
    expect(one('L-TWOO', (d) => d.model === 'RD-R5010-M').actuation).toBe('Shimano road 1.7 (classic)');
    expect(one('L-TWOO', (d) => d.model === 'RD-R5011-M').actuation).toBe('Shimano road 1.4 (11-speed & Tiagra 4700)');
    expect(one('L-TWOO', (d) => d.model === 'RD-A12-AT-G').actuation).toBe('SRAM Eagle (X-Actuation)');
    expect(one('L-TWOO', (d) => d.model === 'RD-V5010-L').actuation).toBeUndefined(); // A7 10sp
    expect(one('L-TWOO', (d) => d.electronic === 'eRX').actuation).toBeUndefined();
    // Sunrace: Shimano by default; U-series is CUES/LinkGlide.
    expect(one('Sunrace', (d) => d.series === 'R' && d.speeds === 9).actuation).toBe('Shimano road 1.7 (classic)');
    expect(one('Sunrace', (d) => d.model === 'RDUX600').actuation).toBe('Shimano CUES / LinkGlide');
    expect(one('Sunrace', (d) => d.model === 'RDMS10').actuation).toBe('Shimano MTB 10-speed (Dynasys)');
    expect(one('Sunrace', (d) => d.model === 'RDMZ600').actuation).toBe('Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)');
    // S-Ride: 1.7/1.2 Shimano; SRAM-labelled 1.1 ≤9sp is SRAM 1:1; 1.1 12sp unknown.
    expect(one('S-Ride', (d) => d.model === 'RD-M200').actuation).toBe('Shimano MTB 6/7/8/9-speed');
    expect(one('S-Ride', (d) => d.model === 'RD-M310').actuation).toBe('SRAM 1:1 (older MTB)');
    expect(one('S-Ride', (d) => d.model === 'RD-M600C').actuation).toBeUndefined();
    // Box: only the One/Two 11-speed cross-indexes with Shimano; Prime 9 is its own.
    expect(one('Box', (d) => d.model === '11-Speed').actuation).toBe('Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)');
    expect(one('Box', (d) => d.model === 'Prime 9').actuation).toBeUndefined();
    // Closed electronic / own-shifter systems stay unknown.
    expect(one('WheelTop', () => true).actuation).toBeUndefined();
    expect(one('Tektro', () => true).actuation).toBeUndefined();
  });

  it('maps Shimano-compatible Microshift groups to their Shimano family, keeps Advent/Acolyte proprietary', () => {
    const ms = (model: string) => DERAILLEURS.find((d) => d.brand === 'Microshift' && d.model === model)!;
    // Road: R-series/old Centos/Arsis copy classic Shimano 1.7; newer Centos/Arsis
    // 11 (and the Tiagra-4700-compatible Centos 10 R55S) copy the 1.4 pull.
    expect(ms('RD-R42').actuation).toBe('Shimano road 1.7 (classic)'); // R9 9-speed
    expect(ms('RD-R47').actuation).toBe('Shimano road 1.7 (classic)'); // R10 10-speed
    expect(ms('RD-R55S').actuation).toBe('Shimano road 1.4 (11-speed & Tiagra 4700)'); // Centos 10
    expect(ms('RD-R58S').actuation).toBe('Shimano road 1.4 (11-speed & Tiagra 4700)'); // Centos 11
    // MTB: Mezzo/Marvo = classic 6-9 pull, XLE 10 = Dynasys, XLE 11/XCD = 11/12sp.
    expect(ms('RD-M36L').actuation).toBe('Shimano MTB 6/7/8/9-speed'); // Mezzo 9sp
    expect(ms('RD-M61L').actuation).toBe('Shimano MTB 10-speed (Dynasys)'); // XLE 10
    expect(ms('RD-M665M').actuation).toBe('Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)'); // XLE 11
    expect(ms('RD-M865M').actuation).toBe('Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline)'); // XCD
    // Proprietary Microshift pull — NOT Shimano-compatible, stays unknown.
    expect(ms('RD-M6195L').actuation).toBeUndefined(); // Advent 9-speed
    expect(ms('RD-M6205AM').actuation).toBeUndefined(); // Advent X 10-speed
    expect(ms('RD-M7015M').actuation).toBeUndefined(); // Advent MX 11-speed
    expect(ms('RD-G7900M').actuation).toBeUndefined(); // Sword gravel
    expect(ms('RD-M5180M').actuation).toBeUndefined(); // Acolyte 8-speed
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

describe('expectedCassetteSpacing', () => {
  it('maps Campagnolo families to Campagnolo pitch', () => {
    expect(expectedCassetteSpacing('Campagnolo 11-speed')).toBe('campagnolo');
    expect(expectedCassetteSpacing('Campagnolo WRL (electronic)')).toBe('campagnolo');
  });
  it('maps LinkGlide to its own pitch, not the shared Shimano one', () => {
    expect(expectedCassetteSpacing('Shimano CUES / LinkGlide')).toBe('linkglide');
  });
  it('maps every other Shimano and SRAM family to the shared HG pitch', () => {
    expect(expectedCassetteSpacing('Shimano road 1.4 (11-speed & Tiagra 4700)')).toBe('shimano-sram');
    expect(expectedCassetteSpacing('SRAM Eagle (X-Actuation)')).toBe('shimano-sram');
  });
  it('is null for friction/unknown/third-party (pitch cannot be judged)', () => {
    expect(expectedCassetteSpacing(undefined)).toBeNull();
    expect(expectedCassetteSpacing('Friction')).toBeNull();
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

  it('rejects a Campagnolo cassette on a Shimano/SRAM drivetrain (same cog count)', () => {
    // The reported bug: an 11-speed Shimano RD + an 11-speed Campagnolo cassette
    // passes every count check but the cog pitch differs, so it can't index.
    const cogs = [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30];
    const fit = fitCassette(r7000(), [50, 34], cogs, null, 'campagnolo');
    expect(fit.spacing).toBe('over');
    expect(fit.expectedSpacing).toBe('shimano-sram');
    expect(fit.level).toBe('incompatible');
    expect(incompatibleReason(fit)).toBe('spacing');
  });

  it('accepts a matching Shimano/SRAM cassette on a Shimano drivetrain', () => {
    const cogs = [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30];
    const fit = fitCassette(r7000(), [50, 34], cogs, null, 'shimano-sram');
    expect(fit.spacing).toBe('ok');
    expect(fit.level).toBe('ok');
  });

  it('leaves spacing unjudged when the cassette standard is unknown (custom cogs)', () => {
    const cogs = [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30];
    const fit = fitCassette(r7000(), [50, 34], cogs); // no spacing passed
    expect(fit.spacing).toBe('unknown');
    expect(fit.level).toBe('ok');
  });

  it('leaves a proprietary (closed-system) cassette unjudged on spacing', () => {
    const cogs = [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30];
    const fit = fitCassette(r7000(), [50, 34], cogs, null, 'proprietary');
    expect(fit.spacing).toBe('unknown');
    expect(fit.level).toBe('ok');
  });

  it('a friction shifter indexes nothing, so any cog pitch is fine', () => {
    const cogs = [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30];
    const friction: Shifter = { family: FRICTION_FAMILY, speeds: 0 };
    const fit = fitCassette(r7000(), [50, 34], cogs, friction, 'campagnolo');
    expect(fit.spacing).toBe('unknown');
    // Friction drives it by feel — the pitch mismatch is not a blocker.
    expect(fit.level).toBe('ok');
  });

  it('uses the shifter family (not the derailleur) to set the expected pitch', () => {
    // A Campagnolo shifter + Campagnolo cassette is self-consistent on pitch even
    // if paired with a mixed derailleur — the wrong-family indexing check is what
    // catches that pairing, not the spacing dimension.
    const campagShifter: Shifter = { family: 'Campagnolo 11-speed', speeds: 11 };
    const cogs = [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30];
    const fit = fitCassette(r7000(), [50, 34], cogs, campagShifter, 'campagnolo');
    expect(fit.expectedSpacing).toBe('campagnolo');
    expect(fit.spacing).toBe('ok');
  });
});

describe('defaultShifterFor', () => {
  it('seeds an indexed shifter in the derailleur family at its nominal speeds', () => {
    const r7000 = derailleurByKey('shimano-rd-r7000-ss-11s')!;
    expect(defaultShifterFor(r7000)).toEqual({ family: r7000.actuation, speeds: 11 });
  });

  it('is null when no derailleur is chosen', () => {
    expect(defaultShifterFor(undefined)).toBeNull();
  });

  it('uses an empty family for a third-party row whose actuation is unknown', () => {
    const ms = DERAILLEURS.find((d) => d.brand === 'Microshift' && !d.actuation)!;
    expect(defaultShifterFor(ms)).toEqual({ family: '', speeds: ms.speeds });
  });
});

describe('shifterCompatibility', () => {
  const r7000 = () => derailleurByKey('shimano-rd-r7000-ss-11s')!; // 11sp road, 1.4 family
  const axs = () => searchDerailleurs('sram').find((d) => d.electronic && d.speeds === 12)!;

  it('is a green match with the indexed same-family shifter at the cassette count', () => {
    const sh: Shifter = { family: r7000().actuation!, speeds: 11 };
    expect(shifterCompatibility(r7000(), sh, 11)).toEqual({ level: 'ok', status: 'match' });
  });

  it('is red when an indexed shifter counts a different number of cogs', () => {
    const sh: Shifter = { family: r7000().actuation!, speeds: 11 };
    expect(shifterCompatibility(r7000(), sh, 10)).toEqual({
      level: 'incompatible',
      status: 'wrong-count',
    });
  });

  it('is red when the indexed shifter is a different actuation family', () => {
    const sh: Shifter = { family: 'SRAM Exact Actuation', speeds: 11 };
    expect(shifterCompatibility(r7000(), sh, 11)).toEqual({
      level: 'incompatible',
      status: 'wrong-family',
    });
  });

  it('is green with a friction shifter (any family value) on a mechanical derailleur', () => {
    const sh: Shifter = { family: FRICTION_FAMILY, speeds: 0 };
    expect(shifterCompatibility(r7000(), sh, 8)).toEqual({ level: 'ok', status: 'friction' });
  });

  it('rejects a friction shifter on an electronic derailleur', () => {
    const sh: Shifter = { family: FRICTION_FAMILY, speeds: 0 };
    expect(shifterCompatibility(axs(), sh, 12)).toEqual({
      level: 'incompatible',
      status: 'friction-electronic',
    });
  });

  it('flags an electronic count mismatch distinctly (no friction fallback)', () => {
    const sh: Shifter = { family: axs().actuation!, speeds: 12 };
    expect(shifterCompatibility(axs(), sh, 10)).toEqual({
      level: 'incompatible',
      status: 'electronic-count',
    });
  });

  it('is caution when the count lines up but the derailleur family is unknown', () => {
    const ms = DERAILLEURS.find((d) => d.brand === 'Microshift' && !d.actuation)!;
    const sh: Shifter = { family: 'Shimano road 1.7 (classic)', speeds: ms.speeds };
    expect(shifterCompatibility(ms, sh, ms.speeds)).toEqual({
      level: 'caution',
      status: 'unknown-family',
    });
  });

  it('skips the check (neutral) when the shifter family is unspecified', () => {
    const sh: Shifter = { family: '', speeds: 0 };
    expect(shifterCompatibility(r7000(), sh, 8)).toEqual({ level: 'ok', status: 'unspecified' });
  });

  it('accepts a same-pull-ratio family across the road/MTB 1.7 divide', () => {
    // A classic-1.7 Shimano road derailleur driven by an old MTB (6/7/8/9) shifter
    // of the same ≈1.7:1 pull -> a match, not a family mismatch.
    const classicRoad = DERAILLEURS.find(
      (d) => d.actuation === 'Shimano road 1.7 (classic)',
    )!;
    const sh: Shifter = { family: 'Shimano MTB 6/7/8/9-speed', speeds: 8 };
    expect(shifterCompatibility(classicRoad, sh, 8)).toEqual({ level: 'ok', status: 'match' });
  });

  it('labels shifters for display', () => {
    expect(shifterLabel({ family: FRICTION_FAMILY, speeds: 0 })).toBe('Friction');
    expect(shifterLabel({ family: '', speeds: 8 })).toBe('Other / unspecified');
    expect(shifterLabel({ family: 'SRAM Eagle (X-Actuation)', speeds: 12 })).toBe(
      '12-speed · SRAM Eagle (X-Actuation)',
    );
  });
});

describe('fitCassette with a shifter', () => {
  const r7000 = () => derailleurByKey('shimano-rd-r7000-ss-11s')!; // 11sp, max 30T, cap 35T

  it('turns a native-speed cassette green when the shifter matches', () => {
    const sh: Shifter = { family: r7000().actuation!, speeds: 11 };
    const cogs = [11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 30];
    const fit = fitCassette(r7000(), [50, 34], cogs, sh);
    expect(fit.shifter).toEqual({ level: 'ok', status: 'match' });
    expect(fit.level).toBe('ok');
  });

  it('turns a wrong-count cassette red even when cog and capacity fit', () => {
    // 10-speed cassette that clears the cage and capacity, but an 11-speed shifter.
    const sh: Shifter = { family: r7000().actuation!, speeds: 11 };
    const fit = fitCassette(r7000(), [50, 34], [11, 12, 13, 14, 15, 17, 19, 21, 24, 28], sh);
    expect(fit.cog).toBe('ok');
    expect(fit.capacity).toBe('ok');
    expect(fit.shifter?.status).toBe('wrong-count');
    expect(fit.level).toBe('incompatible');
  });

  it('lets a friction shifter keep any mechanical cog count fit', () => {
    const sh: Shifter = { family: FRICTION_FAMILY, speeds: 0 };
    const fit = fitCassette(r7000(), [50, 34], [11, 12, 13, 14, 15, 17, 19, 21, 24, 28], sh);
    expect(fit.shifter?.status).toBe('friction');
    expect(fit.level).toBe('ok');
  });
});

describe('familiesCompatible', () => {
  it('is reflexive and covers the road/MTB 1.7 equivalence', () => {
    expect(familiesCompatible('SRAM Eagle (X-Actuation)', 'SRAM Eagle (X-Actuation)')).toBe(true);
    expect(
      familiesCompatible('Shimano road 1.7 (classic)', 'Shimano MTB 6/7/8/9-speed'),
    ).toBe(true);
    expect(
      familiesCompatible('Shimano MTB 6/7/8/9-speed', 'Shimano road 1.7 (classic)'),
    ).toBe(true);
  });

  it('does not equate merely similar-looking families', () => {
    // Both read ≈1.4 but are not interchangeable.
    expect(
      familiesCompatible('Shimano CUES / LinkGlide', 'Shimano road 1.4 (11-speed & Tiagra 4700)'),
    ).toBe(false);
  });
});

describe('incompatibleReason', () => {
  const r7000 = () => derailleurByKey('shimano-rd-r7000-ss-11s')!; // 11sp, max 30T

  it('is "range" when the cog is physically over the max sprocket', () => {
    const fit = fitCassette(r7000(), [42], [11, 40]); // 40 >> 30T max
    expect(fit.level).toBe('incompatible');
    expect(incompatibleReason(fit)).toBe('range');
  });

  it('is "indexing" when only the shifter count is wrong', () => {
    const sh: Shifter = { family: r7000().actuation!, speeds: 11 };
    const fit = fitCassette(r7000(), [50, 34], [11, 12, 13, 14, 15, 17, 19, 21, 24, 28], sh);
    expect(fit.level).toBe('incompatible');
    expect(incompatibleReason(fit)).toBe('indexing');
  });

  it('is null for a fit that is not incompatible', () => {
    const fit = fitCassette(r7000(), [50, 34], [11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 30]);
    expect(incompatibleReason(fit)).toBeNull();
  });
});

describe('chainLengthGuide', () => {
  it('marks every SRAM Full Mount derailleur (Eagle Transmission + 13-speed XPLR)', () => {
    const guided = DERAILLEURS.filter((d) => d.chainLengthGuide);
    // 7 Eagle Transmission + the 13-speed Red XPLR = 8 Full Mount rows today.
    expect(guided.length).toBe(8);
    for (const d of guided) {
      expect(d.brand).toBe('SRAM');
      expect(d.chainLengthGuide!.name).toBe('SRAM Full Mount');
      expect(d.chainLengthGuide!.url).toBe(
        'https://axs.sram.com/guides/fullmount/chain/calculator',
      );
    }
    // All Transmission-series rows are covered…
    expect(
      DERAILLEURS.filter((d) => d.series === 'Transmission').every((d) => d.chainLengthGuide),
    ).toBe(true);
    // …and the 13-speed XPLR, but NOT the hanger-mount 12-speed XPLRs.
    const xplr12 = DERAILLEURS.find((d) => d.model === 'AXS XPLR' && d.speeds === 12);
    expect(xplr12?.chainLengthGuide).toBeUndefined();
  });

  it('leaves ordinary hanger-mount derailleurs without a guide', () => {
    expect(derailleurByKey('shimano-rd-r7000-ss-11s')!.chainLengthGuide).toBeUndefined();
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
