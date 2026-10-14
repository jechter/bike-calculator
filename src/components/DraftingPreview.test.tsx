// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
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

  it("labels omitted riders in large fixed groups", () => {
    const { container, getByText, getByRole } = render(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "line", draftRiders: 150 }} />);
    expect(container.querySelectorAll("[data-rider]")).toHaveLength(13);
    expect(getByText("Showing the nearest 12 riders ahead; 138 more not shown.")).toBeTruthy();
    expect(getByRole("img").getAttribute("aria-label")).toContain("150 riders ahead");
  });

  it("animates every rotating rider with evenly spaced phases and supports pause", () => {
    const pause = vi.fn();
    const resume = vi.fn();
    Object.defineProperty(SVGSVGElement.prototype, "pauseAnimations", { configurable: true, value: pause });
    Object.defineProperty(SVGSVGElement.prototype, "unpauseAnimations", { configurable: true, value: resume });
    const { container, getByRole, rerender } = render(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "doubleRotating", draftRiders: 7 }} />);
    expect(container.querySelectorAll("animateMotion")).toHaveLength(8);
    expect(new Set([...container.querySelectorAll("animateMotion")].map(e => e.getAttribute("begin"))).size).toBe(8);
    expect(container.querySelectorAll('[data-rider="you"]')).toHaveLength(1);
    fireEvent.click(getByRole("button", { name: "Pause formation animation" }));
    expect(pause).toHaveBeenCalled();
    fireEvent.click(getByRole("button", { name: "Resume formation animation" }));
    expect(resume).toHaveBeenCalled();
    rerender(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "doubleRotating", draftRiders: 39 }} />);
    expect(container.querySelectorAll("animateMotion")).toHaveLength(40);
    rerender(<DraftingPreview params={{ ...DEFAULT_CDA_PARAMS, formation: "doubleRotating", draftRiders: 0 }} />);
    expect(container.querySelector("animateMotion")).toBeNull();
    delete (SVGSVGElement.prototype as unknown as Record<string, unknown>).pauseAnimations;
    delete (SVGSVGElement.prototype as unknown as Record<string, unknown>).unpauseAnimations;
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
