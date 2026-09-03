// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Tire } from "./Tire";

afterEach(cleanup);

describe("Tire converter", () => {
  it("converts a French designation to ETRTO and fractional", () => {
    const { container, getByText } = render(<Tire />); // defaults to 700x28C
    expect(container.textContent).toContain("28-622");
    expect(container.textContent).toContain("700 × 28C");
    expect(container.textContent).toContain("28 × 1 1/8″");
    expect(getByText(/also known as/)).toBeTruthy();
  });

  it("accepts an inch/ETRTO input and updates", () => {
    const { container } = render(<Tire />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "26x2.1" } });
    expect(container.textContent).toContain("53-559");
  });

  it("uses the entered tire width for the pressure recommendation", () => {
    const { container } = render(<Tire />); // 700x28C
    expect(container.querySelector(".static-value")?.textContent).toBe("28 mm");
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "700x45C" } });
    expect(container.querySelector(".static-value")?.textContent).toBe("45 mm");
  });

  it("shows a hint for unrecognized input", () => {
    const { container, getByText } = render(<Tire />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "banana" } });
    expect(getByText(/Couldn't read that/)).toBeTruthy();
  });
});
