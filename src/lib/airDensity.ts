// Air density ρ (kg/m³) from temperature and altitude, for the cycling-power page.
//
// Pressure falls with altitude per the International Standard Atmosphere; density
// then follows the ideal-gas law at the rider's actual temperature:
//
//   P(h) = P0 · (1 − L·h / T0) ^ (g·M / (R·L))   [standard-atmosphere pressure]
//   ρ    = P / (R_specific · T)                    [ideal gas, T in Kelvin]
//
// Anchored to the usual references: sea level & 15 °C → 1.225, sea level & 25 °C
// → 1.184. Humidity lowers density a little and is ignored here.

export interface AirParams {
  tempC: number;
  altitudeM: number;
}

export const DEFAULT_AIR_PARAMS: AirParams = { tempC: 15, altitudeM: 0 };

// Sensible input bounds (also what the panel's fields allow).
export const TEMP_MIN_C = -30;
export const TEMP_MAX_C = 50;
export const ALT_MIN_M = 0;
export const ALT_MAX_M = 5000;

const P0 = 101325; // sea-level standard pressure, Pa
const R_SPECIFIC = 287.05; // specific gas constant for dry air, J/(kg·K)

/** Air density ρ (kg/m³) for a temperature (°C) and altitude (m). */
export function airDensity(tempC: number, altitudeM: number): number {
  const t = Number.isFinite(tempC) ? tempC : DEFAULT_AIR_PARAMS.tempC;
  const h = Number.isFinite(altitudeM)
    ? Math.max(ALT_MIN_M, Math.min(ALT_MAX_M, altitudeM))
    : 0;
  const pressure = P0 * Math.pow(1 - 2.25577e-5 * h, 5.25588);
  const rho = pressure / (R_SPECIFIC * (t + 273.15));
  return Math.round(rho * 1000) / 1000;
}
