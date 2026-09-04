// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Power } from "./Power";

afterEach(cleanup);

// input order: [speed, power, mass, gradient, headwind, cda, crr, rho, eff]
const nums = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('input[type="number"]')) as HTMLInputElement[];

describe("Cycling power", () => {
  it("shows the computed power for the default speed", () => {
    const { container } = render(<Power />);
    const [speed, power] = nums(container);
    expect(+speed.value).toBe(30);
    // ~150 W for the default flat setup
    expect(+power.value).toBeGreaterThan(120);
    expect(+power.value).toBeLessThan(180);
  });

  it("couples the two fields and holds the last-edited one fixed", () => {
    const { container } = render(<Power />);
    // editing power makes it the fixed input; speed recomputes
    fireEvent.change(nums(container)[1], { target: { value: "300" } });
    expect(+nums(container)[1].value).toBe(300);
    const speedAt300 = +nums(container)[0].value;
    expect(speedAt300).toBeGreaterThan(30); // more power -> faster

    // heavier rider with power fixed -> lower computed speed
    fireEvent.change(nums(container)[2], { target: { value: "110" } });
    expect(+nums(container)[1].value).toBe(300); // power held fixed
    expect(+nums(container)[0].value).toBeLessThan(speedAt300);
  });

  it("holds speed fixed when speed was edited last", () => {
    const { container } = render(<Power />);
    fireEvent.change(nums(container)[0], { target: { value: "35" } });
    expect(+nums(container)[0].value).toBe(35);
    const p1 = +nums(container)[1].value;
    fireEvent.change(nums(container)[2], { target: { value: "110" } });
    expect(+nums(container)[0].value).toBe(35); // speed held fixed
    expect(+nums(container)[1].value).toBeGreaterThan(p1); // more mass -> more power
  });

  it("fills a coefficient from its preset popup", () => {
    const { container, getByTitle, getByText } = render(<Power />);
    fireEvent.click(getByTitle("Fill CdA from a riding position"));
    fireEvent.click(getByText("Drops (0.3)"));
    expect(nums(container).some((i) => i.value === "0.3")).toBe(true);
  });
});
