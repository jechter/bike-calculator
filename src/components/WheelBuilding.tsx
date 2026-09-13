import { useEffect, useMemo, useRef, useState } from "react";
import {
  spokeLength,
  checkWheelLacing,
  TENSION_CURVES,
  RIM_PRESETS,
  HUBS,
  HUB_TYPE_LABELS,
  flangeSpokeCounts,
  type Hub,
  type HubType,
  type HubRatio,
  type LacingPattern,
} from "../lib/spokes";
import { Field, NumberInput, Select, PresetMenu, Result, Note, Section } from "./ui";
import { WheelDiagram } from "./WheelDiagram";
import { TensionCurveChart } from "./TensionCurveChart";

const RIM_OPTIONS = RIM_PRESETS.map((p) => ({ value: String(p.erdMm), label: p.label }));

// A single lacing menu combining cross count, grouping, and crow's foot — only
// the combinations that actually build are offered. Each choice carries the
// cross / group / pattern the geometry needs; feasibility against the spoke count
// is still checked in checkWheelLacing (which shows a warning for, e.g., 2L2T on a
// count not divisible by 8).
interface LacingChoice {
  value: string;
  label: string;
  cross: number;
  group: number;
  pattern: LacingPattern;
}

const LACING_CHOICES: LacingChoice[] = [
  { value: "radial", label: "Radial", cross: 0, group: 1, pattern: "standard" },
  { value: "1x", label: "1-cross", cross: 1, group: 1, pattern: "standard" },
  { value: "2x", label: "2-cross", cross: 2, group: 1, pattern: "standard" },
  { value: "3x", label: "3-cross", cross: 3, group: 1, pattern: "standard" },
  { value: "4x", label: "4-cross", cross: 4, group: 1, pattern: "standard" },
  { value: "2l2t-2x", label: "2L2T 2-cross", cross: 2, group: 2, pattern: "standard" },
  { value: "2l2t-4x", label: "2L2T 4-cross", cross: 4, group: 2, pattern: "standard" },
  { value: "3l3t-3x", label: "3L3T 3-cross", cross: 3, group: 3, pattern: "standard" },
  { value: "4l4t-4x", label: "4L4T 4-cross", cross: 4, group: 4, pattern: "standard" },
  { value: "cf-2x", label: "Crow's foot 2-cross", cross: 2, group: 1, pattern: "crowsfoot" },
  { value: "cf-3x", label: "Crow's foot 3-cross", cross: 3, group: 1, pattern: "crowsfoot" },
];
const LACING_BY_VALUE: Record<string, LacingChoice> = Object.fromEntries(
  LACING_CHOICES.map((c) => [c.value, c]),
);
const opt = (value: string) => ({ value, label: LACING_BY_VALUE[value].label });

// Menu structure: radial on top, then the plain crosses, then the decorative
// grouped / crow's-foot builds, each an <optgroup> so the sections read clearly.
const LACING_OPTIONS = [
  opt("radial"),
  { label: "Crossed", options: [opt("1x"), opt("2x"), opt("3x"), opt("4x")] },
  {
    label: "Unconventional lacing patterns",
    options: [
      opt("2l2t-2x"),
      opt("2l2t-4x"),
      opt("3l3t-3x"),
      opt("4l4t-4x"),
      opt("cf-2x"),
      opt("cf-3x"),
    ],
  },
];
// The drive side can just mirror the non-drive side (the common case, so it leads
// and is the default).
const RIGHT_LACING_OPTIONS = [{ value: "same", label: "Same as left side" }, ...LACING_OPTIONS];

// Flange spoke split. 2:1 puts twice as many spokes on the drive side to even out
// the wildly different drive/non-drive tensions of a dished rear wheel.
const RATIO_OPTIONS: Array<{ value: HubRatio; label: string }> = [
  { value: "1:1", label: "Standard (1:1)" },
  { value: "2:1", label: "2:1 (drive-doubled)" },
];

// Spoke lengths a side needs, as (count × length) rows. Standard lacing is one
// row (every spoke equal); crow's foot splits into crossed + radial lengths.
interface SpokeSpec {
  count: number;
  lengthMm: number;
  kind: "all" | "crossed" | "radial";
}

// One (count × length) row per distinct spoke a side needs — two rows for crow's
// foot (crossed + radial), each tagged so it's clear which length is which.
function SpokeSpecs({ specs }: { specs: SpokeSpec[] }) {
  return (
    <>
      {specs.map((s) => (
        <span className="spoke-spec-line" key={s.kind}>
          {s.count} × {s.lengthMm.toFixed(1)} mm
          {s.kind !== "all" && <span className="spoke-spec-kind"> · {s.kind}</span>}
        </span>
      ))}
    </>
  );
}

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

// The page opens on a common, well-documented hub so the rendering isn't blank.
const DEFAULT_HUB = HUBS.find((h) => h.manufacturer === "Chris King" && h.model === "R45 Rear");

export function WheelBuilding() {
  const [erd, setErd] = useState(602);
  const [rimHoleOffset, setRimHoleOffset] = useState(0);
  const [spokes, setSpokes] = useState(32);
  const [holeDia, setHoleDia] = useState(DEFAULT_HUB?.spokeHoleMm ?? 2.6);
  const [ratio, setRatio] = useState<HubRatio>("1:1");

  const [leftFlange, setLeftFlange] = useState(DEFAULT_HUB?.leftFlangeDiaMm ?? 45);
  const [leftOffset, setLeftOffset] = useState(DEFAULT_HUB?.leftOffsetMm ?? 34);
  const [leftLace, setLeftLace] = useState("3x");

  const [rightFlange, setRightFlange] = useState(DEFAULT_HUB?.rightFlangeDiaMm ?? 45);
  const [rightOffset, setRightOffset] = useState(DEFAULT_HUB?.rightOffsetMm ?? 17.5);
  const [rightLace, setRightLace] = useState("same"); // mirror the left side by default

  // Resolve each side's menu choice into the cross / group / pattern the geometry
  // uses; the drive side falls back to the non-drive choice when set to "same".
  const leftChoice = LACING_BY_VALUE[leftLace] ?? LACING_BY_VALUE["3x"];
  const rightChoice = rightLace === "same" ? leftChoice : LACING_BY_VALUE[rightLace] ?? leftChoice;
  const { cross: leftCross, group: leftGroup, pattern: leftPattern } = leftChoice;
  const { cross: rightCross, group: rightGroup, pattern: rightPattern } = rightChoice;

  // The hub picked from the database, if any (cleared once a hub value is edited
  // by hand, so the trigger no longer claims a specific hub). Defaults to a
  // common hub so the page opens on a real, fully-specified wheel.
  const [hub, setHub] = useState<Hub | null>(DEFAULT_HUB ?? null);
  // The hub type + width driving the 3D rendering. Kept separate from `hub` so it
  // survives hand-edits — you keep the dynamo/gear/freehub look and axle length
  // even after tweaking a flange or offset.
  const [hubStyle, setHubStyle] = useState<{ type: HubType; widthMm: number } | null>(
    DEFAULT_HUB ? { type: DEFAULT_HUB.type, widthMm: DEFAULT_HUB.widthMm } : null,
  );

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
    setHubStyle({ type: h.type, widthMm: h.widthMm });
  };

  // Switching layout snaps the count to the nearest value that side-splits cleanly
  // (÷3 for 2:1, even for 1:1) so it doesn't land on an immediate error.
  const changeRatio = (r: HubRatio) => {
    setRatio(r);
    const step = r === "2:1" ? 3 : 2;
    if (spokes % step !== 0) setSpokes(Math.max(step * 3, Math.round(spokes / step) * step));
  };

  // Editing any hub-geometry value clears the selected hub.
  const edited =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setHub(null);
    };

  // How the spokes split between the flanges (2:1 doubles the drive side).
  const counts = flangeSpokeCounts(spokes, ratio);

  // Spoke lengths per side, as (count × length) rows. The length formula uses this
  // flange's own spoke count (so a 2:1 side gets the right crossing angle); crow's
  // foot calls it twice — cross-length for each foot's two crossed spokes, 0-cross
  // for its radial one.
  const sideSpecs = (
    cross: number,
    pattern: LacingPattern,
    flangeDiameterMm: number,
    flangeOffsetMm: number,
    flangeSpokes: number,
  ): SpokeSpec[] => {
    const len = (k: number) =>
      spokeLength({
        erdMm: erd,
        spokeCount: spokes,
        cross: k,
        spokeHoleDiameterMm: holeDia,
        side: { flangeDiameterMm, flangeOffsetMm },
        flangeSpokeCount: flangeSpokes,
      });
    if (pattern === "crowsfoot") {
      const radial = flangeSpokes / 3; // one radial per three-spoke foot
      return [
        { count: flangeSpokes - radial, lengthMm: len(cross), kind: "crossed" },
        { count: radial, lengthMm: len(0), kind: "radial" },
      ];
    }
    return [{ count: flangeSpokes, lengthMm: len(cross), kind: "all" }];
  };

  const leftSpecs = useMemo(
    () => sideSpecs(leftCross, leftPattern, leftFlange, leftOffset, counts.nds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [erd, spokes, leftCross, leftPattern, holeDia, leftFlange, leftOffset, counts.nds],
  );
  const rightSpecs = useMemo(
    () => sideSpecs(rightCross, rightPattern, rightFlange, rightOffset, counts.drive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [erd, spokes, rightCross, rightPattern, holeDia, rightFlange, rightOffset, counts.drive],
  );

  // Lacing feasibility
  const lacing = checkWheelLacing(
    spokes,
    leftCross,
    rightCross,
    leftGroup,
    rightGroup,
    leftPattern,
    rightPattern,
    ratio,
  );
  const countOk = spokes >= 8 && (ratio === "2:1" ? spokes % 3 === 0 : spokes % 2 === 0);
  // Whether a side's lengths are meaningful to show, using this flange's own
  // spoke count: max cross is fSide/4, cross lacing needs an even flange, crow's
  // foot needs the flange divisible by 3 and a crossed count clearing the radial.
  const sideOk = (cross: number, pattern: LacingPattern, flangeSpokes: number) => {
    if (!countOk) return false;
    const kmaxSide = Math.floor(flangeSpokes / 4);
    if (pattern === "crowsfoot")
      return flangeSpokes % 3 === 0 && cross >= 2 && cross % 3 !== 1 && cross <= kmaxSide;
    return cross >= 0 && cross <= kmaxSide && (cross === 0 || flangeSpokes % 2 === 0);
  };
  const leftOk = sideOk(leftCross, leftPattern, counts.nds);
  const rightOk = sideOk(rightCross, rightPattern, counts.drive);

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
            rough starting points that vary a lot by rim depth.{" "}
            <strong>Spoke-hole offset</strong> models a rim drilled with
            alternating left/right holes (each leaning toward the flange it feeds);
            leave it 0 for a plain centre-drilled rim.
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
          <Field
            label="Spoke-hole offset (alternating drilling)"
            hint="each hole nudged toward the flange it serves · 0 = centred"
          >
            <NumberInput
              value={rimHoleOffset}
              onChange={setRimHoleOffset}
              min={0}
              max={5}
              step={0.5}
              suffix="mm"
            />
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
            <NumberInput
              value={spokes}
              onChange={setSpokes}
              min={ratio === "2:1" ? 9 : 8}
              step={ratio === "2:1" ? 3 : 2}
            />
          </Field>
          <Field label="Flange hole diameter">
            <NumberInput value={holeDia} onChange={edited(setHoleDia)} suffix="mm" step={0.1} />
          </Field>
          <Field
            label="Hub layout"
            hint={
              ratio === "2:1"
                ? `${counts.drive} drive / ${counts.nds} non-drive`
                : "even split between flanges"
            }
          >
            <Select value={ratio} onChange={changeRatio} options={RATIO_OPTIONS} />
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
              <Select value={leftLace} onChange={setLeftLace} options={LACING_OPTIONS} />
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
              <Select value={rightLace} onChange={setRightLace} options={RIGHT_LACING_OPTIONS} />
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
            value={leftOk ? <SpokeSpecs specs={leftSpecs} /> : "—"}
            big={leftOk && leftSpecs.length === 1}
            accent="left"
          />
          <Result
            label="Right / drive"
            value={rightOk ? <SpokeSpecs specs={rightSpecs} /> : "—"}
            big={rightOk && rightSpecs.length === 1}
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
            leftGroup={leftGroup}
            rightGroup={rightGroup}
            leftPattern={leftPattern}
            rightPattern={rightPattern}
            ratio={ratio}
            rimHoleOffsetMm={rimHoleOffset}
            hubType={hubStyle?.type}
            hubWidthMm={hubStyle?.widthMm}
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
