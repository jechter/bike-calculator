// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { WheelBuilding } from "./WheelBuilding";

afterEach(cleanup);

describe("Wheel building page", () => {
  it("has separate Rim and Hub sections", () => {
    const { getByRole } = render(<WheelBuilding />);
    expect(getByRole("heading", { name: "Rim" })).toBeTruthy();
    expect(getByRole("heading", { name: "Hub" })).toBeTruthy();
  });

  it("shows a single tension field with both kgf and N", () => {
    const { getByText, container } = render(<WheelBuilding />);
    // reading 20 on the TM-1 round 2.0mm curve -> 70 kgf -> 686 N
    expect(getByText(/70 kgf · 686 N/)).toBeTruthy();
    // exactly one Tension result label
    const labels = Array.from(container.querySelectorAll(".result-label")).filter(
      (n) => n.textContent === "Tension",
    );
    expect(labels.length).toBe(1);
  });

  it("flags an out-of-band tensiometer reading instead of capping it", () => {
    const { container, getByText } = render(<WheelBuilding />);
    const reading = Array.from(container.querySelectorAll('input[type="number"]')).find(
      (i) => (i as HTMLInputElement).value === "20",
    ) as HTMLInputElement;
    fireEvent.change(reading, { target: { value: "0" } });
    // warns rather than reporting the clamped floor tension
    expect(getByText(/outside this curve's range/)).toBeTruthy();
    const tensionCard = Array.from(container.querySelectorAll(".result")).find(
      (n) => n.querySelector(".result-label")?.textContent === "Tension",
    )!;
    expect(tensionCard.querySelector(".result-value")?.textContent).toBe("—");
  });

  it("applies a hub preset, shows its name, and reverts on edit", () => {
    const { getByText, container } = render(<WheelBuilding />);
    fireEvent.click(getByText("Common hub presets"));
    fireEvent.click(getByText("Road front — QR 100 mm"));
    // flanges become 38 mm (default was 45)
    const flange = Array.from(container.querySelectorAll('input[type="number"]')).find(
      (i) => (i as HTMLInputElement).value === "38",
    ) as HTMLInputElement;
    expect(flange).toBeTruthy();
    // the button now reflects the chosen preset
    expect(getByText("Road front — QR 100 mm")).toBeTruthy();
    // editing a hub value reverts the label
    fireEvent.change(flange, { target: { value: "40" } });
    expect(getByText("Common hub presets")).toBeTruthy();
  });

  it("fills ERD from a rim preset", () => {
    const { getByTitle, getByText, container } = render(<WheelBuilding />);
    fireEvent.click(getByTitle(/Fill ERD from a common rim/));
    fireEvent.click(getByText(/26" MTB/));
    const has538 = Array.from(container.querySelectorAll('input[type="number"]')).some(
      (i) => (i as HTMLInputElement).value === "538",
    );
    expect(has538).toBe(true);
  });

  it("renders the wheel diagram with a spoke line per spoke", () => {
    const { container } = render(<WheelBuilding />);
    const svgs = container.querySelectorAll(".wheel-diagram svg");
    expect(svgs.length).toBe(2); // face view + cross-section
    // 32 spokes in the face view + section lines
    const lines = container.querySelectorAll(".wheel-diagram line");
    expect(lines.length).toBeGreaterThanOrEqual(32);
  });

  it("shows an error and hides the diagram for an infeasible lacing", () => {
    const { container, getByText } = render(<WheelBuilding />);
    // set spoke count to 10 (default lacing is 3-cross -> infeasible)
    const count = Array.from(container.querySelectorAll('input[type="number"]')).find(
      (i) => (i as HTMLInputElement).value === "32",
    ) as HTMLInputElement;
    fireEvent.change(count, { target: { value: "10" } });
    expect(getByText(/can't be built/i)).toBeTruthy();
    expect(container.querySelector(".wheel-diagram")).toBeNull();
    expect(container.textContent).toMatch(/isn't buildable with 10 spokes/);
    // spoke length results show a dash rather than a bogus number
    const values = Array.from(container.querySelectorAll(".result-value")).map((n) => n.textContent);
    expect(values).toContain("—");
  });

  it("uses each rim hole exactly once (30 spokes, no shared/unused holes)", () => {
    const { container } = render(<WheelBuilding />);
    // 30 spokes needs at most 3-cross (30/8 = 3), default 3-cross is feasible
    const count = Array.from(container.querySelectorAll('input[type="number"]')).find(
      (i) => (i as HTMLInputElement).value === "32",
    ) as HTMLInputElement;
    fireEvent.change(count, { target: { value: "30" } });
    const holes = Array.from(container.querySelectorAll(".wd-hole"));
    expect(holes.length).toBe(30);
    // every rim hole position is distinct (rounded to avoid fp noise)
    const positions = new Set(
      holes.map((h) => {
        const x = Math.round(parseFloat(h.getAttribute("cx")!) * 100) / 100;
        const y = Math.round(parseFloat(h.getAttribute("cy")!) * 100) / 100;
        return `${x},${y}`;
      }),
    );
    expect(positions.size).toBe(30);
  });

  it("scrubs the build: fewer spokes are drawn part-way through, all at the end", () => {
    const { container } = render(<WheelBuilding />);
    const scrubber = container.querySelector(".wd-scrubber") as HTMLInputElement;
    expect(scrubber).toBeTruthy();
    // spoke lines in the face view, excluding the valve marker line
    const spokeLines = () =>
      container.querySelectorAll(".wd-view:not(.wd-section) line:not(.wd-valve)").length;
    // defaults to a fully laced 32h wheel
    expect(scrubber.max).toBe("32");
    expect(spokeLines()).toBe(32);
    // scrub back to 8 spokes placed -> 8 spoke lines drawn
    fireEvent.change(scrubber, { target: { value: "8" } });
    expect(spokeLines()).toBe(8);
    // a bare rim still shows all 32 rim holes (empty), just no spoke lines
    fireEvent.change(scrubber, { target: { value: "0" } });
    expect(spokeLines()).toBe(0);
    expect(container.querySelectorAll(".wd-hole").length).toBe(32);
  });

  it("resets the build scrubber to a full wheel when the spoke count changes", () => {
    const { container } = render(<WheelBuilding />);
    const scrubber = () => container.querySelector(".wd-scrubber") as HTMLInputElement;
    fireEvent.change(scrubber(), { target: { value: "5" } });
    expect(scrubber().value).toBe("5");
    const count = Array.from(container.querySelectorAll('input[type="number"]')).find(
      (i) => (i as HTMLInputElement).value === "32",
    ) as HTMLInputElement;
    fireEvent.change(count, { target: { value: "24" } });
    // scrubber snaps back to fully laced at the new count
    expect(scrubber().max).toBe("24");
    expect(scrubber().value).toBe("24");
  });

  it("updates the diagram when the spoke count changes", () => {
    const { container } = render(<WheelBuilding />);
    const before = container.querySelectorAll(".wheel-diagram line").length;
    // find the spoke-count input by its current value (32)
    const count = Array.from(container.querySelectorAll('input[type="number"]')).find(
      (i) => (i as HTMLInputElement).value === "32",
    ) as HTMLInputElement;
    expect(count).toBeTruthy();
    fireEvent.change(count, { target: { value: "24" } });
    const after = container.querySelectorAll(".wheel-diagram line").length;
    expect(after).toBeLessThan(before);
  });
});
