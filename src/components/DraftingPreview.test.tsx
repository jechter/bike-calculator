// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftingPreview } from "./DraftingPreview";
import { DEFAULT_CDA_PARAMS } from "../lib/cda";

afterEach(() => vi.restoreAllMocks());

describe("Drafting formation preview", () => {
  it("shows one highlighted rider when riding alone", () => {
    const { container, getByRole, queryByRole } = render(<DraftingPreview params={DEFAULT_CDA_PARAMS} />);
    expect(container.querySelectorAll("[data-rider]")).toHaveLength(1);
    expect(container.querySelectorAll('[data-rider="you"]')).toHaveLength(1);
    expect(container.querySelector(".draft-you-halo")).toBeNull();
    expect(getByRole("img").getAttribute("aria-label")).toContain("Riding alone");
    expect(queryByRole("button")).toBeNull();
  });

  it("arranges single file, complete double-file rows and a widening bunch", () => {
    const { container, rerender } = render(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "line", draftRiders: 5 }} />);
    const positions = () => [...container.querySelectorAll("[data-rider]")].map(e => e.parentElement!.getAttribute("transform"));
    expect(container.querySelectorAll("[data-rider]")).toHaveLength(6);
    expect(positions().every(p => p?.startsWith("translate(160 "))).toBe(true);
    rerender(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "double", draftRiders: 2 }} />);
    expect(positions()).toEqual(["translate(139 40)", "translate(181 40)", "translate(139 78)"]);
    rerender(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "bunch", draftRiders: 5 }} />);
    expect(positions()).toEqual(["translate(160 40)", "translate(141 76)", "translate(179 76)", "translate(122 112)", "translate(160 112)", "translate(198 112)"]);
    expect(container.querySelector('[data-rider="you"]')?.parentElement?.getAttribute("transform")).toBe("translate(160 112)");
  });

  it("keeps the travel label outside the scalable SVG and removes the double-file note", () => {
    const { container, getByText, rerender } = render(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "double", draftRiders: 7 }} />);
    expect(getByText("↑ Travel").closest("svg")).toBeNull();
    expect(container.querySelector(".drafting-preview-image > .draft-direction")).toBeTruthy();
    expect(container.textContent).not.toContain("Two abreast");
    rerender(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "bunch", draftRiders: 150 }} />);
    expect(getByText("↑ Travel").closest("svg")).toBeNull();
  });

  it("shows every rider in large groups for all formations", () => {
    const { container, rerender } = render(<DraftingPreview params={DEFAULT_CDA_PARAMS} />);
    for (const formation of ["line", "double", "bunch", "doubleRotating"] as const) {
      rerender(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation, draftRiders: 150 }} />);
      expect(container.querySelectorAll("[data-rider]")).toHaveLength(151);
      expect(container.querySelectorAll('[data-rider="you"]')).toHaveLength(1);
      expect(container.textContent).not.toMatch(/not shown|nearest|omitted/);
      expect(container.querySelector("svg")!.getAttribute("aria-label")).not.toContain("omitted");
    }
  });

  it("animates every rotating rider with evenly spaced phases without a pause button", () => {
    const { container, queryByRole, rerender } = render(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "doubleRotating", draftRiders: 7 }} />);
    expect(container.querySelectorAll("animateMotion")).toHaveLength(8);
    expect(new Set([...container.querySelectorAll("animateMotion")].map(e => e.getAttribute("begin"))).size).toBe(8);
    expect(container.querySelectorAll('[data-rider="you"]')).toHaveLength(1);
    expect(queryByRole("button")).toBeNull();
    expect(container.textContent).not.toMatch(/Schematic rotation|through & off/);
    rerender(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "doubleRotating", draftRiders: 39 }} />);
    expect(container.querySelectorAll("animateMotion")).toHaveLength(40);
    rerender(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "doubleRotating", draftRiders: 0 }} />);
    expect(container.querySelector("animateMotion")).toBeNull();
  });

  it("respects reduced motion preferences", () => {
    const pause = vi.fn();
    Object.defineProperty(SVGSVGElement.prototype, "pauseAnimations", { configurable: true, value: pause });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
    const { queryByRole, getByText } = render(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "doubleRotating", draftRiders: 7 }} />);
    expect(pause).toHaveBeenCalled();
    expect(queryByRole("button")).toBeNull();
    expect(getByText(/Motion disabled/)).toBeTruthy();
    delete (SVGSVGElement.prototype as unknown as Record<string, unknown>).pauseAnimations;
    delete (window as unknown as Record<string, unknown>).matchMedia;
  });
});
