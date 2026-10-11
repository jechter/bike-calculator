// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { Derailleur, proposalEmailBody } from "./Derailleur";

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

  it("deselects the component when the filters hide it", () => {
    const { getByText, queryByText, container } = render(<Derailleur />);
    fireEvent.change(container.querySelector("select")!, { target: { value: "hub" } });
    fireEvent.click(getByText("R45 Front"));
    expect(getByText("Spacing (OLD)")).toBeTruthy();
    fireEvent.change(container.querySelector("select")!, { target: { value: "cassette" } });
    expect(queryByText("Spacing (OLD)")).toBeNull();
    expect(container.querySelector(".component-details")).toBeNull();
    fireEvent.change(container.querySelector("select")!, { target: { value: "all" } });
    expect(container.querySelector('.components-list-scroll tr[aria-selected="true"]')).toBeNull();
  });

  it("blocks a new-component proposal until the required fields are filled", () => {
    const { container, getByText, getByRole } = render(<Derailleur />);
    act(() => { window.dispatchEvent(new Event("components:propose-new")); });
    fireEvent.change(getByRole("combobox", { name: "Component type" }), { target: { value: "gearbox" } });
    expect(container.querySelector("#proposal-label")).toBeTruthy();
    fireEvent.click(getByText("Submit for review"));
    expect(getByRole("alert").textContent).toBe("Fill in the required fields: Brand, Model, Ratios, Source URL.");
    expect(container.querySelector("#proposal-priceUsd")).toBeNull();
  });

  it("pre-fills list fields with an example that must be replaced by real numbers", () => {
    const { container, getByText, getByRole } = render(<Derailleur />);
    act(() => { window.dispatchEvent(new Event("components:propose-new")); });
    fireEvent.change(getByRole("combobox", { name: "Component type" }), { target: { value: "cassette" } });
    const cogs = container.querySelector<HTMLInputElement>("#proposal-cogs")!;
    expect(cogs.value).toBe("11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 32");
    fireEvent.click(getByText("Submit for review"));
    expect(getByRole("alert").textContent).toContain("Sprockets");
    fireEvent.change(cogs, { target: { value: "11, 13, x" } });
    expect(getByRole("alert").textContent).toContain("Use comma-separated numbers for: Sprockets.");
  });

  it("edits an existing gear hub with the same fields and order as a new one", () => {
    const { container, getByText } = render(<Derailleur />);
    fireEvent.click(getByText("NINE"));
    fireEvent.click(getByText("Propose changes"));
    const labels = () => Array.from(container.querySelectorAll(".component-edit-table th")).map((th) => th.textContent?.replace(" *", ""));
    const expected = ["Component type", "Brand", "Model", "Continuously variable", "Ratios", "Derailleur compatible", "Source URL", "Comments"];
    expect(labels()).toEqual(expected);
    const flag = container.querySelector<HTMLInputElement>("#proposal-derailleurCompatible")!;
    expect(flag.type).toBe("checkbox");
    fireEvent.click(flag);
    expect(flag.checked).toBe(true);
    fireEvent.click(getByText("Cancel"));
    act(() => { window.dispatchEvent(new Event("components:propose-new")); });
    fireEvent.change(container.querySelector("#proposal-category")!, { target: { value: "internal-hub" } });
    expect(labels()).toEqual(expected);
  });

  it("discards a new-component proposal when a component is selected", () => {
    const { container, getByText, queryByText } = render(<Derailleur />);
    act(() => { window.dispatchEvent(new Event("components:propose-new")); });
    expect(getByText("New component")).toBeTruthy();
    fireEvent.click(getByText("NINE"));
    expect(queryByText("New component")).toBeNull();
    expect(container.querySelectorAll(".component-details")).toHaveLength(1);
    expect(getByText("Propose changes")).toBeTruthy();
  });

  it("puts proposal comments in the email outside the JSON", () => {
    const body = proposalEmailBody({ category: "cassette", brand: "3T" }, "Weight per 3T's site.", "3T Bailout (Cassette)");
    expect(body).toBe('Component change proposal\n\nExisting entry: 3T Bailout (Cassette)\n\nComments:\nWeight per 3T\'s site.\n\nProposed data:\n{\n  "category": "cassette",\n  "brand": "3T"\n}');
    expect(proposalEmailBody({ brand: "X" }, "")).not.toContain("Comments");
  });
});
