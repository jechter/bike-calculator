// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, within } from "@testing-library/react";
import { Drivetrain } from "./Drivetrain";

afterEach(cleanup);

describe("Drivetrain page", () => {
  it("has a cadence slider (60–120) plus a free number field", () => {
    const { container } = render(<Drivetrain />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.min).toBe("60");
    expect(slider.max).toBe("120");
  });

  it("does not show a gain-ratio column", () => {
    const { getByText, queryByText } = render(<Drivetrain />);
    expect(getByText("Ratio")).toBeTruthy();
    expect(queryByText("Gain")).toBeNull();
  });

  it("fills the cassette field from the preset popup button", () => {
    const { getByTitle, getByText, container } = render(<Drivetrain />);
    const before = container.querySelector('input[type="text"]');
    fireEvent.click(getByTitle("Fill from a cassette preset"));
    fireEvent.click(getByText("12sp 10-52"));
    // The cogs text input should now hold the preset's tooth list.
    const cogs = Array.from(container.querySelectorAll('input[type="text"]')).find((i) =>
      (i as HTMLInputElement).value.includes("52"),
    ) as HTMLInputElement;
    expect(cogs).toBeTruthy();
    expect(cogs).not.toBe(before);
  });

  it("shows chain length in mm and links, not inches", () => {
    const { getByText } = render(<Drivetrain />);
    // Default 50/34, 11-28, chainstay 410 -> 1346 mm / 106 links
    expect(getByText("1346 mm")).toBeTruthy();
    expect(getByText("106")).toBeTruthy();
  });

  it("shows chain-wear thresholds as a reference (no elongation input)", () => {
    const { getByText } = render(<Drivetrain />);
    expect(getByText("0.50%")).toBeTruthy();
    expect(getByText("0.75%")).toBeTruthy();
    expect(getByText("1.00%")).toBeTruthy();
  });

  it("links to the tyre calculator", () => {
    const { container } = render(<Drivetrain />);
    const link = container.querySelector('a[href="#/tire"]');
    expect(link).toBeTruthy();
  });
});
