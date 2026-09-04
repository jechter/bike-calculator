// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Derailleur } from "./Derailleur";

afterEach(cleanup);

describe("Derailleur database page", () => {
  it("filters the database by search", () => {
    const { container } = render(<Derailleur />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "tourney" } });
    const dbTable = container.querySelectorAll(".table-wrap")[0];
    const rows = dbTable.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
    expect(dbTable.textContent).toContain("Tourney");
  });

  it("keeps the compatibility reference section", () => {
    const { getByRole } = render(<Derailleur />);
    expect(getByRole("heading", { name: "Compatibility reference" })).toBeTruthy();
  });
});
