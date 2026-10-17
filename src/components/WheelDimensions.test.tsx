// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { WheelDimensions, type WheelDimensionGeometry } from "./WheelDimensions";
import { rimHoleAngle } from "../lib/spokes";

afterEach(cleanup);

// Orthographic face-on camera: model x/y map straight onto the canvas, so the
// unit rim spans the whole 200 × 200 overlay.
// prettier-ignore
const FACE = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
// Turned 90° about the y axis (the Side view): the axle runs across the canvas.
// prettier-ignore
const SIDE = new Float32Array([0,0,-1,0, 0,1,0,0, 1,0,0,0, 0,0,0,1]);

const geometry: WheelDimensionGeometry = {
  lfR: 0.1, rfR: 0.1, zL: -0.11, zR: 0.06, flEdge: 0.013, holeR: 0.008, rimHoleGroup: 1,
  spokes: [
    { isDrive: true, lead: 1, hub: [0, 0.1, 0.06], rim: [0, 1, 0.01] },
    { isDrive: false, lead: -1, hub: [0, -0.1, -0.11], rim: [0, -1, -0.01] },
  ],
};

const segment = (svg: Element) => {
  const l = svg.querySelector(".wd-dim-seg")!;
  return ["x1", "y1", "x2", "y2"].map((k) => Number(l.getAttribute(k)));
};

describe("Wheel dimension overlay", () => {
  it("draws the ERD as a labeled diameter across the rim", () => {
    const { container, getByText } = render(
      <WheelDimensions dimension={{ kind: "erd", label: "602 mm" }}
        geometry={geometry} mvp={FACE} width={200} height={200} />,
    );
    expect(getByText("602 mm")).toBeTruthy();
    const [x1, y1, x2, y2] = segment(container.querySelector(".wd-dims")!);
    expect(Math.hypot(x2 - x1, y2 - y1)).toBeCloseTo(200, 0);
  });

  it("draws a flange offset along the axle", () => {
    const { container } = render(
      <WheelDimensions dimension={{ kind: "leftOffset", label: "34 mm" }}
        geometry={geometry} mvp={SIDE} width={200} height={200} />,
    );
    const svg = container.querySelector(".wd-dims")!;
    const [x1, y1, x2, y2] = segment(svg);
    expect(y1).toBeCloseTo(y2, 5); // axial = horizontal in the side view
    // 11 px is too short for heads inside, so they sit outside pointing in and
    // the line runs on past each end by a head plus a tail (19 px).
    expect(Math.abs(x2 - x1)).toBeCloseTo(0.11 * 100 + 2 * 19, 3);
  });

  it("rings the flange hole on each side, labeling the size once", () => {
    const { container, getAllByText } = render(
      <WheelDimensions dimension={{ kind: "holeDia", label: "2.6 mm" }}
        geometry={geometry} mvp={FACE} width={200} height={200} />,
    );
    expect(container.querySelectorAll(".wd-dim-ring")).toHaveLength(2);
    expect(getAllByText("2.6 mm")).toHaveLength(1);
  });

  it("curves the group gap arrow along the rim between two groups", () => {
    // 12 holes drilled in pairs, the gap between pairs 3× the spacing within one.
    const grouped: WheelDimensionGeometry = {
      ...geometry,
      rimHoleGroup: 2,
      spokes: Array.from({ length: 12 }, (_, i) => {
        const a = rimHoleAngle(i, 12, 2, 3);
        return { isDrive: i % 2 === 0, lead: 1, hub: [0, 0, 0], rim: [Math.cos(a), Math.sin(a), 0] };
      }),
    };
    const { container, getByText } = render(
      <WheelDimensions dimension={{ kind: "rimHoleGap", label: "3.0×" }}
        geometry={grouped} mvp={FACE} width={200} height={200} />,
    );
    expect(getByText("3.0×")).toBeTruthy();
    const arcs = container.querySelectorAll("polyline.wd-dim-seg");
    expect(arcs).toHaveLength(1);
    // The arc spans the 45° gap (a = 15°, gap 3a) at radius 0.92 × 100 px.
    const p = arcs[0].getAttribute("points")!.split(" ").map((xy) => xy.split(",").map(Number));
    const len = p.reduce((sum, q, i) => (i ? sum + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
    expect(len).toBeCloseTo(92 * (Math.PI / 4), 0);
  });
});
