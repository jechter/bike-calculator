// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { FrameSize } from "./FrameSize";

afterEach(cleanup);

// The editable NumberInput inside the .field whose label contains `labelText`.
const fieldInput = (container: HTMLElement, labelText: string) => {
  const field = Array.from(container.querySelectorAll(".field")).find((f) =>
    f.querySelector(".field-label")?.textContent?.includes(labelText),
  );
  return field?.querySelector("input[type=number]") as HTMLInputElement;
};

// The category picker is the <select> that offers a mountain-bike option.
const categorySelect = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("select")).find((s) =>
    s.querySelector('option[value="mtb"]'),
  ) as HTMLSelectElement;

describe("Frame size page", () => {
  it("presents every measurement as one editable, linked model", () => {
    const { container, getByRole } = render(<FrameSize />);
    expect(getByRole("heading", { name: "Rider" })).toBeTruthy();
    expect(getByRole("heading", { name: "Bike" })).toBeTruthy();
    // Body height, frame size, reach and stack are all editable fields.
    for (const label of ["Body height", "Frame size", "Reach", "Stack"]) {
      expect(fieldInput(container, label)).toBeTruthy();
    }
  });

  it("seeds each field with a greyed estimate before anything is typed", () => {
    const { container } = render(<FrameSize />);
    const height = fieldInput(container, "Body height");
    expect(height.value).toBe(""); // empty → shows the placeholder
    expect(height.placeholder).toMatch(/≈ \d+/);
    expect(fieldInput(container, "Frame size").placeholder).toMatch(/≈ \d+/);
  });

  it("fills the frame size from a typed body height (rider → frame)", () => {
    const { container } = render(<FrameSize />);
    const frameBefore = fieldInput(container, "Frame size").placeholder;
    fireEvent.change(fieldInput(container, "Body height"), { target: { value: "160" } });
    const frameAfter = fieldInput(container, "Frame size").placeholder;
    expect(frameAfter).not.toBe(frameBefore); // a shorter rider → a smaller frame
  });

  it("works back from a typed frame size to a proposed body height (frame → rider)", () => {
    const { container } = render(<FrameSize />);
    const heightBefore = fieldInput(container, "Body height").placeholder;
    fireEvent.change(fieldInput(container, "Frame size"), { target: { value: "50" } });
    const heightAfter = fieldInput(container, "Body height").placeholder;
    expect(heightAfter).not.toBe(heightBefore); // frame proposes a new height
  });

  it("changes the resolved frame size when the bike category changes", () => {
    const { container } = render(<FrameSize />);
    const road = fieldInput(container, "Frame size").placeholder;
    fireEvent.change(categorySelect(container), { target: { value: "mtb" } });
    const mtb = fieldInput(container, "Frame size").placeholder;
    expect(road).not.toBe(mtb);
  });

  it("keeps every value you enter — nothing is cleared", () => {
    const { container } = render(<FrameSize />);
    fireEvent.change(fieldInput(container, "Body height"), { target: { value: "178" } });
    fireEvent.change(fieldInput(container, "Cycling inseam"), { target: { value: "82" } });
    fireEvent.change(fieldInput(container, "Reach"), { target: { value: "400" } });
    fireEvent.change(fieldInput(container, "Stack"), { target: { value: "600" } });
    expect(fieldInput(container, "Body height").value).toBe("178");
    expect(fieldInput(container, "Cycling inseam").value).toBe("82");
    expect(fieldInput(container, "Reach").value).toBe("400");
    expect(fieldInput(container, "Stack").value).toBe("600");
  });

  it("resets one field to its estimate via the × button", () => {
    const { container } = render(<FrameSize />);
    const height = fieldInput(container, "Body height");
    fireEvent.change(height, { target: { value: "165" } });
    expect(height.value).toBe("165");
    const clear = height
      .closest(".number-input")!
      .querySelector(".number-clear") as HTMLButtonElement;
    fireEvent.click(clear);
    expect(fieldInput(container, "Body height").value).toBe(""); // back to the estimate
  });

  it("resets everything with Clear all", () => {
    const { container, getByText } = render(<FrameSize />);
    fireEvent.change(fieldInput(container, "Body height"), { target: { value: "165" } });
    fireEvent.change(fieldInput(container, "Reach"), { target: { value: "410" } });
    fireEvent.click(getByText("Clear all"));
    expect(fieldInput(container, "Body height").value).toBe("");
    expect(fieldInput(container, "Reach").value).toBe("");
  });
});
