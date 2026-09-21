import { describe, it, expect } from "vitest";
import { recommendSealantMl } from "./sealant";

describe("recommendSealantMl", () => {
  it("gives sane road numbers", () => {
    // 700×28C ≈ 2100 mm rolling circumference
    const r = recommendSealantMl(28, 2100);
    expect(r.ml).toBeGreaterThanOrEqual(30);
    expect(r.ml).toBeLessThanOrEqual(60);
    expect(r.lowMl).toBeLessThan(r.ml);
    expect(r.highMl).toBeGreaterThan(r.ml);
  });

  it("recommends more for wider tires and larger wheels", () => {
    const road = recommendSealantMl(28, 2100);
    const mtb = recommendSealantMl(58, 2300); // 29×2.3
    expect(mtb.ml).toBeGreaterThan(road.ml);
    expect(mtb.ml).toBeGreaterThanOrEqual(90);
  });

  it("rounds to a workshop-friendly 5 ml", () => {
    const r = recommendSealantMl(40, 2170); // 700×40 gravel
    expect(r.ml % 5).toBe(0);
  });
});
