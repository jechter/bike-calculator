// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Power } from "./Power";

afterEach(cleanup);

// input order: [speed, power, wkg, rider, bike, gradient, headwind, cda, rho, crr,
//               drivetrain-efficiency, duration, distance, gross-efficiency]
const nums = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('input[role="spinbutton"]')) as HTMLInputElement[];

describe("Cycling power", () => {
  it("shows Rider & conditions without a section info button", () => {
    const { queryByRole } = render(<Power />);
    expect(queryByRole("button", { name: "About: Rider & conditions" })).toBeNull();
  });

  it("prefills speed and climb gradient from a deep link", () => {
    const originalUrl = window.location.href;
    try {
      history.replaceState(null, "", "/cycling-power-calculator/?speed=8.5&gradient=10");
      const { container } = render(<Power />);
      expect(+nums(container)[0].value).toBe(8.5);
      expect(+nums(container)[5].value).toBe(10);
      const watts = +nums(container)[1].value;
      fireEvent.change(nums(container)[5], { target: { value: "12" } });
      expect(+nums(container)[0].value).toBe(8.5);
      expect(+nums(container)[1].value).toBeGreaterThan(watts);
    } finally {
      history.replaceState(null, "", originalUrl);
    }
  });

  it("ignores invalid deep-link values", () => {
    const originalUrl = window.location.href;
    try {
      history.replaceState(null, "", "/cycling-power-calculator/?speed=-5&gradient=NaN");
      const { container } = render(<Power />);
      expect(+nums(container)[0].value).toBe(30);
      expect(+nums(container)[5].value).toBe(0);
    } finally {
      history.replaceState(null, "", originalUrl);
    }
  });

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

  it("lowers CdA with shaved legs", () => {
    const { container, getByTitle } = render(<Power />);
    const before = +nums(container)[7].value;
    fireEvent.click(getByTitle("Estimate CdA from bike, position & kit"));
    const legs = Array.from(container.querySelectorAll<HTMLSelectElement>(".editor-pop select")).find(
      (s) => Array.from(s.options).some((o) => o.value === "shaved"),
    )!;
    fireEvent.change(legs, { target: { value: "shaved" } });
    expect(+nums(container)[7].value).toBeLessThan(before);
  });

  it("follows the drafting group size into the CdA field", () => {
    const { container, getByTitle } = render(<Power />);
    fireEvent.click(getByTitle("Estimate CdA from bike, position & kit"));
    const solo = +nums(container)[7].value;
    // The drafting formation is the panel's last select; its count the last input.
    const formation = Array.from(container.querySelectorAll(".editor-pop select")).pop()!;
    fireEvent.change(formation, { target: { value: "doubleRotating" } });
    // Switching preserves the initial zero other riders (still alone).
    expect(+nums(container)[7].value).toBe(solo);
    const count = () =>
      Array.from(container.querySelectorAll('.editor-pop input[role="spinbutton"]')).pop()!;
    fireEvent.change(count(), { target: { value: "7" } });
    const group8 = +nums(container)[7].value;
    expect(group8).toBeLessThan(solo);
    fireEvent.change(count(), { target: { value: "15" } });
    const group16 = +nums(container)[7].value;
    expect(group16).toBeLessThan(group8); // bigger rotating group → more shelter
    // The panel readout and the field agree.
    expect(container.querySelector(".editor-pop-out strong")!.textContent).toContain(
      group16.toFixed(3),
    );
  });

  it("keeps one Other riders count across all formations and puts previews after the readout", () => {
    const { container, getByTitle, getByLabelText } = render(<Power />);
    fireEvent.click(getByTitle("Estimate CdA from bike, position & kit"));
    const count = getByLabelText("Other riders") as HTMLInputElement;
    const formation = getByLabelText("Drafting formation");
    fireEvent.change(count, { target: { value: "7" } });
    for (const value of ["line", "double", "doubleRotating", "bunch"]) {
      fireEvent.change(formation, { target: { value } });
      expect((getByLabelText("Other riders") as HTMLInputElement).value).toBe("7");
      expect(container.querySelectorAll(".drafting-preview [data-rider]")).toHaveLength(8);
    }
    // Even a large peloton count survives switching to rotation without clamping.
    fireEvent.change(count, { target: { value: "150" } });
    fireEvent.change(formation, { target: { value: "doubleRotating" } });
    expect((getByLabelText("Other riders") as HTMLInputElement).value).toBe("150");
    expect(container.querySelectorAll("animateMotion")).toHaveLength(151);
    const previews = container.querySelector(".cda-previews")!;
    expect(previews.children).toHaveLength(2);
    expect(previews.querySelector(".cda-bike-preview figcaption small")).toBeNull();
    expect(previews.querySelector("button")).toBeNull();
    expect(previews.textContent).not.toMatch(/side view|top view|including you/);
    expect(container.querySelector(".editor-pop-grid .cda-bike-preview")).toBeNull();
    expect(container.querySelector(".draft-you-halo")).toBeNull();
    expect(container.querySelector(".editor-pop-out")!.compareDocumentPosition(previews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    const panelNums = container.querySelectorAll('.editor-pop input[role="spinbutton"]');
    fireEvent.change(panelNums[1] as HTMLInputElement, { target: { value: "2000" } });
    expect(+nums(container)[8].value).toBeLessThan(rho0); // thinner air up high
  });

  it("adds up work and food energy over the ride", () => {
    const { container, getByText } = render(<Power />);
    const n = nums(container);
    const [duration, distance] = [n[11], n[12]];
    // Defaults: 60 min at 30 km/h → 30 km.
    expect(+duration.value).toBe(60);
    expect(+distance.value).toBe(30);
    const watts = +n[1].value;
    // Pedal work = power × time; at 24 % gross efficiency ≈ 1 kcal per kJ.
    // (the shown watts are rounded: ±0.5 W × 1 h ≈ ±1.8 kJ)
    const work = +getByText("Pedal work").nextElementSibling!.textContent!.replace(/\D/g, "");
    expect(Math.abs(work - (watts * 3600) / 1000)).toBeLessThan(2.5);

    // Editing distance holds it fixed; duration follows the speed.
    fireEvent.change(nums(container)[12], { target: { value: "45" } });
    expect(+nums(container)[11].value).toBe(90);
    fireEvent.change(nums(container)[0], { target: { value: "45" } });
    expect(+nums(container)[12].value).toBe(45); // distance held
    expect(+nums(container)[11].value).toBe(60); // faster → shorter

    // A lower gross efficiency burns more food energy for the same work.
    const kcalAt = () => +getByText(/kcal$/).textContent!.replace(/\D/g, "");
    const kcal24 = kcalAt();
    fireEvent.change(nums(container)[13], { target: { value: "20" } });
    expect(kcalAt()).toBeGreaterThan(kcal24);
  });

  it("shows live food equivalents from the Food energy info button", () => {
    const { container, getByLabelText, getByText } = render(<Power />);
    const info = getByLabelText("About: Food energy");
    const card = info.closest(".result")!;
    const shownKcal = () => Number(card.querySelector(".result-value")!.textContent!.replace(/[^0-9]/g, ""));
    const initial = shownKcal();
    fireEvent.click(info);
    expect(getByText(`${initial.toLocaleString("en")} kcal is roughly equivalent to:`)).toBeTruthy();
    expect(container.querySelectorAll(".food-energy-equivalents li")).toHaveLength(5);
    fireEvent.change(nums(container)[11], { target: { value: "120" } });
    expect(shownKcal()).toBeGreaterThan(initial);
    expect(getByText(`${shownKcal().toLocaleString("en")} kcal is roughly equivalent to:`)).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".food-energy-info")).toBeNull();
  });

  it("reports elevation gained on a climb", () => {
    const { container, getByText } = render(<Power />);
    fireEvent.change(nums(container)[5], { target: { value: "5" } }); // 5 % gradient
    fireEvent.change(nums(container)[12], { target: { value: "10" } }); // 10 km
    // 10 km × sin(atan 0.05) ≈ 499 m
    expect(getByText("Elevation gained")).toBeTruthy();
    expect(getByText("499 m")).toBeTruthy();
  });
});
