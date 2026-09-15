import { Fragment, useEffect, useRef, useState } from "react";

// Ready-made wheel builds for the "Load an example" header menu. Each is just the
// set of URL params it differs from the defaults by (the same encoding the "Copy
// link" button produces), so picking one navigates to that config and the Wheel
// Building page re-seeds itself from the URL. Values are plain (un-encoded);
// URLSearchParams handles escaping.
interface ExamplePreset {
  label: string;
  params: Record<string, string>;
}
interface ExampleGroup {
  label: string;
  presets: ExamplePreset[];
}

const EXAMPLE_PRESETS: ExampleGroup[] = [
  {
    label: "Common lacings",
    presets: [
      { label: "36-spoke standard wheel", params: { n: "36" } },
      { label: "24-spoke road rear wheel", params: { n: "24" } },
      {
        label: "16-spoke radial front (rim brake)",
        params: {
          n: "16",
          lf: "39.8",
          lo: "34.8",
          ll: "radial",
          rf: "39.8",
          ro: "34.8",
          hub: "Chris King~R45 Front",
          hst: "front",
          hsw: "100",
        },
      },
    ],
  },
  {
    label: "Uncommon lacings",
    presets: [
      {
        label: "21-spoke Campagnolo G3",
        params: { rhg: "3", rgap: "6", n: "21", ratio: "2:1", ndsc: "1", xph: "1", ll: "radial", rl: "2x" },
      },
      {
        label: "12-spoke vintage Campagnolo Shamal",
        params: { n: "12", il: "0", lf: "30", ll: "radial", rf: "45", rl: "1x", hub: "none" },
      },
      {
        label: "64-spoke Yamaha XS650 Heritage",
        params: {
          erd: "502", rho: "5", n: "64", lf: "90", lo: "50", ll: "2l2t-4x", rf: "90", ro: "50",
          hub: "none", hst: "front", hsw: "110",
        },
      },
      {
        label: "140-spoke Bonanza",
        params: { erd: "502", rho: "5", n: "140", lf: "70", ll: "radial", rf: "70", hub: "none" },
      },
      {
        label: "Vintage Shimano paired spokes",
        params: {
          rho: "-15", rhg: "2", rgap: "6", rhp: "1", n: "16", il: "0", lf: "87.4", lo: "26.9",
          ll: "1x", rf: "87.4", ro: "26.9", hub: "none", hst: "front", hsw: "110",
        },
      },
      {
        label: "Rolf paired spokes",
        params: { rhg: "2", rgap: "6", n: "20", il: "0", lf: "65", ll: "2x", rf: "65", hub: "none" },
      },
      {
        label: "Crow's foot",
        params: { n: "36", lf: "70", ll: "cf-3x", rf: "70", hub: "none" },
      },
    ],
  },
];

/**
 * A header button (styled like "Copy link") that opens a grouped popover of the
 * example builds above. Loading one navigates to its config; the Wheel Building
 * page re-seeds from the URL (App remounts it on the hash change — see
 * useHashConfigKey).
 */
export function WheelExamplesMenu() {
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
    window.location.hash = query ? `/wheel-building?${query}` : "/wheel-building";
    setOpen(false);
  };

  return (
    <div className="preset-menu preset-menu-labelled wb-examples" ref={ref}>
      <button
        type="button"
        className={"copy-link-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Load an example <span className="caret">▾</span>
      </button>
      {open && (
        <ul className="preset-list wb-examples-list">
          {EXAMPLE_PRESETS.map((g) => (
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
