import { describe, it, expect } from "vitest";
import { parseTireSize, formatDesignations, toFractionInch, suggestTireSizes } from "./tireSizes";

describe("parseTireSize", () => {
  it("parses the three equivalents from the example", () => {
    expect(parseTireSize("28-622")).toEqual({ iso: 622, widthMm: 28 });
    expect(parseTireSize("700x28C")).toEqual({ iso: 622, widthMm: 28 });
    expect(parseTireSize("28x1 1/8")).toEqual({ iso: 622, widthMm: 28 });
  });

  it("handles spacing, case and × / ETRTO order", () => {
    expect(parseTireSize("700 × 28c")).toEqual({ iso: 622, widthMm: 28 });
    expect(parseTireSize("622-28")).toEqual({ iso: 622, widthMm: 28 });
    expect(parseTireSize("700C x 25")).toEqual({ iso: 622, widthMm: 25 });
  });

  it("parses MTB decimal and 650B (decimal width kept precise)", () => {
    const a = parseTireSize("26x2.1")!;
    expect(a.iso).toBe(559);
    expect(a.widthMm).toBeCloseTo(53.34, 2);
    const b = parseTireSize("27.5x2.4")!;
    expect(b.iso).toBe(584);
    expect(b.widthMm).toBeCloseTo(60.96, 2);
    expect(parseTireSize("650b x 47")).toEqual({ iso: 584, widthMm: 47 });
  });

  it("round-trips a decimal input exactly (no 2.1 -> 2.09 drift)", () => {
    const p = parseTireSize("26x2.1")!;
    const map = Object.fromEntries(formatDesignations(p.iso, p.widthMm).map((x) => [x.format, x.value]));
    expect(map["Inch (decimal)"]).toBe("26 × 2.1″");
    expect(map["ETRTO / ISO"]).toBe("53-559");
  });

  it("disambiguates fractional inch by width", () => {
    expect(parseTireSize("28x1 1/2")).toEqual({ iso: 635, widthMm: 40 });
    expect(parseTireSize("28x1 3/8")).toEqual({ iso: 622, widthMm: 35 });
    expect(parseTireSize("26x1 3/8")).toEqual({ iso: 590, widthMm: 35 });
  });

  it("knows the newer 32-inch (ISO 686) standard", () => {
    expect(parseTireSize("50-686")).toEqual({ iso: 686, widthMm: 50 });
    expect(parseTireSize("686-55")).toEqual({ iso: 686, widthMm: 55 });
    const d = parseTireSize("32x2.4")!;
    expect(d.iso).toBe(686);
    expect(d.widthMm).toBeCloseTo(60.96, 2);
  });

  it("accepts a comma as the decimal separator", () => {
    expect(parseTireSize("32 x 2,40")).toEqual(parseTireSize("32x2.4"));
    expect(parseTireSize("27,5x2,1")).toEqual(parseTireSize("27.5x2.1"));
  });

  it("returns null for gibberish", () => {
    expect(parseTireSize("banana")).toBeNull();
    expect(parseTireSize("")).toBeNull();
  });
});

describe("formatDesignations", () => {
  it("re-expresses 28-622 as French and fractional (not 29er)", () => {
    const d = formatDesignations(622, 28);
    const map = Object.fromEntries(d.map((x) => [x.format, x.value]));
    expect(map["ETRTO / ISO"]).toBe("28-622");
    expect(map["French"]).toBe("700 × 28C");
    expect(map["Inch (fractional)"]).toBe("28 × 1 1/8″");
    // a 28 mm tire should NOT be shown as a wide 29-inch decimal
    expect(map["Inch (decimal)"]).toBeUndefined();
  });

  it("re-expresses a wide 622 as a 29er decimal", () => {
    const map = Object.fromEntries(formatDesignations(622, 54).map((x) => [x.format, x.value]));
    expect(map["Inch (decimal)"]).toBe("29 × 2.13″");
    expect(map["ETRTO / ISO"]).toBe("54-622");
  });
});

describe("suggestTireSizes", () => {
  it("returns a broad spread for an empty query", () => {
    const s = suggestTireSizes("");
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].label).toBe("700x28C"); // leads the broad-default spread
    // spans several wheel sizes, not just one family
    expect(new Set(s.map((x) => x.iso)).size).toBeGreaterThan(3);
  });

  it("every suggested label parses back to its size's iso", () => {
    for (const s of suggestTireSizes("", 100)) {
      const p = parseTireSize(s.label);
      expect(p).not.toBeNull();
      expect(p!.iso).toBe(s.iso);
    }
  });

  it("shows all three formats in the default view", () => {
    const labels = suggestTireSizes("", 100).map((s) => s.label);
    expect(labels).toContain("700x28C"); // French
    expect(labels.some((l) => /^\d+x\d/.test(l) && l.includes("."))).toBe(true); // inch decimal
    expect(labels.some((l) => /^\d+-\d+$/.test(l))).toBe(true); // ETRTO
  });

  it("filters by a diameter typed as French, decimal or inch", () => {
    expect(suggestTireSizes("700").every((s) => s.label.startsWith("700"))).toBe(true);
    expect(suggestTireSizes("27.5").every((s) => s.iso === 584)).toBe(true);
  });

  it("shows the ETRTO form when the query is an ISO bead diameter", () => {
    const results = suggestTireSizes("622", 100);
    expect(results.every((s) => s.iso === 622)).toBe(true);
    // typing the bead diameter should surface ETRTO labels, not French ones
    expect(results.map((s) => s.label)).toContain("28-622");
    expect(results.every((s) => /-622$/.test(s.label))).toBe(true);
  });

  it("returns nothing for gibberish", () => {
    expect(suggestTireSizes("banana")).toEqual([]);
  });
});

describe("toFractionInch", () => {
  it("rounds to the nearest 1/8 and reduces", () => {
    expect(toFractionInch(28)).toBe("1 1/8");
    expect(toFractionInch(35)).toBe("1 3/8");
    expect(toFractionInch(38.1)).toBe("1 1/2"); // exactly 1.5"
  });
});
