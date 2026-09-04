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

  it("visualizes gears as a chart (svg) with a line per chainring", () => {
    const { container } = render(<Drivetrain />);
    expect(container.querySelector(".gear-chart svg")).toBeTruthy();
    // default 50/34 -> two chainring rows -> two row lines
    expect(container.querySelectorAll(".gc-row-line").length).toBe(2);
    // 2 rings x 10 cogs = 20 dots, all at finite positions (no NaN geometry)
    const dots = Array.from(container.querySelectorAll(".gear-chart circle"));
    expect(dots.length).toBe(20);
    const cxs = dots.map((d) => parseFloat(d.getAttribute("cx")!));
    for (const d of dots) {
      expect(Number.isFinite(parseFloat(d.getAttribute("cx")!))).toBe(true);
      expect(Number.isFinite(parseFloat(d.getAttribute("cy")!))).toBe(true);
    }
    // First/last gridlines align with the lowest/highest gear dots
    const gridXs = Array.from(container.querySelectorAll(".gc-grid")).map((l) =>
      parseFloat(l.getAttribute("x1")!),
    );
    expect(Math.min(...cxs)).toBeCloseTo(Math.min(...gridXs), 3);
    expect(Math.max(...cxs)).toBeCloseTo(Math.max(...gridXs), 3);
    // no gain-ratio anywhere
    expect(container.textContent).not.toMatch(/Gain/);
  });

  it("switches the chart axis via the in-chart dropdown", () => {
    const { container } = render(<Drivetrain />);
    const axisBtn = container.querySelector(".gc-axis-btn") as HTMLButtonElement;
    expect(axisBtn.textContent).toMatch(/Speed at 90 rpm \(km\/h\)/);
    fireEvent.click(axisBtn);
    const list = container.querySelector(".gc-axis-list") as HTMLElement;
    fireEvent.click(within(list).getByText("Gear inches"));
    expect((container.querySelector(".gc-axis-btn") as HTMLElement).textContent).toMatch(
      /Gear inches/,
    );
  });

  it("greys out cross-chained gears (big-big / small-small)", () => {
    const { container } = render(<Drivetrain />);
    // default 50/34, 11-28: 50x28,50x24 and 34x11,34x12 are cross-chained
    const crossed = container.querySelectorAll(".gc-crossed");
    expect(crossed.length).toBe(4);
  });

  it("has the cadence control in the chart bar (not the setup section)", () => {
    const { container } = render(<Drivetrain />);
    const range = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(range).toBeTruthy();
    // it lives inside the gear chart's axis bar
    expect(container.querySelector(".gc-cadence input[type='range']")).toBeTruthy();
  });

  it("keeps section info in a popover revealed by the info icon", () => {
    const { container, getByText, queryByText } = render(<Drivetrain />);
    // Gears explanation is hidden until its info tip is opened
    expect(queryByText(/wheel-size-independent/)).toBeNull();
    const infoBtn = container.querySelector(".section-head .infotip-btn") as HTMLButtonElement;
    expect(infoBtn).toBeTruthy();
    fireEvent.click(infoBtn);
    expect(getByText(/wheel-size-independent/)).toBeTruthy();
  });

  it("renders a drivetrain diagram and moves the chain on gear hover", () => {
    const { container } = render(<Drivetrain />);
    expect(container.querySelector(".dt-diagram")).toBeTruthy();
    // hovering the first gear dot (50 x 28) updates the diagram caption
    const dot = container.querySelector(".gear-chart circle") as SVGCircleElement;
    fireEvent.mouseMove(dot, { clientX: 100, clientY: 100 });
    expect(container.querySelector(".dt-cap")?.textContent).toMatch(/50 × 28 · ratio/);
    // active gear is highlighted in the diagram
    expect(container.querySelectorAll(".dt-diagram .dt-gear-active").length).toBe(2);
  });

  it("shows a hover tooltip with a gear's exact values", () => {
    const { container } = render(<Drivetrain />);
    const dot = container.querySelector(".gc-dot") as SVGCircleElement;
    fireEvent.mouseEnter(dot, { clientX: 100, clientY: 100 });
    const tip = container.querySelector(".gc-tooltip");
    expect(tip).toBeTruthy();
    expect(tip!.textContent).toMatch(/Ratio/);
    expect(tip!.textContent).toMatch(/Gear inches/);
    expect(tip!.textContent).toMatch(/km\/h/);
  });

  it("fills the cassette field from the preset popup button", () => {
    const { getByTitle, getByText, container } = render(<Drivetrain />);
    fireEvent.click(getByTitle("Fill from a cassette preset"));
    fireEvent.click(getByText("12sp 10-52"));
    // The cogs text input should now hold the preset's tooth list.
    const cogs = Array.from(container.querySelectorAll('input[type="text"]')).find((i) =>
      (i as HTMLInputElement).value.includes("52"),
    ) as HTMLInputElement;
    expect(cogs).toBeTruthy();
  });

  it("fills the chainrings field from the common-crankset popup", () => {
    const { getByTitle, getByText, container } = render(<Drivetrain />);
    fireEvent.click(getByTitle("Fill from a common crankset"));
    fireEvent.click(getByText("Road standard 53/39"));
    const rings = Array.from(container.querySelectorAll('input[type="text"]')).find((i) =>
      (i as HTMLInputElement).value.startsWith("53"),
    ) as HTMLInputElement;
    expect(rings).toBeTruthy();
    expect(rings.value).toBe("53, 39");
  });

  it("shows chain length in mm and links for a derailleur setup", () => {
    const { getByText } = render(<Drivetrain />);
    // Default 50/34, 11-28, chainstay 410 -> 1346 mm / 106 links
    expect(getByText("1346 mm")).toBeTruthy();
    expect(getByText("106")).toBeTruthy();
  });

  it("checks a chosen rear derailleur against the drivetrain", () => {
    const { container } = render(<Drivetrain />);
    const derSelect = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.textContent?.includes("105 RD-R7000 SS")),
    ) as HTMLSelectElement;
    expect(derSelect).toBeTruthy();
    fireEvent.change(derSelect, { target: { value: "sh-105-r7000-ss" } });
    // default 50/34 + 11-28 -> required capacity 33T, largest cog 28T
    expect(container.textContent).toContain("Capacity needed");
    expect(container.textContent).toContain("33T");
  });

  it("flags a slightly-oversized cog as caution, not a hard failure", () => {
    const { container } = render(<Drivetrain />);
    // 1× 42 with an 11-32 keeps capacity small; 105 SS maxes at 30 -> 32 is +2T
    const texts = container.querySelectorAll('input[type="text"]');
    fireEvent.change(texts[0], { target: { value: "42" } });
    fireEvent.change(texts[1], { target: { value: "11, 32" } });
    const derSelect = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.textContent?.includes("105 RD-R7000 SS")),
    ) as HTMLSelectElement;
    fireEvent.change(derSelect, { target: { value: "sh-105-r7000-ss" } });
    expect(container.textContent).toContain("+2T over");
    expect(container.textContent).toMatch(/proceed with caution/);
  });

  it("flags slightly-over capacity as caution", () => {
    const { container } = render(<Drivetrain />);
    // 46/30 with 11-46: required 51T vs Deore M6000 rated 47T (+4T), cog 46 = max 46
    const texts = container.querySelectorAll('input[type="text"]');
    fireEvent.change(texts[0], { target: { value: "46, 30" } });
    fireEvent.change(texts[1], { target: { value: "11, 46" } });
    const derSelect = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.textContent?.includes("M6000")),
    ) as HTMLSelectElement;
    fireEvent.change(derSelect, { target: { value: "sh-deore-m6000-sgs" } });
    expect(container.textContent).toContain("+4T over");
    expect(container.textContent).toMatch(/proceed with caution/);
  });

  it("does not apply the derailleur chain-length formula to single speed", () => {
    const { container, getByText, queryByText } = render(<Drivetrain />);
    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "single" } });
    expect(queryByText("1346 mm")).toBeNull();
    expect(getByText(/dropout \/ tensioner/)).toBeTruthy();
  });

  it("shows only the matching chain-wear threshold for the drivetrain", () => {
    const { getByText, queryByText } = render(<Drivetrain />);
    // Default cassette has 10 cogs -> 6-10 speed -> 0.75%
    expect(getByText("6- to 10-speed")).toBeTruthy();
    expect(getByText("0.75%")).toBeTruthy();
    expect(queryByText("0.50%")).toBeNull();
    expect(queryByText("1.00%")).toBeNull();
  });

  it("offers narrow and wide chain options for single speed / hub", () => {
    const { container, getByText } = render(<Drivetrain />);
    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "single" } });
    expect(getByText(/narrow \(3\/32/)).toBeTruthy();
    expect(getByText(/wide \(1\/8/)).toBeTruthy();
    expect(getByText("1.00%")).toBeTruthy();
  });

  it("links to the tire calculator", () => {
    const { container } = render(<Drivetrain />);
    const link = container.querySelector('a[href="#/tire"]');
    expect(link).toBeTruthy();
  });
});
