import React, { useEffect, useRef, useState } from "react";

// Small shared UI primitives used across calculators.

export function Field(props: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Accent the field's input and label (e.g. the value you last edited in a
   * two-way solve like Speed ⇄ Power).
   */
  highlight?: boolean;
  /** Optional colour swatch before the label (ties the field to a diagram legend). */
  dotColor?: string;
  /** A small caption under the value noting what an estimate is based on. */
  source?: React.ReactNode;
  /** Always render the caption line (empty when there's no source), so the field
   *  keeps a constant height and neighbours don't move as the caption toggles. */
  reserveSource?: boolean;
  /** Called on hover/focus and blur/leave — used to highlight a linked diagram element. */
  activate?: () => void;
  deactivate?: () => void;
}) {
  const linked = props.activate || props.deactivate
    ? {
        onMouseEnter: props.activate,
        onMouseLeave: props.deactivate,
        onFocus: props.activate,
        onBlur: props.deactivate,
      }
    : {};
  return (
    <div className={"field" + (props.highlight ? " field-highlight" : "")} {...linked}>
      <span className="field-label">
        {props.dotColor && <span className="field-dot" style={{ background: props.dotColor }} />}
        {props.label}
      </span>
      {props.children}
      {(props.source !== undefined || props.reserveSource) && (
        <span className="field-source">{props.source ?? " "}</span>
      )}
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </div>
  );
}

/**
 * A small "⋯" button that opens a popover list of presets. Picking one calls
 * onPick with its value — used to fill an adjacent editable field with a
 * sensible default, while keeping that field freely editable.
 */
export function PresetMenu(props: {
  title?: string;
  /** When set, render a labelled button (for multi-field / section-level
   *  presets) instead of the bare caret used inside a field. */
  label?: string;
  options: Array<{ value: string; label: string }>;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={"preset-menu" + (props.label ? " preset-menu-labelled" : "")} ref={ref}>
      <button
        type="button"
        className={(props.label ? "preset-labelbtn" : "preset-btn") + (open ? " open" : "")}
        title={props.title ?? "Fill from a preset"}
        aria-label={props.title ?? "Fill from a preset"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {props.label && <span>{props.label}</span>}
        <span className="caret">▾</span>
      </button>
      {open && (
        <ul className="preset-list">
          {props.options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  props.onPick(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NumberInput(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Ghost text shown when the field is empty (e.g. an estimated default). */
  placeholder?: string;
  /**
   * The height-based estimate. The field stays visually empty (showing the
   * greyed `placeholder`), but stepping it — spinner buttons, arrow keys or the
   * wheel — increments from this estimate and commits, instead of the browser's
   * default of jumping to the field minimum.
   */
  estimate?: number;
  /** A trailing unit label, or any control (e.g. a compact unit picker). */
  suffix?: React.ReactNode;
  /**
   * When set, a small "×" clears the field back to its estimate. Shown only
   * while the field holds a user value (so there's something to clear).
   */
  onClear?: () => void;
}) {
  const finite = Number.isFinite(props.value);
  const est = props.estimate;
  const onEstimate = !finite && est != null && Number.isFinite(est);
  const stepBy = props.step && props.step > 0 ? props.step : 1;
  const clampVal = (v: number) => {
    if (props.min != null) v = Math.max(props.min, v);
    if (props.max != null) v = Math.min(props.max, v);
    return v;
  };

  // Fields with a reset (the frame-size workbench) use custom steppers on the LEFT
  // and the "×" on the right, so neither moves as the other appears — the native
  // spinner, stuck on the right, can't be repositioned. Other NumberInputs keep
  // the plain native spinner.
  const custom = !!props.onClear;
  // Step from the current value, or from the estimate when the field is empty
  // (so a first press nudges the greyed default instead of jumping to the min).
  const stepFrom = finite ? props.value : onEstimate ? est : props.min ?? 0;
  const step = (dir: number) => props.onChange(clampVal(stepFrom + dir * stepBy));

  // Press-and-hold auto-repeat for the custom steppers. A local `base` carries the
  // running value, so it keeps climbing across ticks without waiting on re-renders.
  const holdDelay = useRef<number | null>(null);
  const holdRepeat = useRef<number | null>(null);
  const stopHold = () => {
    if (holdDelay.current != null) window.clearTimeout(holdDelay.current);
    if (holdRepeat.current != null) window.clearInterval(holdRepeat.current);
    holdDelay.current = holdRepeat.current = null;
  };
  const startHold = (dir: number) => {
    stopHold();
    let base = finite ? props.value : onEstimate ? (est as number) : props.min ?? 0;
    const tick = () => {
      base = clampVal(base + dir * stepBy);
      props.onChange(base);
    };
    tick(); // step once immediately
    holdDelay.current = window.setTimeout(() => {
      holdRepeat.current = window.setInterval(tick, 70);
    }, 300);
  };
  useEffect(() => stopHold, []); // clear timers on unmount

  // When the field only shows its estimate, a native step would jump to the min.
  // Arrow keys are handled directly; a spinner press lands on the min, so we
  // remap that to estimate ± step using which half (up/down) was pressed.
  const spinUp = useRef(true);
  const emptyStepLands = props.min ?? 0;
  const holdButton = (dir: number, glyph: string) => (
    <button
      type="button"
      className="ni-step"
      tabIndex={-1}
      aria-hidden
      onPointerDown={(e) => {
        e.preventDefault();
        startHold(dir);
      }}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
    >
      {glyph}
    </button>
  );
  return (
    <span className="number-input">
      <span className="ni-field">
      <input
        type="number"
        className={
          [custom && "ni-custom", custom && finite && "ni-set"].filter(Boolean).join(" ") ||
          undefined
        }
        value={finite ? props.value : ""}
        placeholder={props.placeholder}
        min={props.min}
        max={props.max}
        step={props.step ?? "any"}
        onKeyDown={
          custom
            ? (e) => {
                const d = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
                if (d) {
                  e.preventDefault();
                  step(d);
                }
              }
            : onEstimate
              ? (e) => {
                  const d = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
                  if (d) {
                    e.preventDefault();
                    props.onChange(clampVal(est + d * stepBy));
                  }
                }
              : undefined
        }
        onPointerDown={
          !custom && onEstimate
            ? (e) => {
                const r = e.currentTarget.getBoundingClientRect();
                spinUp.current = e.clientY < r.top + r.height / 2;
              }
            : undefined
        }
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          if (!custom && onEstimate && raw === emptyStepLands) {
            props.onChange(clampVal(est + (spinUp.current ? 1 : -1) * stepBy));
          } else {
            props.onChange(raw);
          }
        }}
      />
      {custom && finite && (
        <button
          type="button"
          className="number-clear"
          title="Reset to the recommended value"
          aria-label="Reset to the recommended value"
          onClick={props.onClear}
        >
          ×
        </button>
      )}
      </span>
      {custom && (
        <span className="ni-stepper">
          {holdButton(1, "▲")}
          {holdButton(-1, "▼")}
        </span>
      )}
      {props.suffix && <span className="suffix">{props.suffix}</span>}
    </span>
  );
}

export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export interface SelectOption<T> {
  value: T;
  label: string;
}
export interface SelectGroup<T> {
  label: string;
  options: Array<SelectOption<T>>;
}

// A native select that also accepts <optgroup>s: any item with an `options` array
// renders as a labelled group. Flat option arrays work unchanged.
export function Select<T extends string | number>(props: {
  value: T;
  options: Array<SelectOption<T> | SelectGroup<T>>;
  onChange: (v: T) => void;
  className?: string;
}) {
  const isGroup = (o: SelectOption<T> | SelectGroup<T>): o is SelectGroup<T> =>
    "options" in o;
  const flat = props.options.flatMap((o) => (isGroup(o) ? o.options : [o]));
  return (
    <select
      className={props.className}
      value={String(props.value)}
      onChange={(e) => {
        const raw = e.target.value;
        const match = flat.find((o) => String(o.value) === raw);
        if (match) props.onChange(match.value);
      }}
    >
      {props.options.map((o, i) =>
        isGroup(o) ? (
          <optgroup key={`g${i}`} label={o.label}>
            {o.options.map((x) => (
              <option key={String(x.value)} value={String(x.value)}>
                {x.label}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

interface SwatchOption<T> {
  value: T;
  label: string;
  /** A shorter label for the folded control; falls back to `label`. */
  shortLabel?: string;
  /** Colour square shown before the label in the open list. */
  color?: string;
}
interface SwatchGroup<T> {
  label: string;
  options: Array<SwatchOption<T>>;
}

/**
 * A custom (non-native) select whose open list prefixes each option with a
 * colour square, while the folded control shows just the label — the current
 * colour is carried by an accent border (`accentColor`) instead, so the square
 * isn't repeated redundantly. Used where options map to a colour legend.
 */
export function SwatchSelect<T extends string | number>(props: {
  value: T;
  options: Array<SwatchOption<T> | SwatchGroup<T>>;
  onChange: (v: T) => void;
  /** Left-edge accent on the folded control (typically the current option's colour). */
  accentColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isGroup = (o: SwatchOption<T> | SwatchGroup<T>): o is SwatchGroup<T> =>
    "options" in o;
  const flat = props.options.flatMap((o) => (isGroup(o) ? o.options : [o]));
  const current = flat.find((o) => o.value === props.value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const renderOption = (o: SwatchOption<T>) => (
    <li key={String(o.value)} role="option" aria-selected={o.value === props.value}>
      <button
        type="button"
        className={o.value === props.value ? "active" : undefined}
        onClick={() => {
          props.onChange(o.value);
          setOpen(false);
        }}
      >
        <span className="swatch-dot" style={{ background: o.color ?? "transparent" }} />
        {o.label}
      </button>
    </li>
  );

  return (
    <div
      className="swatch-select"
      ref={ref}
      style={{ ["--swatch-accent" as string]: props.accentColor ?? "var(--border)" }}
    >
      <button
        type="button"
        className={"swatch-select-btn" + (open ? " open" : "")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="swatch-select-value">{current?.shortLabel ?? current?.label}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <ul className="swatch-select-list" role="listbox">
          {props.options.map((o, i) =>
            isGroup(o) ? (
              <li key={`g${i}`} className="swatch-select-group">
                <span className="swatch-select-grouplabel">{o.label}</span>
                <ul>{o.options.map(renderOption)}</ul>
              </li>
            ) : (
              renderOption(o)
            ),
          )}
        </ul>
      )}
    </div>
  );
}

export function Result(props: {
  label: string;
  value: React.ReactNode;
  big?: boolean;
  /** Optional side colour accent (matches the wheel diagram). */
  accent?: "left" | "right";
  /** Optional colour swatch before the label (ties the card to a chart/bar). */
  dotColor?: string;
  /** Called on hover and leave — used to highlight a linked diagram element. */
  activate?: () => void;
  deactivate?: () => void;
}) {
  const linked = props.activate || props.deactivate
    ? { onMouseEnter: props.activate, onMouseLeave: props.deactivate }
    : {};
  return (
    <div
      className={
        "result" +
        (props.big ? " result-big" : "") +
        (props.accent ? ` result-accent-${props.accent}` : "")
      }
      {...linked}
    >
      <div className="result-label">
        {props.dotColor && <span className="result-dot" style={{ background: props.dotColor }} />}
        {props.label}
      </div>
      <div className="result-value">{props.value}</div>
    </div>
  );
}

export function Note(props: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return <div className={"note note-" + (props.tone ?? "info")}>{props.children}</div>;
}

/**
 * A small "i" icon that reveals supplementary info in a popover on hover (with a
 * short close delay so you can move into it) or click (touch-friendly).
 */
export function InfoTip(props: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  const show = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setOpen(true);
  };
  const hide = () => {
    timer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="infotip" ref={ref} onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        className={"infotip-btn" + (open ? " open" : "")}
        aria-label={props.label ?? "More information"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      {open && (
        <div className="infotip-pop" role="tooltip" onMouseEnter={show} onMouseLeave={hide}>
          {props.children}
        </div>
      )}
    </div>
  );
}

export function Section(props: {
  title: string;
  info?: React.ReactNode;
  /** Optional control rendered on the right of the section header (e.g. presets). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h3>{props.title}</h3>
        {props.info && <InfoTip label={`About: ${props.title}`}>{props.info}</InfoTip>}
        {props.action && <div className="section-action">{props.action}</div>}
      </div>
      {props.children}
    </section>
  );
}
