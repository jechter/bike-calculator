// @vitest-environment jsdom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { popupPlacement, ResponsivePopover } from "./ResponsivePopover";

afterEach(() => vi.restoreAllMocks());

describe("popup placement", () => {
  it("anchors below a field only when it fits, clamping horizontally", () => {
    const viewport = { left: 0, top: 0, width: 1200, height: 1000 };
    expect(popupPlacement({ top: 100, bottom: 150, right: 600 }, { width: 480, height: 600 }, viewport)).toEqual({ mode: "anchored", left: 120, top: 156, width: 480, height: undefined });
    expect(popupPlacement({ top: 100, bottom: 150, right: 200 }, { width: 480, height: 600 }, viewport).left).toBe(8);
    expect(popupPlacement({ top: 500, bottom: 550, right: 600 }, { width: 480, height: 600 }, viewport)).toEqual({ mode: "floating", left: 120, top: 392, width: 480, height: undefined });
  });

  it("keeps short popups small even near the bottom or side of the screen", () => {
    expect(popupPlacement({ top: 720, bottom: 760, right: 1150 }, { width: 240, height: 150 }, { left: 0, top: 0, width: 1200, height: 800 })).toEqual({ mode: "floating", left: 910, top: 642, width: 240, height: undefined });
    expect(popupPlacement({ top: 100, bottom: 140, right: 380 }, { width: 480, height: 100 }, { left: 0, top: 0, width: 390, height: 844 })).toEqual({ mode: "floating", left: 8, top: 146, width: 374, height: undefined });
    expect(popupPlacement({ top: 200, bottom: 240, right: 700 }, { width: 480, height: 600 }, { left: 0, top: 0, width: 1200, height: 400 })).toEqual({ mode: "screen", left: 220, top: 8, width: 480, height: 384 });
  });

  it("uses the visible viewport for narrow screens and an open keyboard", () => {
    expect(popupPlacement({ top: 200, bottom: 240, right: 380 }, { width: 480, height: 600 }, { left: 10, top: 180, width: 390, height: 400 })).toEqual({ mode: "screen", left: 18, top: 188, width: 374, height: 384 });
  });
});

function Example() {
  const [open, setOpen] = useState(true);
  return <div className="test-anchor">
    <button aria-expanded={open} onClick={() => setOpen(true)}>Open</button>
    {open && <ResponsivePopover className="test-pop" onClose={() => setOpen(false)}><input aria-label="Popup input" /></ResponsivePopover>}
  </div>;
}

describe("responsive popup lifecycle", () => {
  it("dismisses on an outside click while keeping clicks inside the field open", () => {
    const { container, getByLabelText } = render(<Example />);
    fireEvent.mouseDown(getByLabelText("Popup input"));
    expect(container.querySelector(".test-pop")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(container.querySelector(".test-pop")).toBeNull();
  });

  it("caps oversized popups, repositions on resize, and restores focus and scrolling on Escape", async () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
    const height = vi.spyOn(window, "innerHeight", "get").mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const r = this.classList.contains("test-pop")
        ? { x: 0, y: 0, width: 350, height: 600 }
        : { x: 40, y: 350, width: 300, height: 40 };
      return { ...r, top: r.y, left: r.x, right: r.x + r.width, bottom: r.y + r.height, toJSON: () => r };
    });
    const { container, getByText, getByLabelText } = render(<Example />);
    const popup = container.querySelector<HTMLElement>(".test-pop")!;
    expect(popup.dataset.popupMode).toBe("screen");
    expect(popup.style.top).toBe("8px");
    expect(popup.style.height).toBe("484px");
    expect(document.body.style.overflow).toBe("hidden");
    expect(getByText("Close ×")).toBeTruthy();
    height.mockReturnValue(844);
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(popup.dataset.popupMode).toBe("floating"));
    expect(popup.style.height).toBe("");
    expect(popup.style.width).toBe("350px");
    expect(popup.style.top).toBe("236px");
    expect(document.body.style.overflow).toBe("");
    height.mockReturnValue(1400);
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(popup.dataset.popupMode).toBe("anchored"));
    expect(popup.style.top).toBe("396px");
    expect(document.body.style.overflow).toBe("");
    getByLabelText("Popup input").focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".test-pop")).toBeNull();
    expect(document.activeElement).toBe(getByText("Open"));
    expect(document.body.style.overflow).toBe("");
  });
});
