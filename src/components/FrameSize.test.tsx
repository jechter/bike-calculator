// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { FrameSize } from "./FrameSize";

afterEach(cleanup);

const frameValue = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".result")).find((r) =>
    r.querySelector(".result-label")?.textContent?.startsWith("Frame size"),
  )?.querySelector(".result-value")?.textContent ?? "";

describe("Frame size page", () => {
  it("shows a single Recommendation section for both methods", () => {
    const { getAllByRole } = render(<FrameSize />);
    const recs = getAllByRole("heading", { name: "Recommendation" });
    expect(recs.length).toBe(1);
  });

  it("respects frame style when using body height", () => {
    const { container, getByText } = render(<FrameSize />);
    // switch method to Body height (the Method select is the first select)
    const methodSelect = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(methodSelect, { target: { value: "height" } });
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
    const methodSelect = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(methodSelect, { target: { value: "frameSize" } });
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
