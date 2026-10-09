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

  it("shows components from each database and opens a selected component's specs", () => {
    const { getByText, container } = render(<Derailleur />);
    fireEvent.change(container.querySelector("select")!, { target: { value: "hub" } });
    expect(container.querySelector("tbody")?.textContent).toContain("Wheel hub");
    fireEvent.click(getByText("R45 Front"));
    expect(getByText("Spacing (OLD)")).toBeTruthy();
  });
});
