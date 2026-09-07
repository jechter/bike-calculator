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
    const dots = Array.from(container.querySelectorAll(".gear-chart .gc-dot"));
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

  it("updates the diagram speed/ratio when hovering different hub gears", () => {
    const { container } = render(<Drivetrain />);
    const typeSelect = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "hub" } });
    // Default hub is a 3-speed (ratios 0.75 / 1.0 / 1.333) — all share the same
    // chainring/cog, so only the hub ratio distinguishes the gears.
    const dots = container.querySelectorAll(".gc-dot");
    expect(dots.length).toBeGreaterThanOrEqual(3);
    fireEvent.mouseMove(dots[0], { clientX: 100, clientY: 100 });
    const low = container.querySelector(".dt-cap")?.textContent;
    fireEvent.mouseMove(dots[dots.length - 1], { clientX: 300, clientY: 100 });
    const high = container.querySelector(".dt-cap")?.textContent;
    // Different hub gears -> different caption (ratio + speed change).
    expect(low).not.toBe(high);
    // Caption names the hub gear.
    expect(high).toMatch(/1st|2nd|3rd/);
  });

  it("highlights the currently visualized gear in the chart", () => {
    const { container } = render(<Drivetrain />);
    // One gear is shown in the diagram by default -> one halo in the chart.
    expect(container.querySelectorAll(".gc-dot-halo").length).toBe(1);
    // Hovering a different dot moves the highlight, still to exactly one gear.
    const dots = container.querySelectorAll(".gc-dot");
    fireEvent.mouseMove(dots[dots.length - 1], { clientX: 300, clientY: 100 });
    const halos = container.querySelectorAll(".gc-dot-halo");
    expect(halos.length).toBe(1);
  });

  it("shows ∞ gears and a continuous range bar for a CVT hub", () => {
    const { container, getByText } = render(<Drivetrain />);
    const selects = () => Array.from(container.querySelectorAll("select"));
    fireEvent.change(selects()[0], { target: { value: "hub" } });
    const maker = selects().find((s) =>
      Array.from(s.options).some((o) => o.value === "Enviolo"),
    ) as HTMLSelectElement;
    fireEvent.change(maker, { target: { value: "Enviolo" } });
    // CVT gear count is infinite, and the chart draws the thick range bar.
    expect(getByText("∞")).toBeTruthy();
    expect(container.querySelectorAll(".gc-row-line-cvt").length).toBe(1);
  });

  it("picks a hub in two steps: maker, then model sorted by speeds", () => {
    const { container } = render(<Drivetrain />);
    const selects = () => Array.from(container.querySelectorAll("select"));
    fireEvent.change(selects()[0], { target: { value: "hub" } });

    // The maker select defaults to the common 3-speed Sturmey-Archer.
    const maker = selects().find((s) =>
      Array.from(s.options).some((o) => o.value === "Shimano"),
    ) as HTMLSelectElement;
    expect(maker.value).toBe("Sturmey Archer");

    // Switching maker repopulates the model list, lowest-speed first.
    fireEvent.change(maker, { target: { value: "Shimano" } });
    const model = selects().find((s) =>
      Array.from(s.options).some((o) => /Inter 3/.test(o.textContent || "")),
    ) as HTMLSelectElement;
    const labels = Array.from(model.options).map((o) => o.textContent);
    expect(labels[0]).toMatch(/Inter 3 · 3-speed/);
    expect(labels[labels.length - 1]).toMatch(/Inter 11 · 11-speed/);
  });

  it("links the hub model (by name) to its ratio source", () => {
    const { container } = render(<Drivetrain />);
    const selects = Array.from(container.querySelectorAll("select"));
    fireEvent.change(selects[0], { target: { value: "hub" } });
    // Default hub is the Sturmey-Archer S3 -> the link is labelled with its name.
    const link = Array.from(container.querySelectorAll("a")).find((a) =>
      /Sturmey Archer S3/.test(a.textContent || ""),
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toMatch(/^https?:\/\//);
    expect(link.getAttribute("href")).toContain("sturmey-archer.com");
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

  const findSelectWithOption = (container: HTMLElement, pred: (label: string) => boolean) =>
    Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => pred(o.textContent ?? "")),
    ) as HTMLSelectElement;

  it("browses, filters, and fills cogs from the cassette picker", () => {
    const { container, getByTitle } = render(<Drivetrain />);
    fireEvent.click(getByTitle("Browse the cassette database"));
    // Filter brand → SRAM, speeds → 12-speed, range → 10-52.
    fireEvent.change(findSelectWithOption(container, (l) => l === "All brands"), {
      target: { value: "SRAM" },
    });
    fireEvent.change(findSelectWithOption(container, (l) => l === "All speeds"), {
      target: { value: "12" },
    });
    fireEvent.change(findSelectWithOption(container, (l) => l === "All ranges"), {
      target: { value: "10-52" },
    });
    // Click the first matching cassette row.
    const row = container.querySelector(".cp-list button") as HTMLButtonElement;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain("SRAM");
    fireEvent.click(row);
    const cogs = Array.from(container.querySelectorAll('input[type="text"]')).find((i) =>
      (i as HTMLInputElement).value.includes("52"),
    ) as HTMLInputElement;
    expect(cogs.value.startsWith("10, 12")).toBe(true);
    expect(cogs.value.endsWith("52")).toBe(true);
  });

  it("narrows the cassette list by the search box", () => {
    const { container, getByTitle, getByPlaceholderText } = render(<Drivetrain />);
    fireEvent.click(getByTitle("Browse the cassette database"));
    fireEvent.change(getByPlaceholderText("Search brand, model, cogs…"), {
      target: { value: "sram" },
    });
    const names = Array.from(container.querySelectorAll(".cp-list .cp-name"));
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => (n.textContent ?? "").startsWith("SRAM"))).toBe(true);
  });

  it("keeps the picked cassette highlighted even when models share the same cogs", () => {
    const { container, getByTitle } = render(<Drivetrain />);
    fireEvent.click(getByTitle("Browse the cassette database"));
    // Filter to the default 10sp 11-28 — Shimano CS-5700/6700/7900 share cogs.
    fireEvent.change(findSelectWithOption(container, (l) => l === "All brands"), {
      target: { value: "Shimano" },
    });
    fireEvent.change(findSelectWithOption(container, (l) => l === "All speeds"), {
      target: { value: "10" },
    });
    fireEvent.change(findSelectWithOption(container, (l) => l === "All ranges"), {
      target: { value: "11-28" },
    });
    const cs7900 = Array.from(container.querySelectorAll(".cp-list button")).find((b) =>
      b.textContent?.includes("CS-7900"),
    ) as HTMLButtonElement;
    expect(cs7900).toBeTruthy();
    fireEvent.click(cs7900);
    // Reopen (filters persist) — CS-7900 must be the highlighted row, not CS-5700.
    fireEvent.click(getByTitle("Browse the cassette database"));
    const active = container.querySelector(".cp-list button.active");
    expect(active?.textContent).toContain("CS-7900");
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

  it("warns when the derailleur's nominal speed count differs from the cassette", () => {
    const { container } = render(<Drivetrain />);
    // Default cassette has 10 cogs. Pick an 11-speed 105 RD-R7000 SS.
    const derSelect = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.textContent?.includes("105 RD-R7000 SS")),
    ) as HTMLSelectElement;
    fireEvent.change(derSelect, { target: { value: "sh-105-r7000-ss" } });
    expect(container.textContent).toMatch(/≠ 10-sp cassette/);
    expect(container.textContent).toMatch(/friction shifter/);
  });

  it("does not warn about speeds when the derailleur matches the cassette", () => {
    const { container } = render(<Drivetrain />);
    // 10-speed cassette + 10-speed Tiagra RD-4700 GS -> no speed warning.
    const derSelect = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.textContent?.includes("Tiagra RD-4700 GS")),
    ) as HTMLSelectElement;
    fireEvent.change(derSelect, { target: { value: "sh-tiagra-4700-gs" } });
    expect(container.textContent).not.toMatch(/friction shifter/);
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

  it("fills the rolling circumference from a typed tire size in the picker", () => {
    const { getByText, getByPlaceholderText } = render(<Drivetrain />);
    const field = getByText("Rolling circumference (mm)").closest(".field") as HTMLElement;
    const circInput = field.querySelector('input[type="number"]') as HTMLInputElement;
    expect(circInput.value).toBe("2111"); // default

    fireEvent.click(within(field).getByText(/Tire size/));
    const search = getByPlaceholderText(/700x28C/) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "700x28C" } });
    // Geometric circumference: pi * (622 + 2*28) = 2130 mm.
    fireEvent.click(getByText(/Use ≈ 2130 mm/));
    expect(circInput.value).toBe("2130");
  });

  it("applies a suggested tire size directly from the picker", () => {
    const { getByText } = render(<Drivetrain />);
    const field = getByText("Rolling circumference (mm)").closest(".field") as HTMLElement;
    const circInput = field.querySelector('input[type="number"]') as HTMLInputElement;

    fireEvent.click(within(field).getByText(/Tire size/));
    // "26x2.1" is in the default broad spread: pi * (559 + 2*53.34) = 2091 mm.
    fireEvent.click(within(field).getByText("26x2.1"));
    expect(circInput.value).toBe("2091");
  });

  it("adds a second drivetrain to compare and overlays it on the chart", () => {
    const { container, getByText } = render(<Drivetrain />);
    // Off by default: only config A rows (50/34 -> 2 lines), no compared series.
    expect(container.querySelectorAll(".gc-row-line").length).toBe(2);
    expect(container.querySelector(".gc-row-line-b")).toBeNull();

    fireEvent.click(getByText(/Compare a second drivetrain/));
    // Two setup panels now.
    expect(getByText("Drivetrain A")).toBeTruthy();
    expect(getByText("Drivetrain B")).toBeTruthy();
    // A (50/34 -> 2) + B (46/30 -> 2) = 4 rows; 2 of them are the hollow B rows.
    expect(container.querySelectorAll(".gc-row-line").length).toBe(4);
    expect(container.querySelectorAll(".gc-row-line-b").length).toBe(2);
    // both configs' ranges are summarised
    expect(container.textContent).toContain("A: gears / range");
    expect(container.textContent).toContain("B: gears / range");
  });

  it("gives each drivetrain its own rolling circumference when comparing", () => {
    const { getByText, getAllByText, queryAllByText } = render(<Drivetrain />);
    // One wheel field on its own; a second appears for drivetrain B.
    expect(queryAllByText("Rolling circumference (mm)").length).toBe(1);
    fireEvent.click(getByText(/Compare a second drivetrain/));
    expect(getAllByText("Rolling circumference (mm)").length).toBe(2);
  });

  it("switches the detail sections between drivetrain A and B", () => {
    const { container, getByText } = render(<Drivetrain />);
    fireEvent.click(getByText(/Compare a second drivetrain/));
    // Focused on A: chain length uses A's 50/34 + 11-28 -> 1346 mm.
    expect(getByText("1346 mm")).toBeTruthy();
    // Switch the detail focus to B (46/30 + 11-42) and the chain length changes.
    const seg = container.querySelector(".dt-focus-seg") as HTMLElement;
    fireEvent.click(within(seg).getByText("B"));
    expect(container.querySelector(".dt-focus-seg button.active")?.textContent).toBe("B");
    expect(container.textContent).not.toContain("1346 mm");
  });

  it("switches the focused drivetrain when hovering the other one's gear", () => {
    const { container, getByText } = render(<Drivetrain />);
    fireEvent.click(getByText(/Compare a second drivetrain/));
    // Focus starts on A.
    expect(container.querySelector(".dt-focus-seg button.active")?.textContent).toBe("A");
    // Rows are laid out A first then B, so the last dot belongs to a B row.
    const dots = container.querySelectorAll(".gc-dot");
    fireEvent.mouseMove(dots[dots.length - 1], { clientX: 100, clientY: 100 });
    expect(container.querySelector(".dt-focus-seg button.active")?.textContent).toBe("B");
  });

  it("removes the comparison again", () => {
    const { container, getByText, queryByText } = render(<Drivetrain />);
    fireEvent.click(getByText(/Compare a second drivetrain/));
    expect(queryByText("Drivetrain B")).toBeTruthy();
    fireEvent.click(getByText(/Remove comparison/));
    expect(queryByText("Drivetrain B")).toBeNull();
    expect(container.querySelectorAll(".gc-row-line").length).toBe(2);
  });
});
