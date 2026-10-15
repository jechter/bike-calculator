// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CdaBikePreview } from "./CdaBikePreview";
import { DEFAULT_CDA_PARAMS, CDA_BIKES, type CdaParams } from "../lib/cda";

function pose(container: HTMLElement) {
  return container.querySelector(".rp-rider")?.innerHTML;
}

describe("CdA bike preview", () => {
  it("shares the bike and rider renderer without fit annotations", () => {
    const { container, getByRole } = render(<CdaBikePreview params={DEFAULT_CDA_PARAMS} />);
    expect(getByRole("img").getAttribute("aria-label")).toContain("Road · Hoods");
    expect(container.querySelectorAll(".fg-wheel")).toHaveLength(2);
    expect(container.querySelector(".rp-rider")).toBeTruthy();
    expect(container.querySelector(".fg-rider")).toBeNull();
    expect(container.querySelector(".fg-dim")).toBeNull();
    expect(container.querySelector("svg text")).toBeNull();
  });

  it("changes the rendered posture and geometry with the inputs", () => {
    const { container, rerender } = render(<CdaBikePreview params={DEFAULT_CDA_PARAMS} />);
    const initial = pose(container);
    rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, position: "dropsLow" }} />);
    expect(pose(container)).not.toBe(initial);
    const low = pose(container);
    rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, position: "dropsLow", heightCm: 160 }} />);
    expect(pose(container)).not.toBe(low);
    rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "mtb", position: "upright" }} />);
    expect(container.querySelector(".fg-fork-lowers")).toBeTruthy();
  });

  it("renders every supported bike/position with finite coordinates", () => {
    const { container, rerender } = render(<CdaBikePreview params={DEFAULT_CDA_PARAMS} />);
    for (const bike of CDA_BIKES) {
      for (const position of bike.positions) {
        const params: CdaParams = { ...DEFAULT_CDA_PARAMS, bike: bike.value, position };
        rerender(<CdaBikePreview params={params} />);
        expect(container.querySelector("svg")).toBeTruthy();
        expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it("shows distinct reclined seats, tailbox and enclosed-shell geometry", () => {
    const { container, rerender, getByRole } = render(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "recumbent", position: "highracer" }} />);
    expect(getByRole("img").getAttribute("aria-label")).toContain("high reclined seat and feet-forward pedals");
    const highHipY = +container.querySelector(".rp-trunk")!.getAttribute("y1")!;
    expect(container.querySelectorAll(".fg-wheel")).toHaveLength(2);
    rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "recumbent", position: "lowracer" }} />);
    expect(+container.querySelector(".rp-trunk")!.getAttribute("y1")!).toBeGreaterThan(highHipY);
    expect(container.querySelector(".rec-tailbox")).toBeNull();
    rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "recumbent", position: "lowracerTail" }} />);
    expect(container.querySelector(".rec-tailbox")).toBeTruthy();
    expect(getByRole("img").getAttribute("aria-label")).toContain("aerodynamic tailbox");
    rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "velomobile", position: "shell" }} />);
    expect(container.querySelector(".rec-shell")).toBeTruthy();
    expect(container.querySelector(".rec-canopy")).toBeTruthy();
    expect(container.querySelectorAll(".fg-wheel")).toHaveLength(3);
    expect(getByRole("img").getAttribute("aria-label")).toContain("reclined rider shown in cutaway");
    expect(container.querySelector(".rp-rider")).toBeTruthy();
    const shell = container.querySelector("svg")!.outerHTML;
    rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "velomobile", position: "shell", heightCm: 130 }} />);
    expect(container.querySelector("svg")!.outerHTML).toBe(shell);
  });

  it("lowers the velomobile occupant and rounds the rear of the tailbox", () => {
    const { container, rerender } = render(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "recumbent", position: "lowracerTail" }} />);
    const lowHipY = +container.querySelector(".rp-trunk")!.getAttribute("y1")!;
    const tail = container.querySelector(".rec-tailbox")!.getAttribute("d")!;
    expect((tail.match(/Q/g) ?? []).length).toBeGreaterThanOrEqual(2);
    rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "velomobile", position: "shell" }} />);
    expect(+container.querySelector(".rp-trunk")!.getAttribute("y1")!).toBeGreaterThan(lowHipY);
    // Leave clearance for both knee outlines, especially the raised return leg.
    const farLeg = [...container.querySelectorAll(".rp-far .rp-limb")];
    const nearLeg = [...container.querySelectorAll(".rp-rider .rp-limb")].slice(0, 2);
    for (const leg of [...farLeg, ...nearLeg]) {
      expect(Math.min(+leg.getAttribute("y1")!, +leg.getAttribute("y2")!) - 40).toBeGreaterThan(-735);
    }
  });

  it("keeps feet-forward riders and wheels within the view at every supported height", () => {
    const { container, rerender } = render(<CdaBikePreview params={DEFAULT_CDA_PARAMS} />);
    for (const position of ["highracer", "lowracer", "lowracerTail", "shell"] as const) {
      for (const heightCm of [120, 175, 210]) {
        rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: position === "shell" ? "velomobile" : "recumbent", position, heightCm }} />);
        expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
        const [x, y, width, height] = container.querySelector("svg")!.getAttribute("viewBox")!.split(" ").map(Number);
        for (const circle of container.querySelectorAll(".fg-wheel, .rp-head")) {
          const cx = +circle.getAttribute("cx")!, cy = +circle.getAttribute("cy")!, r = +circle.getAttribute("r")!;
          expect(cx - r).toBeGreaterThanOrEqual(x);
          expect(cx + r).toBeLessThanOrEqual(x + width);
          expect(cy - r).toBeGreaterThanOrEqual(y);
          expect(cy + r).toBeLessThanOrEqual(y + height);
        }
      }
    }
  });
});
