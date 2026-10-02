// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Power } from "./Power";

afterEach(cleanup);

// input order: [speed, power, wkg, rider, bike, gradient, headwind, cda, rho, crr,
//               drivetrain-efficiency]
const nums = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('input[type="number"]')) as HTMLInputElement[];

describe("Cycling power", () => {
  it("shows the computed power for the default speed", () => {
    const { container } = render(<Power />);
    const [speed, power] = nums(container);
    expect(+speed.value).toBe(30);
    // ~165 W for the default flat setup (estimator-seeded CdA ~0.356)
    expect(+power.value).toBeGreaterThan(130);
    expect(+power.value).toBeLessThan(190);
  });

  it("couples the two fields and holds the last-edited one fixed", () => {
    const { container } = render(<Power />);
    // editing power makes it the fixed input; speed recomputes
    fireEvent.change(nums(container)[1], { target: { value: "300" } });
    expect(+nums(container)[1].value).toBe(300);
    const speedAt300 = +nums(container)[0].value;
    expect(speedAt300).toBeGreaterThan(30); // more power -> faster

    // heavier rider with power fixed -> lower computed speed
    fireEvent.change(nums(container)[3], { target: { value: "110" } });
    expect(+nums(container)[1].value).toBe(300); // power held fixed
    expect(+nums(container)[0].value).toBeLessThan(speedAt300);
  });

  it("holds speed fixed when speed was edited last", () => {
    const { container } = render(<Power />);
    fireEvent.change(nums(container)[0], { target: { value: "35" } });
    expect(+nums(container)[0].value).toBe(35);
    const p1 = +nums(container)[1].value;
    fireEvent.change(nums(container)[3], { target: { value: "110" } });
    expect(+nums(container)[0].value).toBe(35); // speed held fixed
    expect(+nums(container)[1].value).toBeGreaterThan(p1); // more mass -> more power
  });

  it("resolves power from W/kg when W/kg is edited", () => {
    const { container } = render(<Power />);
    // rider default 70 kg; 4 W/kg -> 280 W
    fireEvent.change(nums(container)[2], { target: { value: "4" } });
    expect(+nums(container)[2].value).toBe(4);
    expect(+nums(container)[1].value).toBe(280); // 4 W/kg × 70 kg rider
  });

  it("recomputes W/kg from rider mass when power was edited last", () => {
    const { container } = render(<Power />);
    fireEvent.change(nums(container)[1], { target: { value: "280" } });
    expect(+nums(container)[2].value).toBe(4); // 280 W / 70 kg rider
    // lighter rider at the same watts -> higher W/kg
    fireEvent.change(nums(container)[3], { target: { value: "56" } });
    expect(+nums(container)[1].value).toBe(280); // power held fixed
    expect(+nums(container)[2].value).toBe(5); // 280 / 56
  });

  it("fills a coefficient from its preset popup", () => {
    const { container, getByTitle, getByText } = render(<Power />);
    fireEvent.click(getByTitle("Fill Crr from a tire / surface"));
    fireEvent.click(getByText("Gravel (0.012)"));
    expect(nums(container).some((i) => i.value === "0.012")).toBe(true);
  });

  it("re-derives CdA from rider weight while estimator-driven, but not once typed", () => {
    const { container } = render(<Power />);
    const cda0 = +nums(container)[7].value; // seeded from the estimator
    // Heavier rider → larger frontal area → higher CdA.
    fireEvent.change(nums(container)[3], { target: { value: "100" } });
    expect(+nums(container)[7].value).toBeGreaterThan(cda0);
    // Typing a CdA switches it to manual; weight no longer moves it.
    fireEvent.change(nums(container)[7], { target: { value: "0.3" } });
    fireEvent.change(nums(container)[3], { target: { value: "60" } });
    expect(+nums(container)[7].value).toBe(0.3);
  });

  it("opens the CdA estimator from the caret and applies only on change", () => {
    const { container, getByTitle, getByText, getByLabelText, queryByText } = render(<Power />);
    const cdaBefore = +nums(container)[7].value; // CdA is the 8th number input
    // The caret on the CdA field opens the estimator directly (no preset list).
    fireEvent.click(getByTitle("Estimate CdA from bike, position & kit"));
    expect(getByText("Estimate CdA")).toBeTruthy();
    // Opening alone must not overwrite the current value.
    expect(+nums(container)[7].value).toBe(cdaBefore);
    // Switching to a velomobile (bike type is the first select) slashes the CdA.
    const bike = container.querySelectorAll("select")[0] as HTMLSelectElement;
    fireEvent.change(bike, { target: { value: "velomobile" } });
    expect(+nums(container)[7].value).toBeLessThan(0.1);
    // Closing it leaves the field editable again.
    fireEvent.click(getByLabelText("Close"));
    expect(queryByText("Estimate CdA")).toBeNull();
  });

  it("combines drivetrain and gearing into one efficiency via the editor", () => {
    const { container, getByTitle } = render(<Power />);
    // Speed is the fixed input by default; a more efficient gearing (single
    // speed, η 1.0 vs the default derailleur 0.98) needs fewer pedal watts.
    const powerDefault = +nums(container)[1].value;
    fireEvent.click(getByTitle("Choose drivetrain & gearing"));
    // Panel selects are [drivetrain, gearing]; set gearing to single speed.
    const gearing = container.querySelectorAll(".editor-pop select")[1] as HTMLSelectElement;
    fireEvent.change(gearing, { target: { value: "single" } });
    expect(+nums(container)[1].value).toBeLessThan(powerDefault);
  });

  it("computes air density from temperature and altitude via the editor", () => {
    const { container, getByTitle } = render(<Power />);
    const rho0 = +nums(container)[8].value; // rho is the 9th number input
    expect(rho0).toBeCloseTo(1.225, 2); // seeded: 15 °C, sea level
    fireEvent.click(getByTitle("Set air density from temperature & altitude"));
    // Panel number inputs are [temperature, altitude].
    const panelNums = container.querySelectorAll('.editor-pop input[type="number"]');
    fireEvent.change(panelNums[1] as HTMLInputElement, { target: { value: "2000" } });
    expect(+nums(container)[8].value).toBeLessThan(rho0); // thinner air up high
  });
});
