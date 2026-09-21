// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { FrameSize } from "./FrameSize";

afterEach(cleanup);

const frameValue = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".result")).find((r) =>
    r.querySelector(".result-label")?.textContent?.startsWith("Frame size"),
  )?.querySelector(".result-value")?.textContent ?? "";

// The Method control is a custom SwatchSelect (a button that opens a listbox),
// not a native <select> — open it and click the option whose label matches.
const selectMethod = (container: HTMLElement, label: string) => {
  const swatch = container.querySelector(".swatch-select") as HTMLElement;
  fireEvent.click(swatch.querySelector("button") as HTMLButtonElement);
  const option = Array.from(
    swatch.querySelectorAll('[role="option"] button'),
  ).find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
  fireEvent.click(option);
};

describe("Frame size page", () => {
  it("shows a single Recommendation section for both methods", () => {
    const { getAllByRole } = render(<FrameSize />);
    const recs = getAllByRole("heading", { name: "Recommendation" });
    expect(recs.length).toBe(1);
  });

  it("respects frame style when using body height", () => {
    const { container, getByText } = render(<FrameSize />);
    // switch method to Body height
    selectMethod(container, "Body height");
    const road = frameValue(container);
    // change style to Mountain (the style select is the last select)
    const selects = container.querySelectorAll("select");
    const styleSelect = selects[selects.length - 1] as HTMLSelectElement;
    fireEvent.change(styleSelect, { target: { value: "mtb" } });
    const mtb = frameValue(container);
    expect(road).not.toBe(mtb); // style is no longer ignored
    // and the estimated inseam is surfaced
    expect(getByText(/Est\. inseam/)).toBeTruthy();
  });

  it("reverse: a frame size resolves to a rider height band", () => {
    const { container, getByText, queryByText } = render(<FrameSize />);
    // pick the "Frame size" method (the reverse direction) from the Method menu
    selectMethod(container, "Frame size (seat tube");
    // the forward Recommendation is gone; the reverse "Who it fits" is shown
    expect(queryByText("Recommendation")).toBeNull();
    expect(getByText("Who it fits")).toBeTruthy();
    // the rider-height result is present and looks like a cm band
    const riderHeight = Array.from(container.querySelectorAll(".result")).find((r) =>
      r.querySelector(".result-label")?.textContent?.startsWith("Rider height"),
    );
    expect(riderHeight?.querySelector(".result-value")?.textContent).toMatch(/\d+–\d+ cm/);
  });
});
