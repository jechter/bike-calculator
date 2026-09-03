import React, { useEffect, useRef, useState } from "react";

// Small shared UI primitives used across calculators.

export function Field(props: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
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
    <div className="preset-menu" ref={ref}>
      <button
        type="button"
        className={"preset-btn" + (open ? " open" : "")}
        title={props.title ?? "Fill from a preset"}
        aria-label={props.title ?? "Fill from a preset"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
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

export function Result(props: { label: string; value: React.ReactNode; big?: boolean }) {
  return (
    <div className={"result" + (props.big ? " result-big" : "")}>
      <div className="result-label">{props.label}</div>
      <div className="result-value">{props.value}</div>
    </div>
  );
}

export function Note(props: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return <div className={"note note-" + (props.tone ?? "info")}>{props.children}</div>;
}

export function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h3>{props.title}</h3>
      {props.children}
    </section>
  );
}
