import { useEffect, useRef } from "react";

/**
 * Shared chrome for a "complex editing" foldout — the anchored `.cp-pop` panel
 * used by the CdA / drivetrain / air-density editors. It renders a titled header
 * with a close button, a grid of factor fields, a live readout, and an optional
 * note. Open/close (and outside-click dismissal) is owned by the parent, which
 * wraps the trigger button and this panel in one `.editor-anchor`.
 */
export function EditorPopover(props: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  readoutLabel: string;
  readoutValue: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className="cp-pop editor-pop">
      <div className="editor-pop-head">
        <strong>{props.title}</strong>
        <button
          type="button"
          className="editor-pop-close"
          onClick={props.onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="editor-pop-grid">{props.children}</div>
      <div className="editor-pop-out">
        <span>{props.readoutLabel}</span>
        <strong>{props.readoutValue}</strong>
      </div>
      {props.note && <p className="editor-pop-note">{props.note}</p>}
    </div>
  );
}

/** One labelled control inside an {@link EditorPopover} grid. */
export function EditorField(props: {
  label: string;
  /** Span both columns (e.g. a wide select). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={"editor-field" + (props.wide ? " editor-field-wide" : "")}>
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

/**
 * Returns a ref for an anchor element; while `open`, an outside mousedown calls
 * `close()`. The anchor must wrap both the trigger and the popover so clicking
 * the trigger toggles rather than immediately re-closing. `close` is read through
 * a ref so the listener isn't re-bound on every parent render.
 */
export function useOutsideClose<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return ref;
}
