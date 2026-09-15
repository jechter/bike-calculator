// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, within } from "@testing-library/react";
import { Drivetrain } from "./Drivetrain";

afterEach(cleanup);

// Drive the derailleur picker popover: open it, type a search, then click the
// first list row whose text matches `rowMatch`.
function pickDerailleur(
  container: HTMLElement,
  search: string,
  rowMatch: (text: string) => boolean,
) {
  const openBtn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("— unspecified —"),
  ) as HTMLButtonElement;
  fireEvent.click(openBtn);
  const searchInput = container.querySelector(".cp-search") as HTMLInputElement;
  fireEvent.change(searchInput, { target: { value: search } });
  const row = Array.from(container.querySelectorAll(".cp-list button")).find((b) =>
    rowMatch(b.textContent ?? ""),
  ) as HTMLButtonElement;
  fireEvent.click(row);
}

// Drive the hub picker popover (hub mode must already be selected): open it,
// type a search, then click the first list row whose text matches `rowMatch`.
function pickHub(container: HTMLElement, search: string, rowMatch: (text: string) => boolean) {
  const openBtn = container.querySelector(
    '[title="Browse the hub database"]',
  ) as HTMLButtonElement;
  fireEvent.click(openBtn);
  const pop = openBtn.closest(".cassette-picker") as HTMLElement;
  fireEvent.change(pop.querySelector(".cp-search") as HTMLInputElement, {
    target: { value: search },
  });
  const row = Array.from(pop.querySelectorAll(".cp-list button")).find((b) =>
    rowMatch(b.textContent ?? ""),
  ) as HTMLButtonElement;
  fireEvent.click(row);
}

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
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "hub" },
    });
    // Pick a CVT (continuously-variable) hub from the picker.
    pickHub(container, "enviolo", (t) => /Enviolo/i.test(t));
    // CVT gear count is infinite, and the chart draws the thick range bar.
    expect(getByText("∞")).toBeTruthy();
    expect(container.querySelectorAll(".gc-row-line-cvt").length).toBe(1);
  });

  it("picks a hub from a single searchable popover, filterable by maker", () => {
    const { container } = render(<Drivetrain />);
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "hub" },
    });
    // The trigger shows the current hub (the default Sturmey-Archer S3).
    const trigger = container.querySelector(
      '[title="Browse the hub database"]',
    ) as HTMLButtonElement;
    expect(trigger.textContent).toMatch(/Sturmey Archer S3/);

    // Open and filter to Shimano; the list narrows to that maker, speed-sorted.
    fireEvent.click(trigger);
    const pop = trigger.closest(".cassette-picker") as HTMLElement;
    const makerSelect = Array.from(pop.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.value === "Shimano"),
    ) as HTMLSelectElement;
    fireEvent.change(makerSelect, { target: { value: "Shimano" } });
    const names = Array.from(pop.querySelectorAll(".cp-list .cp-name")).map((n) => n.textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => /^Shimano/.test(n ?? ""))).toBe(true);
    // Speed-sorted within the maker: Inter 3 before Inter 11.
    expect(names[0]).toMatch(/Inter 3$/);
    expect(names[names.length - 1]).toMatch(/Inter 11$/);

    // Picking a row updates the trigger to that hub.
    const row = Array.from(pop.querySelectorAll(".cp-list button")).find((b) =>
      /Inter 11/.test(b.textContent ?? ""),
    ) as HTMLButtonElement;
    fireEvent.click(row);
    expect(trigger.textContent).toMatch(/Shimano Inter 11/);
  });

  it("filters the hub picker by gear count", () => {
    const { container } = render(<Drivetrain />);
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "hub" },
    });
    const trigger = container.querySelector(
      '[title="Browse the hub database"]',
    ) as HTMLButtonElement;
    fireEvent.click(trigger);
    const pop = trigger.closest(".cassette-picker") as HTMLElement;
    // The third filter is the gear-count select; narrow it to 3-speed hubs.
    const gearsSelect = Array.from(pop.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.textContent === "3-speed"),
    ) as HTMLSelectElement;
    fireEvent.change(gearsSelect, { target: { value: "3" } });
    const metas = Array.from(pop.querySelectorAll(".cp-list .cp-meta")).map((n) => n.textContent);
    expect(metas.length).toBeGreaterThan(0);
    expect(metas.every((m) => /^3-speed/.test(m ?? ""))).toBe(true);
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

  it("auto-shows a derailleur + cassette row only for a derailleur-compatible hub", () => {
    const { container, getByText, queryByText } = render(<Drivetrain />);
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "hub" },
    });
    // The default hub (Sturmey-Archer S3) is a plain hub → no combo, no note.
    expect(queryByText(/designed to be combined with a derailleur/)).toBeNull();
    expect(queryByText("Rear derailleur")).toBeNull();
    // Pick Classified (Powershift): a derailleur-compatible hub reveals the note
    // plus the derailleur + cassette fields automatically (no checkbox).
    pickHub(container, "classified", (t) => /Classified/i.test(t));
    expect(getByText(/designed to be combined with a derailleur/)).toBeTruthy();
    expect(getByText("Rear derailleur")).toBeTruthy();
    expect(container.querySelector('[title="Browse the cassette database"]')).toBeTruthy();
  });

  it("groups a hub+cassette combo into one chart row per hub gear", () => {
    const { container } = render(<Drivetrain />);
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "hub" },
    });
    pickHub(container, "classified", (t) => /Classified/i.test(t));
    // Classified Powershift is 2-speed; the default cassette has 10 cogs →
    // 2 hub-gear rows × 10 cogs = 20 dots, and the range multiplies the two.
    expect(container.querySelectorAll(".gc-row-line").length).toBe(2);
    expect(container.querySelectorAll(".gc-dot").length).toBe(20);
    // Rows are labelled by hub gear (1st / 2nd), not by chainring tooth count.
    const rowLabels = Array.from(container.querySelectorAll(".gc-row-label")).map(
      (n) => n.textContent,
    );
    expect(rowLabels).toContain("1st");
    expect(rowLabels).toContain("2nd");
    expect(rowLabels.every((l) => !/T$/.test(l ?? ""))).toBe(true);
  });

  it("swaps chain length for belt sizing (and drops chain wear) in belt mode", () => {
    const { container, getByText, queryByText } = render(<Drivetrain />);
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "single" },
    });
    // Chain mode: the wrap note and the chain-wear ("when to replace") table.
    expect(getByText(/dropout \/ tensioner/)).toBeTruthy();
    expect(getByText(/When to replace/)).toBeTruthy();
    // Switch the transmission select (the one offering a belt) to Gates belt.
    const beltSelect = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.textContent === "Gates carbon belt"),
    ) as HTMLSelectElement;
    expect(beltSelect).toBeTruthy();
    fireEvent.change(beltSelect, { target: { value: "belt" } });
    // Now it's a belt: belt sizing shown, no chain-wear table, no wrap note.
    expect(getByText(/Ideal belt/)).toBeTruthy();
    expect(queryByText(/When to replace/)).toBeNull();
    expect(queryByText(/dropout \/ tensioner/)).toBeNull();
    // The nearby-belt table lists catalogued sizes with centre distances.
    expect(getByText("Centre distance")).toBeTruthy();
    expect(container.textContent).toMatch(/\bT ✓/);
  });

  it("warns when no stock belt fits the chainstay (too short/long for any size)", () => {
    const { container, getByText, queryByText } = render(<Drivetrain />);
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "single" },
    });
    const beltSelect = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.textContent === "Gates carbon belt"),
    ) as HTMLSelectElement;
    fireEvent.change(beltSelect, { target: { value: "belt" } });
    // Default 42/18 at 410 mm: the nearest belt is ~17 mm off — within a frame's
    // adjustment, so no warning.
    expect(queryByText(/No stock Gates belt fits/)).toBeNull();
    // Drop to a very short chainstay: even the smallest belt now needs a centre
    // distance far beyond what any dropout/EBB could take up.
    const cs = container.querySelector(
      'input[aria-label="Chainstay length"]',
    ) as HTMLInputElement;
    fireEvent.change(cs, { target: { value: "350" } });
    expect(getByText(/No stock Gates belt fits/)).toBeTruthy();
    // The option table is still shown (so you can see how far off each size is).
    expect(getByText("Centre distance")).toBeTruthy();
  });

  it("draws belt sprockets ~13% smaller than chain sprockets (11 vs 12.7 mm pitch)", () => {
    const { container } = render(<Drivetrain />);
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "single" },
    });
    const activeRadii = () =>
      Array.from(container.querySelectorAll(".dt-gear-active")).map((c) =>
        parseFloat(c.getAttribute("r") || "0"),
      );
    const chainRadii = activeRadii();
    expect(chainRadii.length).toBe(2); // ring + cog
    const beltSelect = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.textContent === "Gates carbon belt"),
    ) as HTMLSelectElement;
    fireEvent.change(beltSelect, { target: { value: "belt" } });
    const beltRadii = activeRadii();
    for (let i = 0; i < chainRadii.length; i++) {
      expect(beltRadii[i]).toBeCloseTo(chainRadii[i] * (11 / 12.7), 3);
    }
  });

  it("shows a minimum single-speed chain length in chain mode", () => {
    const { container, getByText } = render(<Drivetrain />);
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "single" },
    });
    // Alongside the wrap note, chain mode now reports the shortest chain that fits.
    expect(getByText("Minimum links")).toBeTruthy();
    expect(getByText(/extra-long chain/)).toBeTruthy();
  });

  it("applies the derailleur chain-length formula to a hub+cassette combo", () => {
    const { container, getByText, queryByText } = render(<Drivetrain />);
    fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
      target: { value: "hub" },
    });
    // A plain hub uses the dropout/tensioner note, not the derailleur formula.
    expect(getByText(/dropout \/ tensioner/)).toBeTruthy();
    pickHub(container, "classified", (t) => /Classified/i.test(t));
    // With a derailleur + cassette the chain-length result appears (mm/links).
    expect(queryByText(/dropout \/ tensioner/)).toBeNull();
    expect(getByText("Links")).toBeTruthy();
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
    // Shimano RD-R7000 (105) SS, 11sp, max 30T, cap 35T.
    pickDerailleur(container, "R7000", (t) => t.includes(" SS "));
    // default 50/34 + 11-28 -> required capacity 33T, largest cog 28T
    expect(container.textContent).toContain("Capacity needed");
    expect(container.textContent).toContain("33T");
  });

  it("selects the rear derailleur in the Setup section", () => {
    const { getByText, container } = render(<Drivetrain />);
    // The picker lives under the Setup section's own field, not the fit section.
    const field = getByText("Rear derailleur").closest(".field") as HTMLElement;
    expect(field).toBeTruthy();
    expect(field.closest(".section")?.querySelector("h3")?.textContent).toBe("Setup");
    // No fit section until a derailleur is picked.
    expect(container.textContent).not.toContain("Capacity needed");
    pickDerailleur(container, "R7000", (t) => t.includes(" SS "));
    expect(container.textContent).toContain("Capacity needed");
  });

  it("links the Setup field hint to the derailleur's specs once picked", () => {
    const { getByText, container } = render(<Drivetrain />);
    const field = getByText("Rear derailleur").closest(".field") as HTMLElement;
    // Before selection: the optional note, no link.
    expect(field.querySelector(".field-hint a")).toBeNull();
    expect(field.textContent).toContain("Optional");
    // After selection: the hint becomes an external link to the spec source.
    pickDerailleur(container, "R7000", (t) => t.includes(" SS "));
    const link = field.querySelector(".field-hint a") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toContain("RD-R7000");
    expect(link.getAttribute("href")).toMatch(/^https?:\/\//);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("summarizes the derailleur fit in the Gears section", () => {
    const { container, getByText } = render(<Drivetrain />);
    // 10-speed Tiagra RD-4700 GS on the default 10-speed 50/34 + 11-28 is a
    // clean native match -> a green "fits" badge in Gears.
    pickDerailleur(container, "4700", (t) => t.includes(" GS "));
    const fitCard = getByText("Derailleur fit").closest(".result") as HTMLElement;
    expect(fitCard).toBeTruthy();
    const badge = fitCard.querySelector(".badge") as HTMLElement;
    expect(badge.className).toContain("ok");
    expect(badge.textContent).toBe("fits");
  });

  it("dots each cassette in the picker by fit, best fit first, once a derailleur is chosen", () => {
    const { container, getByTitle } = render(<Drivetrain />);
    // No derailleur yet -> the cassette picker has no fit dots.
    fireEvent.click(getByTitle("Browse the cassette database"));
    expect(container.querySelectorAll(".cp-list .cp-fit-dot").length).toBe(0);
    // Close it, pick an 11-speed SS derailleur (max 30T), reopen the picker.
    fireEvent.click(getByTitle("Browse the cassette database"));
    pickDerailleur(container, "R7000", (t) => t.includes(" SS "));
    fireEvent.click(getByTitle("Browse the cassette database"));
    const dots = Array.from(container.querySelectorAll(".cp-list .cp-fit-dot"));
    expect(dots.length).toBeGreaterThan(0);
    // Fitting cassettes float to the top: the first dot is green, and no
    // incompatible dot appears before the first fitting one.
    const level = (d: Element) =>
      d.classList.contains("ok") ? "ok" : d.classList.contains("caution") ? "caution" : "incompatible";
    const levels = dots.map(level);
    expect(levels[0]).toBe("ok");
    const firstIncompat = levels.indexOf("incompatible");
    if (firstIncompat !== -1) expect(firstIncompat).toBeGreaterThan(levels.indexOf("ok"));
    // Narrowing to big-cog 12-speed cassettes surfaces incompatible (red) dots.
    fireEvent.change(container.querySelector(".cp-search") as HTMLInputElement, {
      target: { value: "52" },
    });
    expect(container.querySelector(".cp-list .cp-fit-dot.incompatible")).toBeTruthy();
    // The legend names the derailleur being compared against.
    expect(container.querySelector(".cp-legend")?.textContent).toContain("RD-R7000");
  });

  it("warns when the derailleur's nominal speed count differs from the cassette", () => {
    const { container } = render(<Drivetrain />);
    // Default cassette has 10 cogs. Pick an 11-speed MTB XT RD-M8000 — its
    // actuation family (11/12) excludes 10, so it's a friction-shifter mismatch.
    pickDerailleur(container, "M8000", (t) => t.includes(" SGS "));
    expect(container.textContent).toMatch(/≠ 10-sp/);
    expect(container.textContent).toMatch(/friction shifter/);
  });

  it("says an electronic derailleur can't be re-indexed for a different cog count", () => {
    const { container } = render(<Drivetrain />);
    // Default cassette is 10-speed; pick an electronic 12-speed (SRAM AXS).
    pickDerailleur(container, "axs", (t) => t.includes("12sp"));
    expect(container.textContent).toMatch(/won.t work/);
    expect(container.textContent).not.toMatch(/friction shifter/);
  });

  it("does not warn about speeds when the derailleur matches the cassette", () => {
    const { container } = render(<Drivetrain />);
    // 10-speed cassette + 10-speed Tiagra RD-4700 GS -> no speed warning.
    pickDerailleur(container, "4700", (t) => t.includes(" GS "));
    expect(container.textContent).not.toMatch(/friction shifter/);
  });

  it("shows a shifter selection once a derailleur is chosen, defaulting to its match", () => {
    const { container, queryByText } = render(<Drivetrain />);
    // No shifter field until a derailleur is picked.
    expect(queryByText("Shifter")).toBeNull();
    // 10-speed Tiagra RD-4700 -> a default 10-speed indexed shifter that matches.
    pickDerailleur(container, "4700", (t) => t.includes(" GS "));
    // "Shifter" now labels both the Setup field and the fit-section Result; the
    // picker lives under Setup.
    const setup = container.querySelector(".section") as HTMLElement;
    const field = within(setup).getByText("Shifter").closest(".field") as HTMLElement;
    expect(field.closest(".section")?.querySelector("h3")?.textContent).toBe("Setup");
    // Indexed: a family select + a speed-count select, seeded to 10-speed.
    const selects = field.querySelectorAll<HTMLSelectElement>(".shifter-field select");
    expect(selects.length).toBe(2);
    expect(selects[0].value).toContain("Tiagra 4700");
    expect(selects[1].value).toBe("10");
  });

  it("lets the shifter selection flip the fit verdict (friction rescues a count mismatch)", () => {
    const { container, getByText } = render(<Drivetrain />);
    // 11-speed MTB XT RD-M8000 on the default 10-speed cassette: its default
    // 11-speed indexed shifter can't index 10 cogs -> out of range.
    pickDerailleur(container, "M8000", (t) => t.includes(" SGS "));
    let badge = getByText("Derailleur fit").closest(".result")!.querySelector(".badge")!;
    // A speed/actuation mismatch reads as "indexing mismatch", not "out of range".
    expect(badge.textContent).toBe("indexing mismatch");
    // Switch the family select to Friction -> positions any cog count by feel ->
    // fits (cog clearance and capacity still pass), and the speed select drops.
    const familySelect = container.querySelector(".shifter-field select") as HTMLSelectElement;
    fireEvent.change(familySelect, { target: { value: "Friction" } });
    expect(container.querySelectorAll(".shifter-field select").length).toBe(1);
    badge = getByText("Derailleur fit").closest(".result")!.querySelector(".badge")!;
    expect(badge.textContent).toBe("fits");
  });

  it("says out of range (not indexing) when the cog is physically too big", () => {
    const { container, getByText } = render(<Drivetrain />);
    // 1×42 with an 11-40 on an 11-speed SS (max 30T): cog is way over -> a
    // physical range problem, even though the shifter count still matches.
    const texts = container.querySelectorAll('input[type="text"]');
    fireEvent.change(texts[0], { target: { value: "42" } });
    fireEvent.change(texts[1], { target: { value: "11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 40" } });
    pickDerailleur(container, "R7000", (t) => t.includes(" SS "));
    const badge = getByText("Derailleur fit").closest(".result")!.querySelector(".badge")!;
    expect(badge.textContent).toBe("out of range");
  });

  it("hides the speed picker for single-speed families and for unspecified", () => {
    const { container } = render(<Drivetrain />);
    pickDerailleur(container, "R7000", (t) => t.includes(" SS "));
    const familySelect = () => container.querySelector(".shifter-field select") as HTMLSelectElement;
    // A family with one supported speed (Shimano road 12-speed) -> no speed picker.
    fireEvent.change(familySelect(), { target: { value: "Shimano road 12-speed" } });
    expect(container.querySelectorAll(".shifter-field select").length).toBe(1);
    // Other / unspecified -> no speed picker, and shifting isn't checked.
    fireEvent.change(familySelect(), { target: { value: "" } });
    expect(container.querySelectorAll(".shifter-field select").length).toBe(1);
    expect(container.textContent).toMatch(/can.t be checked/);
  });

  it("flags a slightly-oversized cog as caution, not a hard failure", () => {
    const { container } = render(<Drivetrain />);
    // 1× 42 with an 11-32 keeps capacity small; R7000 SS maxes at 30 -> 32 is +2T
    const texts = container.querySelectorAll('input[type="text"]');
    fireEvent.change(texts[0], { target: { value: "42" } });
    fireEvent.change(texts[1], { target: { value: "11, 32" } });
    pickDerailleur(container, "R7000", (t) => t.includes(" SS "));
    expect(container.textContent).toContain("+2T over");
    expect(container.textContent).toMatch(/proceed with caution/);
  });

  it("flags slightly-over capacity as caution", () => {
    const { container } = render(<Drivetrain />);
    // 46/30 with 11-46: required 51T vs XT RD-M8000 SGS rated 47T (+4T), cog 46 = max 46
    const texts = container.querySelectorAll('input[type="text"]');
    fireEvent.change(texts[0], { target: { value: "46, 30" } });
    fireEvent.change(texts[1], { target: { value: "11, 46" } });
    pickDerailleur(container, "M8000", (t) => t.includes(" SGS "));
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

  it("links to the tire calculator, carrying the selected tire size", () => {
    const { container } = render(<Drivetrain />);
    // Default is ETRTO 25-622, so the link seeds the Tire calculator with it.
    const link = container.querySelector('a[href^="#/tire"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("#/tire?size=25-622");
    expect(link.textContent).toContain("25-622");
  });

  it("drops the tire-size param after a manual circumference edit", () => {
    const { getByText } = render(<Drivetrain />);
    const field = getByText("Rolling circumference (mm)").closest(".field") as HTMLElement;
    const circInput = field.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(circInput, { target: { value: "2200" } });
    const link = field.querySelector("a.inline-link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("#/tire");
    expect(link.textContent).not.toContain("25-622");
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
    // The Tire-calculator link now carries the picked size, in href and label.
    const link = field.querySelector("a.inline-link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("#/tire?size=700x28C");
    expect(link.textContent).toContain("700x28C");
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
    // A (50/34 -> 2) + B (copied from A -> 2) = 4 rows; 2 are the hollow B rows.
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

  it("seeds the second drivetrain with a copy of the first", () => {
    const { container, getByText } = render(<Drivetrain />);
    // Move A off its defaults first.
    const aTexts = container.querySelectorAll('input[type="text"]');
    fireEvent.change(aTexts[0], { target: { value: "52, 36" } });
    fireEvent.change(aTexts[1], { target: { value: "11, 25" } });
    fireEvent.click(getByText(/Compare a second drivetrain/));
    // B's panel starts as an exact copy of A.
    const bPanel = container.querySelector(".dt-config-b") as HTMLElement;
    const bTexts = bPanel.querySelectorAll('input[type="text"]');
    expect((bTexts[0] as HTMLInputElement).value).toBe("52, 36");
    expect((bTexts[1] as HTMLInputElement).value).toBe("11, 25");
  });

  it("switches the detail sections between drivetrain A and B", () => {
    const { container, getByText } = render(<Drivetrain />);
    fireEvent.click(getByText(/Compare a second drivetrain/));
    // Focused on A: chain length uses A's 50/34 + 11-28 -> 1346 mm (B copies it).
    expect(getByText("1346 mm")).toBeTruthy();
    // Change B so it differs from A, then switch the detail focus to B.
    const bPanel = container.querySelector(".dt-config-b") as HTMLElement;
    const bTexts = bPanel.querySelectorAll('input[type="text"]');
    fireEvent.change(bTexts[0], { target: { value: "40" } });
    fireEvent.change(bTexts[1], { target: { value: "11, 42" } });
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
