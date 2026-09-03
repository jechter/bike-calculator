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
    // reading 20 on the example 2.0mm curve -> 110 kgf -> 1079 N
    expect(getByText(/110 kgf · 1079 N/)).toBeTruthy();
    // exactly one Tension result label
    const labels = Array.from(container.querySelectorAll(".result-label")).filter(
      (n) => n.textContent === "Tension",
    );
    expect(labels.length).toBe(1);
  });

  it("applies a hub preset from the section popup", () => {
    const { getByText, container } = render(<WheelBuilding />);
    fireEvent.click(getByText("Common hub"));
    fireEvent.click(getByText("Road front — QR 100 mm"));
    // flanges become 38 mm (default was 45)
    const has38 = Array.from(container.querySelectorAll('input[type="number"]')).some(
      (i) => (i as HTMLInputElement).value === "38",
    );
    expect(has38).toBe(true);
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
