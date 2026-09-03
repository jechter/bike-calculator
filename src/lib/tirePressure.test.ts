import { describe, it, expect } from "vitest";
import { recommendTirePressure } from "./tirePressure";

describe("recommendTirePressure", () => {
  it("gives sane road numbers (not hundreds of psi)", () => {
    const r = recommendTirePressure({
      systemWeightKg: 82,
      frontLoadFraction: 0.45,
      tireWidthMm: 25,
      tubeType: "tube",
      surface: "smooth",
    });
    // rear carries more load -> higher pressure than front
    expect(r.rearPsi).toBeGreaterThan(r.frontPsi);
    // plausible clincher road range
    expect(r.rearPsi).toBeGreaterThan(60);
    expect(r.rearPsi).toBeLessThan(110);
  });

  it("drops pressure for wider tires and rougher surfaces", () => {
    const road = recommendTirePressure({
      systemWeightKg: 82,
      frontLoadFraction: 0.45,
      tireWidthMm: 28,
      tubeType: "tube",
      surface: "smooth",
    });
    const gravel = recommendTirePressure({
      systemWeightKg: 82,
      frontLoadFraction: 0.45,
      tireWidthMm: 45,
      tubeType: "tubeless",
      surface: "gravel",
    });
    expect(gravel.rearBar).toBeLessThan(road.rearBar);
    expect(gravel.rearPsi).toBeLessThan(60);
  });
});
