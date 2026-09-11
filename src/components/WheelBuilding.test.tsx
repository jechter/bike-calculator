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

  it("plots the tension curve as a reading → tension graph", () => {
    const { container } = render(<WheelBuilding />);
    const chart = container.querySelector(".tc-chart");
    expect(chart).toBeTruthy();
    // the curve is drawn as a polyline
    expect(chart!.querySelector("polyline.tc-line")).toBeTruthy();
    // and there's an always-on readout in kgf and N (no type-in reading field)
    const readout = container.querySelector(".tc-readout")!;
    expect(readout.textContent).toMatch(/kgf · \d+ N/);
  });

  it("reads a value off the graph on hover/drag, in both kgf and N", () => {
    const { container } = render(<WheelBuilding />);
    const svg = container.querySelector(".tc-chart svg") as SVGSVGElement;
    // jsdom has no layout, so getBoundingClientRect is zero-sized; the pointer
    // handler falls back to the sticky mid-curve reading (21) -> 77 kgf -> 755 N.
    fireEvent.pointerMove(svg, { clientX: 300 });
    const tooltip = container.querySelector(".tc-tooltip")!;
    expect(tooltip.textContent).toMatch(/Reading 21\.0/);
    expect(tooltip.textContent).toMatch(/77 kgf · 755 N/);
  });

  it("picks a hub from the database, shows its name, and reverts on edit", () => {
    const { getByText, getByLabelText, container } = render(<WheelBuilding />);
    // trigger starts unset
    expect(getByText("Choose a hub…")).toBeTruthy();
    fireEvent.click(getByLabelText("Browse the hub database"));
    // pick a front hub with 38 mm flanges (default flanges are 45 mm)
    fireEvent.click(getByText("Shimano 105 HB-5501"));
    const flange = Array.from(container.querySelectorAll('input[type="number"]')).find(
      (i) => (i as HTMLInputElement).value === "38",
    ) as HTMLInputElement;
    expect(flange).toBeTruthy();
    // the trigger now reflects the chosen hub (popover closed, so it's the only match)
    expect(getByText("Shimano 105 HB-5501")).toBeTruthy();
    // editing a hub value clears the selection
    fireEvent.change(flange, { target: { value: "40" } });
    expect(getByText("Choose a hub…")).toBeTruthy();
  });

  it("assigns the spoke count from the hub and links to its source", () => {
    const { getByText, getByLabelText, container } = render(<WheelBuilding />);
    const inputWithValue = (v: string) =>
      Array.from(container.querySelectorAll('input[type="number"]')).find(
        (i) => (i as HTMLInputElement).value === v,
      ) as HTMLInputElement | undefined;
    // default spoke count is 32 (the only field at that value)
    expect(inputWithValue("32")).toBeTruthy();
    fireEvent.click(getByLabelText("Browse the hub database"));
    // Sachs Super 7 is drilled 36h only, so picking it moves the count to 36
    fireEvent.click(getByText("Sachs Super 7 (coaster)"));
    expect(inputWithValue("36")).toBeTruthy();
    expect(inputWithValue("32")).toBeFalsy();
    // a source link to the hub's provenance appears, opening in a new tab
    const link = container.querySelector("a.inline-link") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toContain("spocalc");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.textContent).toContain("Sachs Super 7");
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

  it("renders the wheel diagram with a build scrubber", () => {
    const { container } = render(<WheelBuilding />);
    expect(container.querySelector(".wheel-diagram")).toBeTruthy();
    const scrubber = container.querySelector(".wd-scrubber") as HTMLInputElement;
    expect(scrubber).toBeTruthy();
    expect(scrubber.max).toBe("32"); // one step per spoke, defaults to fully laced
    expect(scrubber.value).toBe("32");
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
    expect(container.textContent).toMatch(/divisible by 4/);
    // spoke length results show a dash rather than a bogus number
    const values = Array.from(container.querySelectorAll(".result-value")).map((n) => n.textContent);
    expect(values).toContain("—");
  });

  it("scrubs the build: the caption reflects the current step", () => {
    const { container } = render(<WheelBuilding />);
    const scrubber = container.querySelector(".wd-scrubber") as HTMLInputElement;
    const caption = () =>
      Array.from(container.querySelectorAll(".wd-caption")).map((n) => n.textContent).join(" ");
    // defaults to a fully laced 32h wheel
    expect(scrubber.max).toBe("32");
    expect(caption()).toMatch(/Fully laced · 32h/);
    // scrub part-way -> caption names the step and build group
    fireEvent.change(scrubber, { target: { value: "8" } });
    expect(caption()).toMatch(/Spoke 8 of 32/);
    // scrub to a bare rim
    fireEvent.change(scrubber, { target: { value: "0" } });
    expect(caption()).toMatch(/Bare rim/);
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

  it("updates the build range when the spoke count changes", () => {
    const { container } = render(<WheelBuilding />);
    const scrubber = () => container.querySelector(".wd-scrubber") as HTMLInputElement;
    expect(scrubber().max).toBe("32");
    const count = Array.from(container.querySelectorAll('input[type="number"]')).find(
      (i) => (i as HTMLInputElement).value === "32",
    ) as HTMLInputElement;
    expect(count).toBeTruthy();
    fireEvent.change(count, { target: { value: "24" } });
    expect(scrubber().max).toBe("24");
  });
});
