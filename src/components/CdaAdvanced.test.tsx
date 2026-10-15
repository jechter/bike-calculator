// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CdaAdvancedPanel } from "./CdaAdvanced";
import { DEFAULT_CDA_PARAMS, REF_MASS_KG } from "../lib/cda";

describe("CdA double-file readout", () => {
  it("shows an increased-drag penalty for two abreast, then a saving behind a row", () => {
    const props = { massKg: REF_MASS_KG, onChange: vi.fn(), onClose: vi.fn() };
    const params = { ...DEFAULT_CDA_PARAMS, formation: "double" as const, draftRiders: 1 };
    const { container, getByText, rerender } = render(<CdaAdvancedPanel {...props} params={params} />);
    expect(container.querySelector(".editor-pop-out strong")?.textContent).toBe("0.371 m² (solo 0.360, +3 %)");
    expect(getByText(/modeled drag penalty/)).toBeTruthy();
    expect(container.querySelectorAll('.drafting-preview [data-rider]')).toHaveLength(2);
    rerender(<CdaAdvancedPanel {...props} params={{ ...params, draftRiders: 2 }} />);
    expect(container.querySelector(".editor-pop-out strong")?.textContent).toBe("0.238 m² (solo 0.360, −34 %)");
    rerender(<CdaAdvancedPanel {...props} params={{ ...params, draftRiders: 0 }} />);
    expect(container.querySelector(".editor-pop-out strong")?.textContent).toBe("0.360 m²");
  });
});
