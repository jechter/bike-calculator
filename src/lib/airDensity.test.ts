import { describe, it, expect } from "vitest";
import { airDensity, DEFAULT_AIR_PARAMS } from "./airDensity";

describe("airDensity", () => {
  it("matches the standard references at sea level", () => {
    expect(airDensity(15, 0)).toBeCloseTo(1.225, 3); // ISA sea level
    expect(airDensity(25, 0)).toBeCloseTo(1.184, 3); // warmer air is thinner
    expect(airDensity(DEFAULT_AIR_PARAMS.tempC, DEFAULT_AIR_PARAMS.altitudeM)).toBeCloseTo(1.225, 3);
  });

  it("falls with altitude and with temperature", () => {
    expect(airDensity(15, 2000)).toBeLessThan(airDensity(15, 0));
    expect(airDensity(35, 0)).toBeLessThan(airDensity(5, 0));
  });

  it("clamps altitude and tolerates non-finite inputs", () => {
    // Out-of-range altitude is clamped, so it stays finite and positive.
    expect(airDensity(15, 99999)).toBeGreaterThan(0);
    expect(airDensity(NaN, NaN)).toBeCloseTo(1.225, 3);
  });
});
