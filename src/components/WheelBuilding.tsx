import { useEffect, useMemo, useRef, useState } from "react";
import {
  spokeLength,
  maxCross,
  checkWheelLacing,
  TENSION_CURVES,
  RIM_PRESETS,
  HUBS,
  HUB_TYPE_LABELS,
  type Hub,
  type HubType,
} from "../lib/spokes";
import { Field, NumberInput, Select, PresetMenu, Result, Note, Section } from "./ui";
import { WheelDiagram } from "./WheelDiagram";
import { TensionCurveChart } from "./TensionCurveChart";

const RIM_OPTIONS = RIM_PRESETS.map((p) => ({ value: String(p.erdMm), label: p.label }));

const crossOptions = [0, 1, 2, 3, 4].map((k) => ({
  value: k,
  label: k === 0 ? "Radial (0×)" : `${k}-cross`,
}));

const hubName = (h: Hub) => `${h.manufacturer} ${h.model}`;
const drillingsLabel = (h: Hub) => h.spokeCounts.join("/") + "h";

// Link (labelled with the hub's name) to where its flange geometry came from —
// mirrors the drivetrain calculator's hub-source link.
function HubSourceLink({ hub }: { hub: Hub }) {
  const src = hub.source;
  if (!src) return <>{hubName(hub)}</>;
  return (
    <a
      className="inline-link"
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${src.sourceType ?? "reference"} source${src.note ? ` — ${src.note}` : ""}`}
    >
      {hubName(hub)} ↗
    </a>
  );
}

// One entry per hub for the browse-and-filter picker (value is its index into
// HUBS). Sorted by maker then model so the list and maker filter read tidily.
interface HubListItem {
  h: Hub;
  i: number;
  search: string; // lowercased haystack: maker + model + type + width + drillings
}
const HUB_ITEMS: HubListItem[] = HUBS.map((h, i) => ({
  h,
  i,
  search: (
    `${h.manufacturer} ${h.model} ${HUB_TYPE_LABELS[h.type]} ` +
    `${h.widthMm}mm ${h.spokeCounts.join(" ")}`
  ).toLowerCase(),
}))
  .slice()
  .sort(
    (a, b) =>
      a.h.manufacturer.localeCompare(b.h.manufacturer) || a.h.model.localeCompare(b.h.model),
  );

const HUB_MAKERS = Array.from(new Set(HUB_ITEMS.map((e) => e.h.manufacturer))).sort((a, b) =>
  a.localeCompare(b),
);
// Type filter keeps the canonical order from HUB_TYPE_LABELS.
const HUB_TYPE_ORDER = Object.keys(HUB_TYPE_LABELS) as HubType[];

// A browse-and-filter popover of the hub database (mirrors the drivetrain's
// cassette / derailleur pickers): a text search plus maker / type / spoke-count /
// width filters over a scrollable list. Picking a row calls onPick with the hub.
function HubPicker({
  selected,
  onPick,
}: {
  selected: Hub | null;
  onPick: (h: Hub, count: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("all");
  const [type, setType] = useState("all");
  const [count, setCount] = useState("all");
  const [width, setWidth] = useState("all");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Facets narrow left-to-right: type reflects the maker, count reflects both,
  // width reflects all three — so every choice always leaves at least one hub.
  const byMaker = HUB_ITEMS.filter((e) => maker === "all" || e.h.manufacturer === maker);
  const typeFacet = new Set(byMaker.map((e) => e.h.type));
  const byType = byMaker.filter((e) => type === "all" || e.h.type === type);
  const countFacet = Array.from(new Set(byType.flatMap((e) => e.h.spokeCounts))).sort(
    (a, b) => a - b,
  );
  const byCount = byType.filter((e) => count === "all" || e.h.spokeCounts.includes(Number(count)));
  const widthFacet = Array.from(new Set(byCount.map((e) => e.h.widthMm))).sort((a, b) => a - b);

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = byCount.filter(
    (e) =>
      (width === "all" || e.h.widthMm === Number(width)) &&
      tokens.every((t) => e.search.includes(t)),
  );

  const opt = (value: string, label: string) => ({ value, label });
  const makerOptions = [opt("all", "All makers"), ...HUB_MAKERS.map((m) => opt(m, m))];
  const typeOptions = [
    opt("all", "All types"),
    ...HUB_TYPE_ORDER.filter((t) => typeFacet.has(t)).map((t) => opt(t, HUB_TYPE_LABELS[t])),
  ];
  const countOptions = [
    opt("all", "Any holes"),
    ...countFacet.map((n) => opt(String(n), `${n}h`)),
  ];
  const widthOptions = [
    opt("all", "Any width"),
    ...widthFacet.map((w) => opt(String(w), `${w} mm`)),
  ];

  return (
    <div className="cassette-picker" ref={ref}>
      <button
        type="button"
        className={"preset-labelbtn hub-trigger" + (open ? " open" : "")}
        title="Browse the hub database"
        aria-label="Browse the hub database"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ds-name">{selected ? hubName(selected) : "Choose a hub…"}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="cp-pop">
          <input
            className="cp-search"
            type="text"
            autoFocus
            placeholder="Search maker, model, width…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cp-filters cp-filters-4">
            <Select
              value={maker}
              onChange={(m) => {
                setMaker(m);
                setType("all");
                setCount("all");
                setWidth("all");
              }}
              options={makerOptions}
            />
            <Select
              value={type}
              onChange={(t) => {
                setType(t);
                setCount("all");
                setWidth("all");
              }}
              options={typeOptions}
            />
            <Select
              value={count}
              onChange={(c) => {
                setCount(c);
                setWidth("all");
              }}
              options={countOptions}
            />
            <Select value={width} onChange={setWidth} options={widthOptions} />
          </div>
          <ul className="cp-list">
            {matches.map((e) => (
              <li key={e.i}>
                <button
                  type="button"
                  className={selected && e.h === selected ? "active" : ""}
                  onClick={() => {
                    onPick(e.h, count === "all" ? null : Number(count));
                    setOpen(false);
                  }}
                >
                  <span className="cp-name">{hubName(e.h)}</span>
                  <span className="cp-meta">
                    {HUB_TYPE_LABELS[e.h.type]} · {e.h.widthMm} mm · {drillingsLabel(e.h)}
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="cp-empty">No hubs match.</li>}
          </ul>
          <div className="cp-foot">
            {matches.length} hub{matches.length === 1 ? "" : "s"} · flange geometry is approximate —
            measure your hub
          </div>
        </div>
      )}
    </div>
  );
}

export function WheelBuilding() {
  const [erd, setErd] = useState(602);
  const [spokes, setSpokes] = useState(32);
  const [holeDia, setHoleDia] = useState(2.6);

  const [leftFlange, setLeftFlange] = useState(45);
  const [leftOffset, setLeftOffset] = useState(34);
  const [leftCross, setLeftCross] = useState(3);

  const [rightFlange, setRightFlange] = useState(45);
  const [rightOffset, setRightOffset] = useState(17.5);
  const [rightCross, setRightCross] = useState(3);

  // The hub picked from the database, if any (cleared once a hub value is edited
  // by hand, so the trigger no longer claims a specific hub).
  const [hub, setHub] = useState<Hub | null>(null);

  const applyHub = (h: Hub, count: number | null) => {
    setLeftFlange(h.leftFlangeDiaMm);
    setRightFlange(h.rightFlangeDiaMm);
    setLeftOffset(h.leftOffsetMm);
    setRightOffset(h.rightOffsetMm);
    setHoleDia(h.spokeHoleMm ?? 2.6);
    // Set the spoke count from the hub's drillings: the one filtered on if any,
    // else keep the current count when the hub offers it, else its default (32h
    // when available, otherwise the lowest drilling).
    const next =
      count != null && h.spokeCounts.includes(count)
        ? count
        : h.spokeCounts.includes(spokes)
          ? spokes
          : h.spokeCounts.includes(32)
            ? 32
            : h.spokeCounts[0];
    setSpokes(next);
    setHub(h);
  };

  // Editing any hub-geometry value clears the selected hub.
  const edited =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setHub(null);
    };

  const left = useMemo(
    () =>
      spokeLength({
        erdMm: erd,
        spokeCount: spokes,
        cross: leftCross,
        spokeHoleDiameterMm: holeDia,
        side: { flangeDiameterMm: leftFlange, flangeOffsetMm: leftOffset },
      }),
    [erd, spokes, leftCross, holeDia, leftFlange, leftOffset],
  );
  const right = useMemo(
    () =>
      spokeLength({
        erdMm: erd,
        spokeCount: spokes,
        cross: rightCross,
        spokeHoleDiameterMm: holeDia,
        side: { flangeDiameterMm: rightFlange, flangeOffsetMm: rightOffset },
      }),
    [erd, spokes, rightCross, holeDia, rightFlange, rightOffset],
  );

  // Lacing feasibility
  const lacing = checkWheelLacing(spokes, leftCross, rightCross);
  const kmax = maxCross(spokes);
  const countOk = spokes >= 8 && spokes % 2 === 0;
  const leftOk = countOk && leftCross >= 0 && leftCross <= kmax;
  const rightOk = countOk && rightCross >= 0 && rightCross <= kmax;

  // Tension converter. Tool and spoke type are picked separately. Default to a
  // common 2.0 mm steel round spoke on the Park Tool TM-1 if present.
  const tools = useMemo(() => {
    const seen: string[] = [];
    for (const c of TENSION_CURVES) if (!seen.includes(c.tool)) seen.push(c.tool);
    return seen;
  }, []);
  const defaultCurve =
    TENSION_CURVES.find((c) => c.spokeType === "steel round 2.0 mm") ?? TENSION_CURVES[0];
  const [tool, setTool] = useState(defaultCurve.tool);
  const [spokeType, setSpokeType] = useState(defaultCurve.spokeType);

  const spokeOptions = useMemo(() => TENSION_CURVES.filter((c) => c.tool === tool), [tool]);
  const curve = spokeOptions.find((c) => c.spokeType === spokeType) ?? spokeOptions[0];

  // Switching tool keeps the spoke type if the new tool offers it, else falls
  // back to that tool's first spoke.
  function selectTool(next: string) {
    setTool(next);
    const opts = TENSION_CURVES.filter((c) => c.tool === next);
    if (!opts.some((c) => c.spokeType === spokeType)) setSpokeType(opts[0].spokeType);
  }

  return (
    <>
      <Section
        title="Rim"
        info={
          <>
            <strong>ERD</strong> (effective rim diameter) is the diameter at the
            nipple seats — the single biggest error source. Measure it; presets are
            rough starting points that vary a lot by rim depth.
          </>
        }
      >
        <div className="grid">
          <Field label="ERD (effective rim diameter)">
            <div className="number-input">
              <div className="combo">
                <NumberInput value={erd} onChange={setErd} min={200} max={720} />
                <PresetMenu
                  title="Fill ERD from a common rim (approximate)"
                  options={RIM_OPTIONS}
                  onPick={(v) => setErd(parseFloat(v))}
                />
              </div>
              <span className="suffix">mm</span>
            </div>
          </Field>
        </div>
      </Section>

      <Section
        title="Hub"
        info={
          <>
            Flange diameter is the circle through the spoke holes (PCD); the offset
            is centre-to-flange per side. Presets are <strong>approximate</strong> —
            measure your hub. Left/right offsets differ on a dished (rear or disc)
            wheel.
          </>
        }
        action={<HubPicker selected={hub} onPick={applyHub} />}
      >
        <div className="grid">
          <Field label="Spoke count (total)">
            <NumberInput value={spokes} onChange={setSpokes} min={8} step={2} />
          </Field>
          <Field label="Flange hole diameter">
            <NumberInput value={holeDia} onChange={edited(setHoleDia)} suffix="mm" step={0.1} />
          </Field>
        </div>

        <div className="wb-sides">
          <div className="wb-side wb-side-left">
            <h4 className="wb-side-title">Left / non-drive</h4>
            <Field label="Flange diameter">
              <NumberInput value={leftFlange} onChange={edited(setLeftFlange)} suffix="mm" />
            </Field>
            <Field label="Centre-to-flange offset">
              <NumberInput value={leftOffset} onChange={edited(setLeftOffset)} suffix="mm" />
            </Field>
            <Field label="Lacing">
              <Select value={leftCross} onChange={setLeftCross} options={crossOptions} />
            </Field>
          </div>
          <div className="wb-side wb-side-right">
            <h4 className="wb-side-title">Right / drive</h4>
            <Field label="Flange diameter">
              <NumberInput value={rightFlange} onChange={edited(setRightFlange)} suffix="mm" />
            </Field>
            <Field label="Centre-to-flange offset">
              <NumberInput value={rightOffset} onChange={edited(setRightOffset)} suffix="mm" />
            </Field>
            <Field label="Lacing">
              <Select value={rightCross} onChange={setRightCross} options={crossOptions} />
            </Field>
          </div>
        </div>

        {hub && (
          <p className="field-hint wb-hub-source">
            Flange geometry from <HubSourceLink hub={hub} />. Measured values vary between
            production runs — confirm against your hub.
          </p>
        )}
      </Section>

      <Section
        title="Spoke lengths"
        info={
          <>
            Front and rear (and the two sides of a dished wheel) usually differ.
            When between sizes most builders prefer ~1 mm short over long. A 1–2 mm
            ERD error is the usual cause of wrong spokes.
          </>
        }
      >
        <div className="results" style={{ marginBottom: 16 }}>
          <Result
            label="Left / non-drive"
            value={leftOk ? `${left.toFixed(1)} mm` : "—"}
            big
            accent="left"
          />
          <Result
            label="Right / drive"
            value={rightOk ? `${right.toFixed(1)} mm` : "—"}
            big
            accent="right"
          />
        </div>
        {lacing.ok ? (
          <WheelDiagram
            erdMm={erd}
            spokeCount={spokes}
            leftFlangeDiaMm={leftFlange}
            rightFlangeDiaMm={rightFlange}
            leftOffsetMm={leftOffset}
            rightOffsetMm={rightOffset}
            leftCross={leftCross}
            rightCross={rightCross}
            hubType={hub?.type}
            hubWidthMm={hub?.widthMm}
          />
        ) : (
          <Note tone="warn">
            <strong>This lacing can't be built:</strong>
            <ul className="lacing-errors">
              {lacing.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Note>
        )}
      </Section>

      <Section
        title="Spoke tension converter"
        info={
          <>
            Reference curves generated from Park Tool's Wheel Tension App — spot-check
            against the official chart before a real build, and check against the rim's
            max spoke tension (typically ~100–120 kgf). On a dished wheel the two sides
            sit at different tensions by design.
          </>
        }
      >
        <div className="grid">
          <Field label="Tool">
            <Select
              value={tool}
              onChange={selectTool}
              options={tools.map((t) => ({ value: t, label: t }))}
            />
          </Field>
          <Field label="Spoke" hint="spot-check against the official chart">
            <Select
              value={spokeType}
              onChange={setSpokeType}
              options={spokeOptions.map((c) => ({ value: c.spokeType, label: c.spokeType }))}
            />
          </Field>
        </div>
        <TensionCurveChart curve={curve} />
        <p className="field-hint tc-caption">
          The graph reads both ways: mouse over (or drag on touch) to convert a
          tensiometer reading to tension, or find your target tension on the vertical
          axis and read across to the reading you're aiming for. The curve only spans
          the readings this spoke measures meaningfully — pick a spoke size that lands
          your build tension inside it.
        </p>
      </Section>
    </>
  );
}
