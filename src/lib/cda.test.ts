import { describe, it, expect } from "vitest";
import {
  estimateCda,
  DEFAULT_CDA_PARAMS,
  REF_MASS_KG,
  CDA_MIN,
  CDA_MAX,
  defaultPositionFor,
  isFaired,
  draftFactor,
  rotatingDraftFactor,
  groupDraftFactor,
  isRotating,
  SIDE_BY_SIDE_PENALTY,
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

  it("offers clip-on aero bars on drop-bar bikes, lower than the drops", () => {
    for (const b of ["road", "endurance", "gravel"] as const) {
      expect(bikeByValue(b).positions).toContain("clipOnAero");
    }
    // Not applicable to flat-bar / TT / recumbent / velomobile.
    for (const b of ["city", "mtb", "tt", "recumbent", "velomobile"] as const) {
      expect(bikeByValue(b).positions).not.toContain("clipOnAero");
    }
    // Clip-ons on a gravel bike beat the drops but trail a dedicated TT tuck.
    const gravelDrops = estimateCda({ ...DEFAULT_CDA_PARAMS, bike: "gravel", position: "drops" }, REF_MASS_KG);
    const gravelAero = estimateCda({ ...DEFAULT_CDA_PARAMS, bike: "gravel", position: "clipOnAero" }, REF_MASS_KG);
    const ttTuck = estimateCda({ ...DEFAULT_CDA_PARAMS, bike: "tt", position: "aeroTuck" }, REF_MASS_KG);
    expect(gravelAero).toBeLessThan(gravelDrops);
    expect(gravelAero).toBeGreaterThan(ttTuck);
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
      formation: "bunch",
      draftRiders: 0,
      groupSize: 1,
    };
    expect(estimateCda(huge, 150)).toBeLessThanOrEqual(CDA_MAX);
    expect(estimateCda(huge, 150)).toBeGreaterThanOrEqual(CDA_MIN);

    const tiny: CdaParams = {
      bike: "velomobile",
      position: "shell",
      heightCm: 120,
      wheels: "disc",
      clothing: "skinsuitAero",
      formation: "bunch",
      draftRiders: 0,
      groupSize: 1,
    };
    expect(estimateCda(tiny, 40)).toBeGreaterThanOrEqual(CDA_MIN);
  });

  it("falls back to sane values for non-finite rider size", () => {
    const cda = estimateCda({ ...DEFAULT_CDA_PARAMS, heightCm: NaN }, NaN);
    expect(cda).toBeCloseTo(0.36, 2);
  });
});

describe("draftFactor", () => {
  it("is 1 when riding alone (or for nonsense input)", () => {
    expect(draftFactor(0, "bunch")).toBe(1);
    expect(draftFactor(0, "line")).toBe(1);
    expect(draftFactor(NaN, "bunch")).toBe(1);
    expect(draftFactor(-3, "line")).toBe(1);
  });

  it("gives ~30 % saving behind a single wheel in either formation", () => {
    expect(draftFactor(1, "line")).toBeCloseTo(0.7, 2);
    expect(draftFactor(1, "bunch")).toBeCloseTo(0.7, 2);
  });

  it("levels off around 55 % in a paceline but keeps falling in a bunch", () => {
    expect(draftFactor(3, "line")).toBeGreaterThan(0.55);
    expect(draftFactor(3, "line")).toBeLessThan(0.58);
    expect(draftFactor(50, "line")).toBeCloseTo(0.55, 3);
    expect(draftFactor(5, "bunch")).toBeLessThan(draftFactor(5, "line"));
    expect(draftFactor(100, "bunch")).toBeGreaterThan(0.1);
    expect(draftFactor(100, "bunch")).toBeLessThan(0.13);
  });

  it("decreases monotonically with more riders ahead", () => {
    for (const f of ["line", "double", "bunch"] as const) {
      for (let n = 0; n < 20; n++) {
        expect(draftFactor(n + 1, f)).toBeLessThan(draftFactor(n, f));
      }
    }
  });

  it("scales the estimated CdA", () => {
    const solo = estimateCda(DEFAULT_CDA_PARAMS, REF_MASS_KG);
    const drafted = estimateCda({ ...DEFAULT_CDA_PARAMS, draftRiders: 1 }, REF_MASS_KG);
    expect(drafted).toBeCloseTo(solo * 0.7, 2);
    // Deep in a bunch the estimate can't fall below the field's floor.
    const velo = estimateCda(
      { ...DEFAULT_CDA_PARAMS, bike: "velomobile", position: "shell", draftRiders: 100 },
      REF_MASS_KG,
    );
    expect(velo).toBe(CDA_MIN);
  });

  it("puts double file between single file and a bunch", () => {
    // Second row of a double file ≈ one wheel ahead plus a little side shelter.
    expect(draftFactor(2, "double")).toBeCloseTo(0.66, 2);
    for (const n of [4, 8, 20]) {
      expect(draftFactor(n, "double")).toBeLessThan(draftFactor(n, "line"));
      expect(draftFactor(n, "double")).toBeGreaterThan(draftFactor(n, "bunch"));
    }
    expect(draftFactor(100, "double")).toBeCloseTo(0.35, 3);
  });
});

describe("rotatingDraftFactor", () => {
  it("is 1 for a group of one", () => {
    expect(rotatingDraftFactor(1)).toBe(1);
    expect(rotatingDraftFactor(0)).toBe(1);
  });

  it("averages the per-position factors over the rotation", () => {
    // Two lines of 4: a staggered front pair (penalty) and a second row.
    const dbl4 = (2 * SIDE_BY_SIDE_PENALTY + 2 * draftFactor(2, "double")) / 4;
    expect(rotatingDraftFactor(4)).toBeCloseTo(dbl4, 10);
    // An odd group: the lone last rider sits in the third row.
    const dbl5 = (2 * SIDE_BY_SIDE_PENALTY + 2 * draftFactor(2, "double") + draftFactor(4, "double")) / 5;
    expect(rotatingDraftFactor(5)).toBeCloseTo(dbl5, 10);
  });

  it("saves less than sitting in, and more with a bigger group", () => {
    expect(rotatingDraftFactor(8)).toBeGreaterThan(draftFactor(6, "double"));
    expect(rotatingDraftFactor(16)).toBeLessThan(rotatingDraftFactor(8));
  });

  it("drives estimateCda for the rotating formation, sized by the group", () => {
    const rotating = { ...DEFAULT_CDA_PARAMS, formation: "doubleRotating" as const, groupSize: 8 };
    expect(isRotating("doubleRotating")).toBe(true);
    expect(isRotating("double")).toBe(false);
    // Riders-ahead is ignored when rotating; group size is ignored otherwise.
    expect(groupDraftFactor({ ...rotating, draftRiders: 20 })).toBe(rotatingDraftFactor(8));
    expect(groupDraftFactor({ ...rotating, formation: "double", draftRiders: 0 })).toBe(1);
    const solo = estimateCda(DEFAULT_CDA_PARAMS, REF_MASS_KG);
    expect(estimateCda(rotating, REF_MASS_KG)).toBeCloseTo(solo * rotatingDraftFactor(8), 2);
  });
});
