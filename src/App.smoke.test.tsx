// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import { App } from "./App";
import { CALCULATORS } from "./registry";

afterEach(cleanup);

describe("App shell", () => {
  it("renders the sidebar with every calculator", () => {
    const { getByRole } = render(<App />);
    for (const c of CALCULATORS) {
      expect(getByRole("button", { name: new RegExp(c.title) })).toBeTruthy();
    }
  });

  it("navigates to and renders each calculator without crashing", async () => {
    const { getByRole, container } = render(<App />);
    for (const c of CALCULATORS) {
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
