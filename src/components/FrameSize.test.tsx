// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { FrameSize } from "./FrameSize";

afterEach(cleanup);

const resultValue = (container: HTMLElement, labelPrefix: string) =>
  Array.from(container.querySelectorAll(".result")).find((r) =>
    r.querySelector(".result-label")?.textContent?.startsWith(labelPrefix),
  )?.querySelector(".result-value")?.textContent ?? "";

// Method is the first native <select> on the page.
const setMethod = (container: HTMLElement, value: "fit" | "frame") => {
  const method = container.querySelector("select") as HTMLSelectElement;
  fireEvent.change(method, { target: { value } });
};

describe("Frame size page", () => {
  it("leads with reach & stack fit targets", () => {
    const { container, getByText } = render(<FrameSize />);
    expect(getByText("Fit targets — reach & stack")).toBeTruthy();
    expect(resultValue(container, "Reach")).toMatch(/\d+ mm/);
    expect(resultValue(container, "Stack")).toMatch(/\d+ mm/);
  });

  it("shows a nominal frame size that the bike category changes", () => {
    const { container, getByRole } = render(<FrameSize />);
    expect(getByRole("heading", { name: "Frame size" })).toBeTruthy();
    const road = resultValue(container, "Frame size");
    // Bike category is the last <select> in forward mode.
    const selects = container.querySelectorAll("select");
    fireEvent.change(selects[selects.length - 1] as HTMLSelectElement, {
      target: { value: "mtb" },
    });
    const mtb = resultValue(container, "Frame size");
    expect(road).not.toBe(mtb);
  });

  it("reverse mode resolves a frame size to a rider band", () => {
    const { container, getByText, queryByText } = render(<FrameSize />);
    setMethod(container, "frame");
    expect(queryByText("Fit targets — reach & stack")).toBeNull();
    expect(getByText("Who it fits")).toBeTruthy();
    const riderHeight = Array.from(container.querySelectorAll(".result")).find((r) =>
      r.querySelector(".result-label")?.textContent?.startsWith("Rider height"),
    );
    expect(riderHeight?.querySelector(".result-value")?.textContent).toMatch(/\d+–\d+ cm/);
  });
});
