import { useEffect, useRef, useState } from "react";
import { useUnits, type SpeedUnit } from "../units-context";

// Small popup in the sidebar footer for the global speed unit.
export function UnitSwitcher() {
  const { speed, setSpeed } = useUnits();
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

  const label = speed === "kmh" ? "km/h" : "mph";
  const options: Array<{ value: SpeedUnit; label: string }> = [
    { value: "kmh", label: "km/h" },
    { value: "mph", label: "mph" },
  ];

  return (
    <div className="unit-switcher" ref={ref}>
      <button
        type="button"
        className={"unit-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="unit-icon">◔</span>
        <span>Speed: {label}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <ul className="preset-list unit-list">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className={o.value === speed ? "active" : ""}
                onClick={() => {
                  setSpeed(o.value);
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
