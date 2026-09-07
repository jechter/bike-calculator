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

  it("keeps the compatibility reference section", () => {
    const { getByRole } = render(<Derailleur />);
    expect(getByRole("heading", { name: "Compatibility reference" })).toBeTruthy();
  });
});
