import { describe, it, expect } from "vitest";
import { parseTireSize, formatDesignations, toFractionInch } from "./tireSizes";

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

  it("parses MTB decimal and 650B", () => {
    expect(parseTireSize("26x2.1")).toEqual({ iso: 559, widthMm: 53 });
    expect(parseTireSize("27.5x2.4")).toEqual({ iso: 584, widthMm: 61 });
    expect(parseTireSize("650b x 47")).toEqual({ iso: 584, widthMm: 47 });
  });

  it("disambiguates fractional inch by width", () => {
    expect(parseTireSize("28x1 1/2")).toEqual({ iso: 635, widthMm: 40 });
    expect(parseTireSize("28x1 3/8")).toEqual({ iso: 622, widthMm: 35 });
    expect(parseTireSize("26x1 3/8")).toEqual({ iso: 590, widthMm: 35 });
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

describe("toFractionInch", () => {
  it("rounds to the nearest 1/8 and reduces", () => {
    expect(toFractionInch(28)).toBe("1 1/8");
    expect(toFractionInch(35)).toBe("1 3/8");
    expect(toFractionInch(38.1)).toBe("1 1/2"); // exactly 1.5"
  });
});
