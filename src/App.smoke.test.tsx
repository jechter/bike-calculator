// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import { App } from "./App";
import { CALCULATORS } from "./registry";

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("App shell", () => {
  it("renders the sidebar with every visible calculator", () => {
    const { getByRole, queryByRole } = render(<App />);
    for (const c of CALCULATORS) {
      const query = queryByRole("button", { name: new RegExp(c.title) });
      if (c.hidden) {
        expect(query).toBeNull();
      } else {
        expect(getByRole("button", { name: new RegExp(c.title) })).toBeTruthy();
      }
    }
  });

  it("global speed unit switch changes speed display across the app", () => {
    const { container, getByRole } = render(<App />);
    // default drivetrain chart shows a km/h axis
    expect(container.querySelector(".gc-axis-btn")!.textContent).toMatch(/km\/h/);
    // open the sidebar unit switcher and choose mph
    fireEvent.click(getByRole("button", { name: /Speed:/ }));
    fireEvent.click(within(container.querySelector(".unit-list") as HTMLElement).getByText("mph"));
    expect(container.querySelector(".gc-axis-btn")!.textContent).toMatch(/mph/);
  });

  it("navigates to and renders each calculator without crashing", async () => {
    const { getByRole, container } = render(<App />);
    for (const c of CALCULATORS.filter((c) => !c.hidden)) {
      fireEvent.click(getByRole("button", { name: new RegExp(c.title) }));
      await waitFor(() => {
        const heading = within(container).getByRole("heading", { level: 1 });
        expect(heading.textContent).toContain(c.title);
      });
    }
  });
});

describe("each calculator component mounts standalone", () => {
  for (const c of CALCULATORS) {
    it(`${c.title} renders`, () => {
      const { container } = render(<c.Component />);
      expect(container.textContent).toBeTruthy();
    });
  }
});
