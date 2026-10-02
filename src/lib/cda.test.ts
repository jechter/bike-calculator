import { describe, it, expect } from "vitest";
import {
  estimateCda,
  DEFAULT_CDA_PARAMS,
  REF_MASS_KG,
  CDA_MIN,
  CDA_MAX,
  defaultPositionFor,
  isFaired,
  bikeByValue,
  type CdaParams,
} from "./cda";

describe("estimateCda", () => {
  it("reproduces the hoods preset for the reference rider", () => {
    // reference rider (175 cm, 72 kg), road bike, hoods, club kit, mid wheels → 0.36
    const cda = estimateCda(DEFAULT_CDA_PARAMS, REF_MASS_KG);
    expect(cda).toBeCloseTo(0.36, 2);
  });

  it("scales up with a bigger rider and down with a smaller one", () => {
    const ref = estimateCda(DEFAULT_CDA_PARAMS, REF_MASS_KG);
    const big = estimateCda({ ...DEFAULT_CDA_PARAMS, heightCm: 195 }, 95);
    const small = estimateCda({ ...DEFAULT_CDA_PARAMS, heightCm: 160 }, 55);
    expect(big).toBeGreaterThan(ref);
    expect(small).toBeLessThan(ref);
  });

  it("a lower position lowers CdA", () => {
    const hoods = estimateCda({ ...DEFAULT_CDA_PARAMS, position: "hoods" }, REF_MASS_KG);
    const low = estimateCda({ ...DEFAULT_CDA_PARAMS, position: "dropsLow" }, REF_MASS_KG);
    expect(low).toBeLessThan(hoods);
  });

  it("gives every drop-bar bike the same positions, differing only by factor", () => {
    const dropBars = ["road", "endurance", "gravel"] as const;
    const positionSets = dropBars.map((b) => bikeByValue(b).positions.join(","));
    expect(new Set(positionSets).size).toBe(1); // identical position lists
    // Same position, heavier-duty bike → higher CdA (gravel bulk > road).
    const road = estimateCda({ ...DEFAULT_CDA_PARAMS, bike: "road", position: "hoods" }, REF_MASS_KG);
    const gravel = estimateCda({ ...DEFAULT_CDA_PARAMS, bike: "gravel", position: "hoods" }, REF_MASS_KG);
    expect(gravel).toBeGreaterThan(road);
  });

  it("flat-bar bikes offer posture positions, not drop-bar ones", () => {
    for (const b of ["city", "mtb"] as const) {
      const positions = bikeByValue(b).positions;
      expect(positions).toContain("upright");
      expect(positions).not.toContain("hoods");
    }
  });

  it("tighter clothing and deeper wheels reduce CdA", () => {
    const base = estimateCda(DEFAULT_CDA_PARAMS, REF_MASS_KG);
    const kit = estimateCda({ ...DEFAULT_CDA_PARAMS, clothing: "skinsuitAero" }, REF_MASS_KG);
    const wheels = estimateCda({ ...DEFAULT_CDA_PARAMS, wheels: "disc" }, REF_MASS_KG);
    expect(kit).toBeLessThan(base);
    expect(wheels).toBeLessThan(base);
  });

  it("gives recumbents and velomobiles dramatically lower CdA", () => {
    const road = estimateCda(DEFAULT_CDA_PARAMS, REF_MASS_KG);
    const recumbent = estimateCda(
      { ...DEFAULT_CDA_PARAMS, bike: "recumbent", position: "lowracer" },
      REF_MASS_KG,
    );
    const velomobile = estimateCda(
      { ...DEFAULT_CDA_PARAMS, bike: "velomobile", position: "shell" },
      REF_MASS_KG,
    );
    expect(recumbent).toBeLessThan(road);
    expect(velomobile).toBeLessThan(recumbent);
    expect(velomobile).toBeLessThan(0.08); // shell CdA is an order below a road bike
  });

  it("makes a velomobile's CdA independent of wheels, clothing and rider size", () => {
    const velo = (patch: Partial<CdaParams>, mass = REF_MASS_KG) =>
      estimateCda({ ...DEFAULT_CDA_PARAMS, bike: "velomobile", position: "shell", ...patch }, mass);
    // Wheels + clothing don't matter inside the fairing.
    expect(velo({ wheels: "box", clothing: "loose" })).toBe(
      velo({ wheels: "disc", clothing: "skinsuitAero" }),
    );
    // Rider height and weight don't change the shell's drag.
    expect(velo({ heightCm: 160 }, 55)).toBe(velo({ heightCm: 200 }, 95));
    expect(isFaired("velomobile")).toBe(true);
    expect(isFaired("road")).toBe(false);
  });

  it("guards a position that doesn't belong to the bike", () => {
    // 'hoods' isn't a velomobile position; it should fall back to the shell.
    const bad = estimateCda({ ...DEFAULT_CDA_PARAMS, bike: "velomobile", position: "hoods" }, REF_MASS_KG);
    const good = estimateCda(
      { ...DEFAULT_CDA_PARAMS, bike: "velomobile", position: defaultPositionFor("velomobile") },
      REF_MASS_KG,
    );
    expect(bad).toBe(good);
  });

  it("clamps to the field's range for extreme inputs", () => {
    const huge: CdaParams = {
      bike: "mtb",
      position: "upright",
      heightCm: 210,
      wheels: "box",
      clothing: "loose",
    };
    expect(estimateCda(huge, 150)).toBeLessThanOrEqual(CDA_MAX);
    expect(estimateCda(huge, 150)).toBeGreaterThanOrEqual(CDA_MIN);

    const tiny: CdaParams = {
      bike: "velomobile",
      position: "shell",
      heightCm: 120,
      wheels: "disc",
      clothing: "skinsuitAero",
    };
    expect(estimateCda(tiny, 40)).toBeGreaterThanOrEqual(CDA_MIN);
  });

  it("falls back to sane values for non-finite rider size", () => {
    const cda = estimateCda({ ...DEFAULT_CDA_PARAMS, heightCm: NaN }, NaN);
    expect(cda).toBeCloseTo(0.36, 2);
  });
});
