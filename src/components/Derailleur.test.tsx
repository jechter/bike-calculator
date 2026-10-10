// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Derailleur } from "./Derailleur";

afterEach(cleanup);

describe("Derailleur database page", () => {
  it("filters the database by search", () => {
    const { container } = render(<Derailleur />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    const dbTable = container.querySelectorAll(".table-wrap")[0];
    const allRows = dbTable.querySelectorAll("tbody tr").length;
    fireEvent.change(input, { target: { value: "eagle" } });
    const rows = dbTable.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(allRows);
    expect(dbTable.textContent).toContain("Eagle");
  });

  it("moves the component selection with arrow keys without default scrolling", () => {
    const { container } = render(<Derailleur />);
    const buttons = container.querySelectorAll(".components-list-scroll .component-select");
    fireEvent.click(buttons[0]);
    const down = fireEvent.keyDown(buttons[0], { key: "ArrowDown" });
    const selected = container.querySelectorAll('.components-list-scroll tr[aria-selected="true"]');
    expect(down).toBe(false);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toBe(buttons[1].closest("tr"));
  });

  it("splits comma-separated cassette freehub options for filtering", () => {
    const { container } = render(<Derailleur />);
    fireEvent.change(container.querySelector("select")!, { target: { value: "cassette" } });
    const search = container.querySelector('input[type="text"]')!;
    fireEvent.change(search, { target: { value: "CS-HG400-8" } });
    const selects = container.querySelectorAll("select");
    const freehubFilter = selects[selects.length - 1] as HTMLSelectElement;
    expect(Array.from(freehubFilter.options).some((option) => option.value === "HG 8, HG 11")).toBe(false);
    fireEvent.change(freehubFilter, { target: { value: "HG 8" } });
    expect(container.querySelector(".field-hint")?.textContent).not.toBe("0 matching components");
  });

  it("shows cassette series in the component name and specs", () => {
    const { container, getByText } = render(<Derailleur />);
    fireEvent.change(container.querySelector("select")!, { target: { value: "cassette" } });
    fireEvent.change(container.querySelector('input[type="text"]')!, { target: { value: "CS-R8000" } });
    fireEvent.click(container.querySelector(".components-list-scroll .component-select")!);
    expect(getByText("Series")).toBeTruthy();
    expect(container.textContent).toContain("Ultegra");
  });

  it("shows components from each database and opens a selected component's specs", () => {
    const { getByText, container } = render(<Derailleur />);
    fireEvent.change(container.querySelector("select")!, { target: { value: "hub" } });
    expect(container.querySelector("tbody")?.textContent).toContain("Wheel hub");
    fireEvent.click(getByText("R45 Front"));
    expect(getByText("Spacing (OLD)")).toBeTruthy();
  });
});
