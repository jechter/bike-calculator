// Tubeless sealant volume recommendation. There is no universal standard; brands
// (Stan's, Orange Seal, …) publish per-width / per-wheel-size tables. This is a
// transparent estimate: the sealant needed to coat and seal the casing scales
// with its internal surface area, which is ≈ tire cross-section × wheel
// circumference — i.e. with tire width × wheel circumference. Returns a suggested
// amount and a sensible range, in ml per tire. See docs/calculators/tire.md.

export interface SealantResult {
  ml: number; // suggested amount, rounded
  lowMl: number; // low end of the range
  highMl: number; // high end of the range
}

// Coefficient (ml per metre of wheel circumference · mm of tire width),
// calibrated so common setups land near published brand guidance:
//   700×28C road  ≈ 45 ml
//   700×40 gravel ≈ 65 ml
//   29×2.3 MTB    ≈ 105 ml
const SEALANT_K = 0.75;

const roundTo5 = (ml: number) => Math.round(ml / 5) * 5;

export function recommendSealantMl(
  tireWidthMm: number,
  wheelCircumferenceMm: number,
): SealantResult {
  const circM = wheelCircumferenceMm / 1000;
  const raw = SEALANT_K * circM * tireWidthMm;
  return {
    ml: roundTo5(raw),
    lowMl: roundTo5(raw * 0.85),
    highMl: roundTo5(raw * 1.15),
  };
}
