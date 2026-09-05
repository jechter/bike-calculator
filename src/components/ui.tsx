import React, { useEffect, useRef, useState } from "react";

// Small shared UI primitives used across calculators.

export function Field(props: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  /** Highlight this field as the computed/solved-for one (e.g. Speed⇄Power). */
  solved?: boolean;
}) {
  return (
    <div className={"field" + (props.solved ? " field-solved" : "")}>
      <span className="field-label">{props.label}</span>
      {props.children}
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
  suffix?: string;
}) {
  return (
    <span className="number-input">
      <input
        type="number"
        value={Number.isFinite(props.value) ? props.value : ""}
        min={props.min}
        max={props.max}
        step={props.step ?? "any"}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
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

export function Select<T extends string | number>(props: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={String(props.value)}
      onChange={(e) => {
        const raw = e.target.value;
        const match = props.options.find((o) => String(o.value) === raw);
        if (match) props.onChange(match.value);
      }}
    >
      {props.options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
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
}) {
  return (
    <div
      className={
        "result" +
        (props.big ? " result-big" : "") +
        (props.accent ? ` result-accent-${props.accent}` : "")
      }
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
