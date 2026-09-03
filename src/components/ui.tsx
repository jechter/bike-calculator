import React from "react";

// Small shared UI primitives used across calculators.

export function Field(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      {props.children}
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </label>
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
