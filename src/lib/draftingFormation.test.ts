import { draftFactor, SIDE_BY_SIDE_PENALTY } from "./cda";
import { describe, expect, it } from "vitest";
import { fixedFormationLayout } from "./draftingFormation";

describe("fixed drafting layouts", () => {
  it("puts one complete row ahead of you for double-file input 2", () => {
    const layout = fixedFormationLayout("double", 2);
    expect(layout.total).toBe(3);
    expect(layout.riders).toHaveLength(3);
    expect(layout.riders.filter(r => !r.you).map(r => r.y)).toEqual([0, 0]);
    expect(layout.riders[2]).toEqual({ x: -21, y: 38, you: true });
  });

  it("fills the last double-file row alongside you before starting another", () => {
    const layout = fixedFormationLayout("double", 3);
    expect(layout.riders.filter(r => !r.you).map(r => r.y)).toEqual([0, 0, 38]);
    expect(layout.riders.find(r => r.you)).toEqual({ x: 21, y: 38, you: true });
    expect(layout.total).toBe(4);
  });

  it("fills the peloton row around You before starting another row", () => {
    const a = fixedFormationLayout("bunch", 3); // 4 riders: 1 + 2 + You
    const b = fixedFormationLayout("bunch", 4); // Add a neighbour in the same row
    const c = fixedFormationLayout("bunch", 5); // Fill that row of 3
    const d = fixedFormationLayout("bunch", 6); // Start the next row
    expect([a, b, c, d].map(l => l.riders.find(r => r.you)!.y)).toEqual([72, 72, 72, 108]);
    expect(c.riders.filter(r => r.y === 72)).toHaveLength(3);
  });

  it("derives fixed-double drag from the same row shown in the schematic", () => {
    for (let count = 0; count <= 12; count++) {
      const layout = fixedFormationLayout("double", count);
      const row = layout.riders.find(r => r.you)!.y / 38;
      const factor = row === 0 ? count === 0 ? 1 : SIDE_BY_SIDE_PENALTY
        : 0.35 + 0.65 * Math.pow(0.48, row);
      expect(draftFactor(count, "double")).toBeCloseTo(factor, 12);
    }
    // Large formations use the full aerodynamic row depth.
    expect(draftFactor(31, "double")).toBeCloseTo(0.35 + 0.65 * Math.pow(0.48, 15), 12);
  });

  it("widens the peloton 1 through 10, then alternates 9 and 10 as in the paper", () => {
    const layout = fixedFormationLayout("bunch", 120);
    const ahead = layout.riders;
    const rows = [...new Set(ahead.map(r => r.y))];
    expect(rows.map(y => ahead.filter(r => r.y === y).length)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 10, 9, 10, 9, 10, 9]);
    expect(layout.riders.filter(r => r.you)).toHaveLength(1);
    expect(layout.riders.find(r => r.you)!.y).toBe(Math.max(...ahead.map(r => r.y)));
  });

  it("keeps You in the last row, preserves counts and stays within the view", () => {
    for (const formation of ["line", "double", "bunch"] as const) {
      for (const n of [0, 1, 2, 3, 5, 10, 50, 150]) {
        const layout = fixedFormationLayout(formation, n);
        const you = layout.riders.find(r => r.you)!;
        expect(layout.riders.filter(r => !r.you).every(r => r.y <= you.y)).toBe(true);
        expect(layout.riders.length).toBe(layout.total);
        expect(layout.total).toBe(n + 1);
        for (const r of layout.riders) {
          expect(Math.abs(r.x) + 17).toBeLessThan(layout.width / 2);
          expect(r.y + 40 + 17).toBeLessThan(layout.height);
        }
      }
    }
  });
});
