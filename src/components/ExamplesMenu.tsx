import { Fragment, useEffect, useRef, useState } from "react";

// A ready-made preset for a calculator, expressed as the URL params it differs
// from the defaults by (the same encoding the "Copy link" button produces).
// Picking one navigates to that config; the page re-seeds itself from the URL
// (App remounts it on the hash change — see useHashConfigKey). Values are plain
// (un-encoded); URLSearchParams handles escaping.
export interface ExamplePreset {
  label: string;
  params: Record<string, string>;
}
export interface ExampleGroup {
  label: string;
  presets: ExamplePreset[];
}

/**
 * A header button (styled like "Copy link") that opens a grouped popover of
 * example configs. Shared by the calculators that support shareable links; each
 * supplies its own route + presets.
 */
export function ExamplesMenu({ route, groups }: { route: string; groups: ExampleGroup[] }) {
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

  const applyExample = (p: ExamplePreset) => {
    const query = new URLSearchParams(p.params).toString();
    window.location.hash = query ? `/${route}?${query}` : `/${route}`;
    setOpen(false);
  };

  return (
    <div className="preset-menu preset-menu-labelled examples-menu" ref={ref}>
      <button
        type="button"
        className={"copy-link-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Load an example <span className="caret">▾</span>
      </button>
      {open && (
        <ul className="preset-list examples-list">
          {groups.map((g) => (
            <Fragment key={g.label}>
              <li className="preset-group">{g.label}</li>
              {g.presets.map((p) => (
                <li key={p.label}>
                  <button type="button" onClick={() => applyExample(p)}>
                    {p.label}
                  </button>
                </li>
              ))}
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
