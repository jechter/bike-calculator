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
    for (const bike of CDA_BIKES.filter(b => b.value !== "recumbent" && b.value !== "velomobile")) {
      for (const position of bike.positions) {
        const params: CdaParams = { ...DEFAULT_CDA_PARAMS, bike: bike.value, position };
        rerender(<CdaBikePreview params={params} />);
        expect(container.querySelector("svg")).toBeTruthy();
        expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it("does not misrepresent reclined or enclosed bikes as diamond frames", () => {
    const { container, rerender, getByText } = render(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "recumbent", position: "lowracer" }} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(getByText("Preview unavailable for recumbent geometry.")).toBeTruthy();
    rerender(<CdaBikePreview params={{ ...DEFAULT_CDA_PARAMS, bike: "velomobile", position: "shell" }} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(getByText("Preview unavailable for enclosed shells.")).toBeTruthy();
  });
});
