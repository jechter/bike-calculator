// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NumberInput } from "./ui";

beforeEach(() => vi.stubGlobal("PointerEvent", MouseEvent));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function Editable(props: { initial?: number; step?: number; min?: number; max?: number; estimate?: number; disabled?: boolean }) {
  const [value, setValue] = useState(props.initial ?? 1);
  return <NumberInput {...props} value={value} onChange={setValue} />;
}

describe("NumberInput touch controls", () => {
  it("requests a decimal keyboard and still accepts direct typing", () => {
    const { getByRole } = render(<Editable />);
    const input = getByRole("spinbutton") as HTMLInputElement;
    expect(input.inputMode).toBe("decimal");
    fireEvent.change(input, { target: { value: "2.5" } });
    expect(input.value).toBe("2.5");
  });

  it.each(["2,5", "2.5", ",5", "-2,5"])("accepts %s and emits a numeric value", text => {
    const onChange = vi.fn();
    const { getByRole } = render(<NumberInput value={1} onChange={onChange} />);
    fireEvent.change(getByRole("spinbutton"), { target: { value: text } });
    expect(onChange).toHaveBeenLastCalledWith(Number(text.replace(",", ".")));
  });

  it.each([",", "."])("keeps a trailing %s while typing, then normalizes on blur", separator => {
    const { getByRole } = render(<Editable initial={2} />);
    const input = getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: `2${separator}` } });
    expect(input.value).toBe(`2${separator}`);
    fireEvent.change(input, { target: { value: `2${separator}5` } });
    expect(input.value).toBe(`2${separator}5`);
    expect(input.getAttribute("aria-valuenow")).toBe("2.5");
    fireEvent.blur(input);
    expect(input.value).toBe("2.5");
  });

  it("supports clearing, negative entry, and arrow stepping after a comma", () => {
    const { getByRole } = render(<Editable step={0.1} />);
    const input = getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "-" } });
    expect(input.value).toBe("-");
    fireEvent.change(input, { target: { value: "-0,5" } });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("-0.4");
    fireEvent.click(getByRole("button", { name: "Increase value" }));
    expect(input.value).toBe("-0.3");
  });

  it.each(["1,2.3", "1,,2", "2kg"])("rejects malformed input %s", text => {
    const onChange = vi.fn();
    const { getByRole } = render(<NumberInput value={1} onChange={onChange} />);
    fireEvent.change(getByRole("spinbutton"), { target: { value: text } });
    expect(onChange).not.toHaveBeenCalled();
    expect((getByRole("spinbutton") as HTMLInputElement).value).toBe("1");
  });

  it("updates the draft when a preset or reset changes the supplied value", () => {
    const onChange = vi.fn();
    const { getByRole, rerender } = render(<NumberInput value={1} onChange={onChange} />);
    rerender(<NumberInput value={2.5} onChange={onChange} />);
    expect((getByRole("spinbutton") as HTMLInputElement).value).toBe("2.5");
    rerender(<NumberInput value={NaN} onChange={onChange} />);
    expect((getByRole("spinbutton") as HTMLInputElement).value).toBe("");
  });

  it("steps once per pointer tap without double-counting its click", () => {
    const { getByRole } = render(<Editable initial={0.2} step={0.1} />);
    const plus = getByRole("button", { name: "Increase value" });
    const input = getByRole("spinbutton") as HTMLInputElement;
    expect(plus.getAttribute("aria-controls")).toBe(input.id);
    fireEvent.pointerDown(plus, { button: 0 });
    fireEvent.pointerUp(plus);
    fireEvent.click(plus, { detail: 1 });
    expect(input.value).toBe("0.3");
    fireEvent.click(getByRole("button", { name: "Decrease value" }));
    expect(input.value).toBe("0.2");
  });

  it("repeats while held and stops on release", () => {
    vi.useFakeTimers();
    const { getByRole } = render(<Editable initial={10} step={2} />);
    const plus = getByRole("button", { name: "Increase value" });
    const input = getByRole("spinbutton") as HTMLInputElement;
    fireEvent.pointerDown(plus, { button: 0 });
    expect(input.value).toBe("12");
    act(() => vi.advanceTimersByTime(510));
    expect(input.value).toBe("18");
    fireEvent.pointerUp(plus);
    act(() => vi.advanceTimersByTime(1000));
    expect(input.value).toBe("18");
  });

  it.each(["pointerCancel", "pointerLeave", "lostPointerCapture"] as const)("stops repeating on %s", event => {
    vi.useFakeTimers();
    const { getByRole } = render(<Editable />);
    const plus = getByRole("button", { name: "Increase value" });
    fireEvent.pointerDown(plus, { button: 0 });
    fireEvent[event](plus);
    act(() => vi.advanceTimersByTime(1000));
    expect((getByRole("spinbutton") as HTMLInputElement).value).toBe("2");
  });

  it("respects limits, disables unavailable directions, and cleans up timers", () => {
    vi.useFakeTimers();
    const { getByRole, unmount } = render(<Editable initial={0.2} step={0.3} min={0} max={1} />);
    const plus = getByRole("button", { name: "Increase value" }) as HTMLButtonElement;
    const minus = getByRole("button", { name: "Decrease value" }) as HTMLButtonElement;
    fireEvent.pointerDown(plus, { button: 0 });
    act(() => vi.advanceTimersByTime(1000));
    expect((getByRole("spinbutton") as HTMLInputElement).value).toBe("1");
    expect(plus.disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.pointerDown(minus, { button: 0 });
    act(() => vi.advanceTimersByTime(1000));
    expect((getByRole("spinbutton") as HTMLInputElement).value).toBe("0");
    expect(minus.disabled).toBe(true);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("steps from the estimate and allows negative values when unbounded", () => {
    const { getByRole } = render(<Editable initial={NaN} estimate={-2} step={0.5} />);
    fireEvent.click(getByRole("button", { name: "Decrease value" }));
    expect((getByRole("spinbutton") as HTMLInputElement).value).toBe("-2.5");
  });

  it("blocks stepping when disabled", () => {
    const { getByRole } = render(<Editable disabled />);
    const plus = getByRole("button", { name: "Increase value" }) as HTMLButtonElement;
    expect(plus.disabled).toBe(true);
    fireEvent.pointerDown(plus, { button: 0 });
    fireEvent.click(plus);
    expect((getByRole("spinbutton") as HTMLInputElement).value).toBe("1");
  });

  it("cleans up an active hold on unmount and window blur", () => {
    vi.useFakeTimers();
    const { getByRole, unmount } = render(<Editable />);
    const plus = getByRole("button", { name: "Increase value" });
    fireEvent.pointerDown(plus, { button: 0 });
    fireEvent(window, new Event("blur"));
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.pointerDown(plus, { button: 0 });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
