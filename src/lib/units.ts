// Shared unit conversions. Keep these pure and dependency-free so they can be
// reused across calculators and unit-tested directly.

export const MM_PER_INCH = 25.4;
export const KG_PER_LB = 0.45359237;
export const G = 9.80665; // standard gravity, m/s^2

export const mmToInch = (mm: number): number => mm / MM_PER_INCH;
export const inchToMm = (inch: number): number => inch * MM_PER_INCH;

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;

export const kmhToMph = (kmh: number): number => kmh * 0.621371;
export const mphToKmh = (mph: number): number => mph / 0.621371;

export const msToKmh = (ms: number): number => ms * 3.6;
export const kmhToMs = (kmh: number): number => kmh / 3.6;

export const barToPsi = (bar: number): number => bar * 14.5037738;
export const psiToBar = (psi: number): number => psi / 14.5037738;

// Torque
export const nmToInLbf = (nm: number): number => nm * 8.8507457676;
export const inLbfToNm = (inLbf: number): number => inLbf / 8.8507457676;
export const nmToFtLbf = (nm: number): number => nm * 0.7375621493;
export const ftLbfToNm = (ftLbf: number): number => ftLbf / 0.7375621493;

/** Round to a fixed number of decimal places, returning a number. */
export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
