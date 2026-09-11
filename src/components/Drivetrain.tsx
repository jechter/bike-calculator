import { useEffect, useMemo, useRef, useState } from "react";
import {
  CASSETTE_PRESETS,
  CASSETTE_SPACING_LABELS,
  CHAINRING_PRESETS,
  HUB_PRESETS,
  hubSpeedCount,
  chainWearThresholdsFor,
  computeGears,
  gearRange,
  chainLength,
  type GearResult,
  type HubGear,
  type HubPreset,
  type CassettePreset,
} from "../lib/drivetrain";
import {
  DERAILLEURS,
  DERAILLEUR_SYSTEMS,
  FRICTION_FAMILY,
  derailleurByKey,
  defaultShifterFor,
  derailleurFullName,
  familySupportedSpeeds,
  fitCassette,
  incompatibleReason,
  pullRatioFor,
  shifterLabel,
  type CassetteFit,
  type DerailleurSpec,
  type Shifter,
} from "../lib/derailleur";
import { estimatedCircumferenceMm } from "../lib/wheels";
import { parseTireSize, formatDesignations, suggestTireSizes } from "../lib/tireSizes";
import { kmhToMph } from "../lib/units";
import { useUnits, speedUnitLabel } from "../units-context";
import { Field, NumberInput, TextInput, Select, PresetMenu, Result, Note, Section } from "./ui";
import { GearChart, type GearSeries } from "./GearChart";
import { DrivetrainDiagram } from "./DrivetrainDiagram";

type Mode = "cassette" | "single" | "hub";
type Metric = "speed" | "gearInches" | "development" | "ratio";

function parseList(s: string): number[] {
  return s
    .split(/[\s,]+/)
    .map((x) => parseFloat(x))
    .filter((x) => Number.isFinite(x) && x > 0);
}

// The database has hundreds of cassettes, so the picker narrows in three steps:
// speeds → range (e.g. "11-28") → model. The model list spans every brand for
// that speeds+range config, sorted by brand then model (e.g. "Shimano CS-HG50").
type Opt = { value: string; label: string };
type IndexedPreset = { p: CassettePreset; i: number };

// A range group is keyed by "speeds|smallestCog|largestCog".
function cassetteRangeKey(p: CassettePreset): string {
  return `${p.speeds}|${p.cogs[0]}|${p.cogs[p.cogs.length - 1]}`;
}

function sameCogs(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

// A cassette's model name, falling back to its freehub standard when the source
// lists no model (e.g. a generic "-" entry).
function modelBaseLabel(p: CassettePreset): string {
  return p.model && p.model !== "-" ? p.model : p.freehub;
}

// Model dropdown options for one range group (across all brands). Exact
// duplicates (same brand + model + cog sequence) are collapsed; entries that
// would otherwise share a label get the cog sequence appended to stay distinct.
function buildModelOptions(entries: IndexedPreset[]): Opt[] {
  const seen = new Set<string>();
  const uniq = entries.filter(({ p }) => {
    const sig = `${p.brand}|${p.model}|${p.cogs.join("-")}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  const shortLabel = (p: CassettePreset) => {
    const parts = [`${p.brand} ${modelBaseLabel(p)}`];
    if (p.special) parts.push(p.special);
    if (p.weightGrams) parts.push(`${p.weightGrams}g`);
    return parts.join(" · ");
  };
  const counts: Record<string, number> = {};
  for (const { p } of uniq) counts[shortLabel(p)] = (counts[shortLabel(p)] ?? 0) + 1;
  return uniq.map(({ p, i }) => {
    if (counts[shortLabel(p)] <= 1) return { value: String(i), label: shortLabel(p) };
    const parts = [`${p.brand} ${modelBaseLabel(p)}`];
    if (p.special) parts.push(p.special);
    parts.push(p.cogs.join("-"));
    if (p.weightGrams) parts.push(`${p.weightGrams}g`);
    return { value: String(i), label: parts.join(" · ") };
  });
}

// Global (all-brand) lookups: the sorted speed counts; the range options per
// speed; the model options per range-key. Speed/range option values are plain
// keys; model option values are indices into CASSETTE_PRESETS.
const byRange: Record<string, IndexedPreset[]> = {};
CASSETTE_PRESETS.forEach((p, i) => {
  (byRange[cassetteRangeKey(p)] ??= []).push({ p, i });
});

// Deduped model options per range key (used to seed a selection from cogs).
const CASSETTE_MODELS_BY_RANGE: Record<string, Opt[]> = {};
for (const k of Object.keys(byRange)) {
  CASSETTE_MODELS_BY_RANGE[k] = buildModelOptions(
    byRange[k].sort(
      (a, b) =>
        a.p.brand.localeCompare(b.p.brand) ||
        modelBaseLabel(a.p).localeCompare(modelBaseLabel(b.p)),
    ),
  );
}

// One entry per (deduped) cassette, for the browse-and-filter picker.
interface CassetteListItem {
  i: number; // index into CASSETTE_PRESETS
  label: string; // "Brand Model · special · weight"
  brand: string;
  speeds: number;
  lo: number;
  hi: number;
  rangeLabel: string; // "11-28"
  search: string; // lowercased haystack: label + freehub + cogs
}

const CASSETTE_LIST: CassetteListItem[] = Object.entries(CASSETTE_MODELS_BY_RANGE)
  .flatMap(([key, opts]) => {
    const [speeds, lo, hi] = key.split("|").map(Number);
    return opts.map((o) => {
      const i = parseInt(o.value);
      const p = CASSETTE_PRESETS[i];
      return {
        i,
        label: o.label,
        brand: p.brand,
        speeds,
        lo,
        hi,
        rangeLabel: `${lo}-${hi}`,
        search: `${o.label} ${p.freehub} ${p.cogs.join("-")}`.toLowerCase(),
      };
    });
  })
  .sort(
    (a, b) =>
      a.brand.localeCompare(b.brand) || a.speeds - b.speeds || a.lo - b.lo || a.hi - b.hi,
  );

const CASSETTE_BRANDS = Array.from(new Set(CASSETTE_LIST.map((c) => c.brand))).sort((a, b) =>
  a.localeCompare(b),
);

// Model-option index for a cog list, or -1 when none match. Used to seed the
// selected model from a starting cog string; `preferBrand` picks that brand's
// entry when several brands share the cogs (else the first, brand-sorted).
// Returns a *surviving* (post-dedup) option index, always present in the list.
function cassetteModelIdx(cogs: number[], preferBrand?: string): number {
  if (!cogs.length) return -1;
  const key = `${cogs.length}|${cogs[0]}|${cogs[cogs.length - 1]}`;
  const matches = (CASSETTE_MODELS_BY_RANGE[key] ?? []).filter((o) =>
    sameCogs(CASSETTE_PRESETS[parseInt(o.value)].cogs, cogs),
  );
  if (!matches.length) return -1;
  const preferred = preferBrand
    ? matches.find((o) => CASSETTE_PRESETS[parseInt(o.value)].brand === preferBrand)
    : undefined;
  return parseInt((preferred ?? matches[0]).value);
}

// Link (labelled with the cassette's name) to where its cogs came from; falls
// back to the plain "comma-separated tooth counts" hint for a custom cog list.
function CassetteSourceLink({ preset }: { preset: CassettePreset | null }) {
  const src = preset?.source;
  if (!preset || !src) return <>comma-separated tooth counts</>;
  return (
    <a
      className="inline-link"
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${src.sourceType} source${src.note ? ` — ${src.note}` : ""}`}
    >
      {preset.brand} {modelBaseLabel(preset)} ↗
    </a>
  );
}

const CRANKSET_OPTIONS = CHAINRING_PRESETS.map((p) => ({
  value: p.rings.join(", "),
  label: p.label,
}));

// One entry per derailleur for the browse-and-filter picker.
interface DerailleurListItem {
  d: DerailleurSpec;
  search: string;
}
const DERAILLEUR_LIST: DerailleurListItem[] = DERAILLEURS.map((d) => ({
  d,
  search: (
    `${d.brand} ${d.model} ${d.series ?? ""} ${d.discipline} ${d.speeds}sp ` +
    `${d.cage ?? ""} ${d.electronic ?? ""} ${d.actuation ?? ""}`
  ).toLowerCase(),
})).sort(
  (a, b) =>
    a.d.brand.localeCompare(b.d.brand) ||
    a.d.speeds - b.d.speeds ||
    a.d.model.localeCompare(b.d.model),
);
const DERAILLEUR_BRANDS = Array.from(new Set(DERAILLEUR_LIST.map((e) => e.d.brand))).sort((a, b) =>
  a.localeCompare(b),
);

function derailleurOptionLabel(d: DerailleurSpec): string {
  const max = d.maxSprocket != null ? ` · max ${d.maxSprocket}T` : "";
  return `${derailleurFullName(d)} · ${d.speeds}sp${max}`;
}

// Hint under the Setup derailleur field: the "optional" note until one is
// picked, then a link to that derailleur's spec source (falling back to the
// derailleur database when the row carries no source URL).
function DerailleurFieldHint({ d }: { d: DerailleurSpec | undefined }) {
  if (!d) return <>Optional - only used to verify compatibility</>;
  const src = d.source;
  if (src) {
    return (
      <a
        className="inline-link"
        href={src.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`${src.sourceType} source${src.note ? ` — ${src.note}` : ""}`}
      >
        {derailleurFullName(d)} specs ↗
      </a>
    );
  }
  return (
    <a className="inline-link" href="#/derailleur">
      open the derailleur database →
    </a>
  );
}

// How many rows to render before asking the user to refine (keeps the DOM light
// when the picker opens unfiltered on all ~550 derailleurs).
const DERAILLEUR_LIST_CAP = 200;

// A browse-and-filter popover of every derailleur: a text search plus brand /
// discipline / speeds filters, narrowing a scrollable list. Picking a row sets
// the selected derailleur (via onPick with its key); "— none —" clears it.
function DerailleurPicker({
  selectedKey,
  onPick,
}: {
  selectedKey: string;
  onPick: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [discipline, setDiscipline] = useState("all");
  const [speeds, setSpeeds] = useState("all");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Facets narrow left-to-right: speeds reflect the brand + discipline.
  const byBrand = DERAILLEUR_LIST.filter((e) => brand === "all" || e.d.brand === brand);
  const byDiscipline = byBrand.filter((e) => discipline === "all" || e.d.discipline === discipline);
  const speedFacet = Array.from(new Set(byDiscipline.map((e) => e.d.speeds))).sort((a, b) => a - b);

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = byDiscipline.filter(
    (e) =>
      (speeds === "all" || e.d.speeds === Number(speeds)) &&
      tokens.every((t) => e.search.includes(t)),
  );
  const shown = matches.slice(0, DERAILLEUR_LIST_CAP);

  const opt = (value: string, label: string) => ({ value, label });
  const brandOptions = [opt("all", "All brands"), ...DERAILLEUR_BRANDS.map((b) => opt(b, b))];
  const disciplineOptions = [
    opt("all", "All types"),
    opt("Road", "Road"),
    opt("Gravel", "Gravel"),
    opt("MTB", "MTB"),
  ];
  const speedsOptions = [opt("all", "All speeds"), ...speedFacet.map((s) => opt(String(s), `${s}-speed`))];

  const selected = derailleurByKey(selectedKey);

  return (
    <div className="cassette-picker derailleur-select" ref={ref}>
      <button
        type="button"
        className={"preset-btn" + (open ? " open" : "")}
        title="Browse the derailleur database"
        aria-label="Browse the derailleur database"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ds-name">
          {selected ? derailleurFullName(selected) : "— unspecified —"}
        </span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="cp-pop">
          <input
            className="cp-search"
            type="text"
            autoFocus
            placeholder="Search brand, model, series…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cp-filters">
            <Select
              value={brand}
              onChange={(b) => {
                setBrand(b);
                setSpeeds("all");
              }}
              options={brandOptions}
            />
            <Select
              value={discipline}
              onChange={(d) => {
                setDiscipline(d);
                setSpeeds("all");
              }}
              options={disciplineOptions}
            />
            <Select value={speeds} onChange={setSpeeds} options={speedsOptions} />
          </div>
          <ul className="cp-list">
            <li>
              <button
                type="button"
                className={selectedKey === "" ? "active" : ""}
                onClick={() => {
                  onPick("");
                  setOpen(false);
                }}
              >
                <span className="cp-name">— unspecified —</span>
              </button>
            </li>
            {shown.map((e) => (
              <li key={e.d.key}>
                <button
                  type="button"
                  className={e.d.key === selectedKey ? "active" : ""}
                  onClick={() => {
                    onPick(e.d.key);
                    setOpen(false);
                  }}
                >
                  <span className="cp-name">{derailleurOptionLabel(e.d)}</span>
                  <span className="cp-meta">
                    {e.d.discipline}
                    {e.d.totalCapacity != null ? ` · ${e.d.totalCapacity}T cap` : ""}
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="cp-empty">No derailleurs match.</li>}
          </ul>
          <div className="cp-foot">
            {matches.length} derailleur{matches.length === 1 ? "" : "s"}
            {matches.length > shown.length && ` · showing first ${shown.length}, refine to narrow`}
          </div>
        </div>
      )}
    </div>
  );
}

// Shifter family options: Friction (any cog count) and "Other / unspecified"
// first, then every actuation family (electronic included).
const SHIFTER_FAMILY_OPTIONS = [
  { value: FRICTION_FAMILY, label: "Friction" },
  { value: "", label: "Other / unspecified" },
  ...DERAILLEUR_SYSTEMS.map((s) => ({ value: s.family, label: s.family })),
];

// Speed-count choices for an indexed shifter: the family's own supported counts
// (a family groups derailleurs sharing one pull ratio), or a generic spread when
// the family is unknown.
function shifterSpeedChoices(family: string): number[] {
  const supported = familySupportedSpeeds(family);
  return supported.length ? supported : [7, 8, 9, 10, 11, 12, 13];
}

// The Setup "Shifter" control, shown once a derailleur is chosen: an actuation-
// family select plus a speed-count select (hidden for Friction, which indexes
// nothing and so takes any cog count). This is what makes the fit verdict
// accurate — the derailleur just moves, the shifter indexes. Selecting a
// derailleur seeds this with its default (see defaultShifterFor); changeable.
function ShifterField({ cfg }: { cfg: DrivetrainConfig }) {
  const shifter = cfg.shifter;
  if (!shifter) return null;
  const friction = shifter.family === FRICTION_FAMILY;
  const unspecified = shifter.family === "";
  const speedChoices = shifterSpeedChoices(shifter.family);
  // The speed picker only appears for a real indexed family with a choice to make
  // — hidden for Friction (any count), Other/unspecified (not checked), and
  // single-speed families like Shimano road 12-speed.
  const showSpeeds = !friction && !unspecified && speedChoices.length > 1;

  return (
    <div className="shifter-field">
      <Select
        value={shifter.family}
        options={SHIFTER_FAMILY_OPTIONS}
        onChange={(f) => {
          if (f === FRICTION_FAMILY || f === "") {
            cfg.setShifter({ family: f, speeds: shifter.speeds });
            return;
          }
          // Keep the speed count if the new family supports it, else snap to the
          // family's first supported count.
          const choices = shifterSpeedChoices(f);
          const nextSpeeds = choices.includes(shifter.speeds) ? shifter.speeds : choices[0];
          cfg.setShifter({ family: f, speeds: nextSpeeds });
        }}
      />
      {showSpeeds && (
        <Select
          value={String(shifter.speeds)}
          options={speedChoices.map((n) => ({ value: String(n), label: `${n}-speed` }))}
          onChange={(s) => cfg.setShifter({ family: shifter.family, speeds: Number(s) })}
        />
      )}
    </div>
  );
}

// The hub picker (below) narrows a single list; makers are sorted by name for
// its maker filter, and the list sorts by maker → speed count (CVT last) → name.
const HUB_MAKER_OPTIONS = Array.from(new Set(HUB_PRESETS.map((p) => p.manufacturer)))
  .sort((a, b) => a.localeCompare(b))
  .map((m) => ({ value: m, label: m }));

// Type facet: internal-gear hub, bottom-bracket gearbox, or CVT.
function hubTypeLabel(p: HubPreset): string {
  if (p.continuouslyVariable) return "CVT";
  return p.kind === "bottomBracket" ? "Gearbox" : "Hub";
}

// The meta line under a hub's name in the picker (speeds · type · derailleur-ready).
function hubMetaLabel(p: HubPreset): string {
  const speeds = p.continuouslyVariable ? "CVT" : `${p.gears.length}-speed`;
  const type = p.kind === "bottomBracket" ? "gearbox" : "hub";
  return `${speeds} · ${type}${p.derailleurCompatible ? " · derailleur-ready" : ""}`;
}

// One entry per hub for the browse-and-filter picker (value is its index into
// HUB_PRESETS, which is what a config stores as `hubIdx`).
interface HubListItem {
  p: HubPreset;
  i: number;
  search: string; // lowercased haystack: name + maker + type + speeds
}
const HUB_LIST: HubListItem[] = HUB_PRESETS.map((p, i) => ({
  p,
  i,
  search: (
    `${p.label} ${p.manufacturer} ${hubTypeLabel(p)} ` +
    `${p.continuouslyVariable ? "cvt" : `${p.gears.length}-speed`}` +
    `${p.derailleurCompatible ? " derailleur cassette combo" : ""}`
  ).toLowerCase(),
}))
  .slice()
  .sort(
    (a, b) =>
      a.p.manufacturer.localeCompare(b.p.manufacturer) ||
      hubSpeedCount(a.p) - hubSpeedCount(b.p) ||
      a.p.label.localeCompare(b.p.label),
  );

// Default to a common 3-speed (Sturmey-Archer AW-type) if present.
const DEFAULT_HUB_IDX = Math.max(
  0,
  HUB_PRESETS.findIndex((p) => p.label === "Sturmey Archer S3"),
);

// A browse-and-filter popover of every hub (mirrors the derailleur picker): a
// text search plus maker / type filters over a scrollable list. Picking a row
// sets the hub via onPick with its index into HUB_PRESETS. The trigger shows the
// current hub's name, full-width like the derailleur field.
function HubPicker({
  selectedIdx,
  onPick,
}: {
  selectedIdx: number;
  onPick: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("all");
  const [type, setType] = useState("all");
  const [gears, setGears] = useState("all");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Facets narrow left-to-right: type reflects the maker, gears reflect both.
  // CVT hubs have no discrete gear count, so they only surface under "All gears".
  const byMaker = HUB_LIST.filter((e) => maker === "all" || e.p.manufacturer === maker);
  const typeFacet = new Set(byMaker.map((e) => hubTypeLabel(e.p)));
  const byType = byMaker.filter((e) => type === "all" || hubTypeLabel(e.p) === type);
  const gearsFacet = Array.from(
    new Set(byType.filter((e) => !e.p.continuouslyVariable).map((e) => e.p.gears.length)),
  ).sort((a, b) => a - b);
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = byType.filter(
    (e) =>
      (gears === "all" || (!e.p.continuouslyVariable && e.p.gears.length === Number(gears))) &&
      tokens.every((t) => e.search.includes(t)),
  );

  const opt = (value: string, label: string) => ({ value, label });
  const makerOptions = [opt("all", "All makers"), ...HUB_MAKER_OPTIONS];
  const typeOptions = [
    opt("all", "All types"),
    ...["Hub", "Gearbox", "CVT"].filter((t) => typeFacet.has(t)).map((t) => opt(t, t)),
  ];
  const gearsOptions = [
    opt("all", "All gears"),
    ...gearsFacet.map((n) => opt(String(n), `${n}-speed`)),
  ];

  const selected = HUB_PRESETS[selectedIdx];

  return (
    <div className="cassette-picker derailleur-select" ref={ref}>
      <button
        type="button"
        className={"preset-btn" + (open ? " open" : "")}
        title="Browse the hub database"
        aria-label="Browse the hub database"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ds-name">{selected.label}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="cp-pop">
          <input
            className="cp-search"
            type="text"
            autoFocus
            placeholder="Search maker, model, type…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cp-filters">
            <Select
              value={maker}
              onChange={(m) => {
                setMaker(m);
                setType("all");
                setGears("all");
              }}
              options={makerOptions}
            />
            <Select
              value={type}
              onChange={(t) => {
                setType(t);
                setGears("all");
              }}
              options={typeOptions}
            />
            <Select value={gears} onChange={setGears} options={gearsOptions} />
          </div>
          <ul className="cp-list">
            {matches.map((e) => (
              <li key={e.i}>
                <button
                  type="button"
                  className={e.i === selectedIdx ? "active" : ""}
                  onClick={() => {
                    onPick(e.i);
                    setOpen(false);
                  }}
                >
                  <span className="cp-name">{e.p.label}</span>
                  <span className="cp-meta">{hubMetaLabel(e.p)}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="cp-empty">No hubs match.</li>}
          </ul>
          <div className="cp-foot">
            {matches.length} hub{matches.length === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}

// A continuously-variable drivetrain: a CVT hub in hub mode. It has no discrete
// gear count (shown as ∞) and draws as a continuous range in the chart.
function isCvt(cfg: { mode: Mode; hubIdx: number }): boolean {
  return cfg.mode === "hub" && HUB_PRESETS[cfg.hubIdx].continuouslyVariable;
}

// A derailleur-compatible hub (Schlumpf, Classified, Brompton, Sachs 3×7…) is
// always shown with a rear derailleur + cassette: computeGears multiplies the
// hub ratios through every cassette cog, so the hub steps act like extra front
// gears over the cassette.
function comboActive(cfg: { mode: Mode; hubIdx: number }): boolean {
  return cfg.mode === "hub" && HUB_PRESETS[cfg.hubIdx].derailleurCompatible;
}

// Whether this config runs a rear derailleur + cassette: plain cassette mode, or
// a derailleur-compatible hub. Gates the derailleur fit check, the derailleur
// chain-length formula, and the narrow-chain wear thresholds.
function hasDerailleur(cfg: { mode: Mode; hubIdx: number }): boolean {
  return cfg.mode === "cassette" || comboActive(cfg);
}

// Link (labelled with the hub's name) to where its ratios came from.
function HubSourceLink({ hub }: { hub: HubPreset }) {
  const src = hub.source;
  if (!src) return <>internal ratios — verify against maker's data</>;
  return (
    <a
      className="inline-link"
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${src.sourceType} source${src.note ? ` — ${src.note}` : ""}`}
    >
      {hub.label} ↗
    </a>
  );
}

// --- Per-drivetrain config --------------------------------------------------
// All the state describing one drivetrain, including its wheel's rolling
// circumference (so a comparison can span two different bikes, or the same bike
// with a different wheel/tire). Cadence is shared across configs — it's just the
// axis parameter for the speed visualisation, not part of a drivetrain.

interface ConfigInit {
  mode: Mode;
  chainringStr: string;
  cogStr: string;
  /** Selected cassette model (index into CASSETTE_PRESETS), or -1 for custom. */
  cassetteIdx: number;
  singleRing: number;
  singleCog: number;
  hubIdx: number;
  derailleurId: string;
  /** The shifter paired with the derailleur (drives the compatibility check);
   *  null when no derailleur is chosen. */
  shifter: Shifter | null;
  circ: number;
  /** Tire size the circumference came from (for the Tire-calculator link), or
   *  "" when a raw circumference was typed in. */
  tireSize: string;
}

interface DrivetrainConfig extends ConfigInit {
  setMode: (m: Mode) => void;
  setChainringStr: (s: string) => void;
  setCogStr: (s: string) => void;
  setCassetteIdx: (n: number) => void;
  setSingleRing: (n: number) => void;
  setSingleCog: (n: number) => void;
  setHubIdx: (n: number) => void;
  setDerailleurId: (s: string) => void;
  setShifter: (s: Shifter | null) => void;
  setCirc: (n: number) => void;
  setTireSize: (s: string) => void;
}

function useDrivetrainConfig(init: ConfigInit): DrivetrainConfig {
  const [mode, setMode] = useState<Mode>(init.mode);
  const [chainringStr, setChainringStr] = useState(init.chainringStr);
  const [cogStr, setCogStr] = useState(init.cogStr);
  const [cassetteIdx, setCassetteIdx] = useState(init.cassetteIdx);
  const [singleRing, setSingleRing] = useState(init.singleRing);
  const [singleCog, setSingleCog] = useState(init.singleCog);
  const [hubIdx, setHubIdx] = useState(init.hubIdx);
  const [derailleurId, setDerailleurId] = useState(init.derailleurId);
  const [shifter, setShifter] = useState<Shifter | null>(init.shifter);
  const [circ, setCirc] = useState(init.circ);
  const [tireSize, setTireSize] = useState(init.tireSize);
  return {
    mode,
    chainringStr,
    cogStr,
    cassetteIdx,
    singleRing,
    singleCog,
    hubIdx,
    derailleurId,
    shifter,
    circ,
    tireSize,
    setMode,
    setChainringStr,
    setCogStr,
    setCassetteIdx,
    setSingleRing,
    setSingleCog,
    setHubIdx,
    setDerailleurId,
    setShifter,
    setCirc,
    setTireSize,
  };
}

// Copy every field of one drivetrain config into another (used to seed the
// comparison drivetrain from the first, so a single change can be isolated).
function copyConfig(from: DrivetrainConfig, to: DrivetrainConfig) {
  to.setMode(from.mode);
  to.setChainringStr(from.chainringStr);
  to.setCogStr(from.cogStr);
  to.setCassetteIdx(from.cassetteIdx);
  to.setSingleRing(from.singleRing);
  to.setSingleCog(from.singleCog);
  to.setHubIdx(from.hubIdx);
  to.setDerailleurId(from.derailleurId);
  to.setShifter(from.shifter);
  to.setCirc(from.circ);
  to.setTireSize(from.tireSize);
}

interface Derived {
  chainrings: number[];
  cogs: number[];
  hubGears?: HubGear[];
  gears: GearResult[];
}

function useDerived(cfg: DrivetrainConfig, cadence: number): Derived {
  return useMemo(() => {
    // In combo mode the front is a single chainring and the cogs come from the
    // cassette (the hub gears multiply through them, like extra front gears).
    const combo = comboActive(cfg);
    const chainrings = cfg.mode === "cassette" ? parseList(cfg.chainringStr) : [cfg.singleRing];
    const cogs = cfg.mode === "cassette" || combo ? parseList(cfg.cogStr) : [cfg.singleCog];
    const hubGears: HubGear[] | undefined =
      cfg.mode === "hub" ? HUB_PRESETS[cfg.hubIdx].gears : undefined;
    const gears = computeGears({
      chainrings,
      cogs,
      circumferenceMm: cfg.circ,
      cadenceRpm: cadence,
      hubGears,
    });
    return { chainrings, cogs, hubGears, gears };
  }, [cfg.mode, cfg.chainringStr, cfg.cogStr, cfg.singleRing, cfg.singleCog, cfg.hubIdx, cfg.circ, cadence]);
}

// Cross-chaining: only meaningful with 2+ chainrings. Flag big ring + the two
// largest cogs, and small ring + the two smallest cogs, as gears to avoid.
function makeCrossChained(mode: Mode, chainrings: number[], cogs: number[]) {
  return (g: GearResult): boolean => {
    if (mode !== "cassette" || chainrings.length < 2) return false;
    const maxRing = Math.max(...chainrings);
    const minRing = Math.min(...chainrings);
    const sortedCogs = [...cogs].sort((a, b) => a - b);
    const n = Math.min(2, Math.max(1, sortedCogs.length - 1));
    const smallCogs = sortedCogs.slice(0, n);
    const largeCogs = sortedCogs.slice(-n);
    if (g.chainring === maxRing && largeCogs.includes(g.cog)) return true;
    if (g.chainring === minRing && smallCogs.includes(g.cog)) return true;
    return false;
  };
}

// How many list rows to render before asking the user to refine (keeps the DOM
// light when the picker opens unfiltered on all ~1000 cassettes).
const CASSETTE_LIST_CAP = 200;

// Traffic-light label for a cassette-fit dot's tooltip. Incompatible splits by
// cause (physical range vs shifter indexing) so it agrees with the Gears badge.
function fitDotLabel(fit: CassetteFit): string {
  if (fit.level === "ok") return "fits this derailleur";
  if (fit.level === "caution") return "marginal — check carefully";
  const reason = incompatibleReason(fit);
  if (reason === "spacing") return "wrong cog spacing for this drivetrain";
  if (reason === "indexing") return "indexing mismatch with the shifter";
  return "out of range for this derailleur";
}

// A browse-and-filter popover of every cassette: a text search plus brand /
// speeds / range filters, narrowing a scrollable list. Picking a row fills the
// cog field (via onPick). Anchored to a caret button inside the cog field.
// When a derailleur is selected (fitDerailleur), each row gets a green/amber/red
// dot showing how that cassette fits it against the current chainrings.
function CassettePicker({
  selectedIdx,
  onPick,
  fitDerailleur,
  fitChainrings,
  fitShifter,
}: {
  selectedIdx: number;
  onPick: (i: number) => void;
  fitDerailleur?: DerailleurSpec | null;
  fitChainrings?: number[];
  fitShifter?: Shifter | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [speeds, setSpeeds] = useState("all");
  const [range, setRange] = useState("all");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Facets narrow left-to-right: speeds reflect the brand, ranges reflect both.
  const byBrand = CASSETTE_LIST.filter((c) => brand === "all" || c.brand === brand);
  const speedFacet = Array.from(new Set(byBrand.map((c) => c.speeds))).sort((a, b) => a - b);
  const bySpeed = byBrand.filter((c) => speeds === "all" || String(c.speeds) === speeds);
  const rangeFacet = Array.from(new Set(bySpeed.map((c) => c.rangeLabel))).sort((a, b) => {
    const [la, ha] = a.split("-").map(Number);
    const [lb, hb] = b.split("-").map(Number);
    return la - lb || ha - hb;
  });

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = bySpeed.filter(
    (c) =>
      (range === "all" || c.rangeLabel === range) &&
      tokens.every((t) => c.search.includes(t)),
  );

  // Pair each match with its fit (once) so we can both sort and render from it.
  // When a derailleur is selected, best-fitting cassettes float to the top
  // (fits → marginal → incompatible); ties keep the brand/speed/range order. The
  // sort is stable, so with no derailleur the list is unchanged.
  const FIT_RANK: Record<"ok" | "caution" | "incompatible", number> = {
    ok: 0,
    caution: 1,
    incompatible: 2,
  };
  const ranked = matches.map((c) => ({
    c,
    fit: fitDerailleur
      ? fitCassette(
          fitDerailleur,
          fitChainrings ?? [],
          CASSETTE_PRESETS[c.i].cogs,
          fitShifter,
          CASSETTE_PRESETS[c.i].spacing,
        )
      : null,
  }));
  if (fitDerailleur) ranked.sort((a, b) => FIT_RANK[a.fit!.level] - FIT_RANK[b.fit!.level]);
  const shown = ranked.slice(0, CASSETTE_LIST_CAP);

  const opt = (value: string, label: string) => ({ value, label });
  const brandOptions = [opt("all", "All brands"), ...CASSETTE_BRANDS.map((b) => opt(b, b))];
  const speedsOptions = [opt("all", "All speeds"), ...speedFacet.map((s) => opt(String(s), `${s}-speed`))];
  const rangeOptions = [opt("all", "All ranges"), ...rangeFacet.map((r) => opt(r, r))];

  return (
    <div className="cassette-picker" ref={ref}>
      <button
        type="button"
        className={"preset-btn" + (open ? " open" : "")}
        title="Browse the cassette database"
        aria-label="Browse the cassette database"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Browse <span className="caret">▾</span>
      </button>
      {open && (
        <div className="cp-pop">
          <input
            className="cp-search"
            type="text"
            autoFocus
            placeholder="Search brand, model, cogs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cp-filters">
            <Select
              value={brand}
              onChange={(b) => {
                setBrand(b);
                setSpeeds("all");
                setRange("all");
              }}
              options={brandOptions}
            />
            <Select
              value={speeds}
              onChange={(s) => {
                setSpeeds(s);
                setRange("all");
              }}
              options={speedsOptions}
            />
            <Select value={range} onChange={setRange} options={rangeOptions} />
          </div>
          <ul className="cp-list">
            {shown.map(({ c, fit }) => {
              return (
                <li key={c.i}>
                  <button
                    type="button"
                    className={c.i === selectedIdx ? "active" : ""}
                    onClick={() => {
                      onPick(c.i);
                      setOpen(false);
                    }}
                  >
                    <span className="cp-name">
                      {fit && (
                        <span
                          className={"cp-fit-dot " + fit.level}
                          title={`${fitDerailleur!.brand} ${fitDerailleur!.model}: ${fitDotLabel(fit)}`}
                        />
                      )}
                      {c.label}
                    </span>
                    <span className="cp-meta">
                      {c.speeds}-speed · {c.rangeLabel}
                    </span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="cp-empty">No cassettes match.</li>}
          </ul>
          {fitDerailleur && (
            <div className="cp-legend">
              Fit vs <strong>{fitDerailleur.brand} {fitDerailleur.model}</strong>:{" "}
              <span className="cp-fit-dot ok" /> fits{" "}
              <span className="cp-fit-dot caution" /> marginal{" "}
              <span className="cp-fit-dot incompatible" /> incompatible
            </div>
          )}
          <div className="cp-foot">
            {matches.length} cassette{matches.length === 1 ? "" : "s"}
            {matches.length > shown.length && ` · showing first ${shown.length}, refine to narrow`}
          </div>
        </div>
      )}
    </div>
  );
}

// Cassette input: the editable cog field with a "Browse" foldout that opens the
// searchable/filterable cassette picker. The chosen model is tracked by index in
// state (several models share identical cogs, so it can't be re-derived from the
// cogs); the cog-field hint links its source while the cogs still match it.
function CassetteFields({ cfg }: { cfg: DrivetrainConfig }) {
  const cogs = parseList(cfg.cogStr);
  const selected = cfg.cassetteIdx >= 0 ? CASSETTE_PRESETS[cfg.cassetteIdx] : null;
  const modelMatches = !!selected && sameCogs(selected.cogs, cogs);
  // When a rear derailleur is chosen, the picker dots each cassette by fit.
  const derailleur = derailleurByKey(cfg.derailleurId);
  // Cassette mode has a multi-ring crankset; a hub combo has a single front ring.
  const fitChainrings = cfg.mode === "cassette" ? parseList(cfg.chainringStr) : [cfg.singleRing];

  return (
    <Field
      label="Cassette cogs"
      hint={<CassetteSourceLink preset={modelMatches ? selected : null} />}
    >
      <div className="combo">
        <TextInput value={cfg.cogStr} onChange={cfg.setCogStr} />
        <CassettePicker
          selectedIdx={modelMatches ? cfg.cassetteIdx : -1}
          onPick={(i) => {
            cfg.setCassetteIdx(i);
            cfg.setCogStr(CASSETTE_PRESETS[i].cogs.join(", "));
          }}
          fitDerailleur={derailleur}
          fitChainrings={fitChainrings}
          fitShifter={cfg.shifter}
        />
      </div>
    </Field>
  );
}

// The mode + chainring/cog/hub inputs for one config (the shared rolling
// circumference lives outside, on its own row).
function SetupFields({ cfg }: { cfg: DrivetrainConfig }) {
  const typeField = (
    <Field label="Drivetrain type">
      <Select<Mode>
        value={cfg.mode}
        onChange={cfg.setMode}
        options={[
          { value: "cassette", label: "Derailleur (cassette)" },
          { value: "single", label: "Single speed / fixed" },
          { value: "hub", label: "Internal gears" },
        ]}
      />
    </Field>
  );

  // Cassette mode groups the derailleur, shifter and cassette on their own row
  // (dt-setup-trio) so they sit side by side on a single drivetrain, and stack in
  // the narrower Compare columns.
  if (cfg.mode === "cassette") {
    return (
      <>
        <div className="grid">
          {typeField}
          <Field label="Chainrings" hint="comma-separated tooth counts">
            <div className="combo">
              <TextInput value={cfg.chainringStr} onChange={cfg.setChainringStr} />
              <PresetMenu
                title="Fill from a common crankset"
                options={CRANKSET_OPTIONS}
                onPick={cfg.setChainringStr}
              />
            </div>
          </Field>
        </div>
        <div className="grid dt-setup-trio">
          <Field
            label="Rear derailleur"
            hint={<DerailleurFieldHint d={derailleurByKey(cfg.derailleurId)} />}
          >
            <DerailleurPicker
              selectedKey={cfg.derailleurId}
              onPick={(key) => {
                cfg.setDerailleurId(key);
                // Seed the shifter with the derailleur's default (changeable).
                cfg.setShifter(defaultShifterFor(derailleurByKey(key)));
              }}
            />
          </Field>
          {cfg.derailleurId && cfg.shifter && (
            <Field label="Shifter" hint="used to verify compatibility">
              <ShifterField cfg={cfg} />
            </Field>
          )}
          <CassetteFields cfg={cfg} />
        </div>
      </>
    );
  }

  // Hub mode: a single chainring + sprocket driving an internally-geared hub.
  // Derailleur-compatible hubs (Schlumpf, Classified, Brompton, Sachs 3×7…) add
  // a toggle that swaps the single sprocket for a full rear derailleur + cassette
  // (its own row, like cassette mode), so the hub steps multiply through the cogs.
  if (cfg.mode === "hub") {
    const hub = HUB_PRESETS[cfg.hubIdx];
    const combo = comboActive(cfg);
    return (
      <>
        <div className="grid">
          {typeField}
          <Field label="Chainring (teeth)">
            <NumberInput value={cfg.singleRing} onChange={cfg.setSingleRing} min={20} />
          </Field>
          {!combo && (
            <Field label="Sprocket (teeth)">
              <NumberInput value={cfg.singleCog} onChange={cfg.setSingleCog} min={8} />
            </Field>
          )}
          <Field label="Hub" hint={<HubSourceLink hub={hub} />}>
            <HubPicker selectedIdx={cfg.hubIdx} onPick={cfg.setHubIdx} />
          </Field>
        </div>
        {combo && (
          <>
            <p className="dt-combo-note">
              <strong>{hub.label}</strong> is designed to be combined with a derailleur
              and cassette — its {hub.gears.length} hub steps multiply through every cog,
              like extra front gears.
            </p>
            <div className="grid dt-setup-trio">
              <Field
                label="Rear derailleur"
                hint={<DerailleurFieldHint d={derailleurByKey(cfg.derailleurId)} />}
              >
                <DerailleurPicker
                  selectedKey={cfg.derailleurId}
                  onPick={(key) => {
                    cfg.setDerailleurId(key);
                    cfg.setShifter(defaultShifterFor(derailleurByKey(key)));
                  }}
                />
              </Field>
              {cfg.derailleurId && cfg.shifter && (
                <Field label="Shifter" hint="used to verify compatibility">
                  <ShifterField cfg={cfg} />
                </Field>
              )}
              <CassetteFields cfg={cfg} />
            </div>
          </>
        )}
      </>
    );
  }

  // Single speed / fixed.
  return (
    <div className="grid">
      {typeField}
      <Field label="Chainring (teeth)">
        <NumberInput value={cfg.singleRing} onChange={cfg.setSingleRing} min={20} />
      </Field>
      <Field label="Cog (teeth)">
        <NumberInput value={cfg.singleCog} onChange={cfg.setSingleCog} min={8} />
      </Field>
    </div>
  );
}

// A popover that turns a typed or picked tire size into a rolling circumference
// — a compact embed of the Tire calculator's size field. Type any format
// (700x28C, 26-559, 28x1 3/8…) or click a suggestion; the estimated
// circumference (same geometry the Tire calculator shows) fills the field.
function TirePicker({ onPick }: { onPick: (circumferenceMm: number, sizeLabel: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const parsed = parseTireSize(query);
  const circ = parsed ? Math.round(estimatedCircumferenceMm(parsed.iso, parsed.widthMm)) : 0;
  const designations = parsed ? formatDesignations(parsed.iso, parsed.widthMm) : [];
  // Broad cross-format spread until the user types (mirrors the Tire calculator).
  const suggestions = suggestTireSizes(typed ? query : "");

  const apply = (mm: number, label: string) => {
    onPick(mm, label);
    setOpen(false);
    setQuery("");
    setTyped(false);
  };
  const circOf = (label: string): number => {
    const p = parseTireSize(label);
    return p ? Math.round(estimatedCircumferenceMm(p.iso, p.widthMm)) : 0;
  };

  return (
    <div className="tire-picker" ref={ref}>
      <button
        type="button"
        className={"preset-btn" + (open ? " open" : "")}
        title="Set from a tire size"
        aria-label="Set from a tire size"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Tire size <span className="caret">▾</span>
      </button>
      {open && (
        <div className="tp-pop">
          <input
            className="cp-search"
            type="text"
            autoFocus
            placeholder="e.g. 700x28C · 26-559 · 28x1 3/8"
            value={query}
            onChange={(e) => {
              setTyped(true);
              setQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && parsed) apply(circ, query.trim());
            }}
          />
          {parsed ? (
            <button type="button" className="tp-apply" onClick={() => apply(circ, query.trim())}>
              <span className="tp-apply-main">Use ≈ {circ} mm</span>
              <span className="tp-apply-sub">{designations.map((d) => d.value).join(" · ")}</span>
            </button>
          ) : query.trim() ? (
            <div className="tp-empty">Couldn't read that size — try e.g. 700x28C or 26-559.</div>
          ) : null}
          <div className="tp-chips">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                className="chip"
                title={`≈ ${circOf(s.label)} mm`}
                onClick={() => apply(circOf(s.label), s.label)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Rolling circumference lives per-config (each config is a bike/wheel), on its
// own row for a stable layout, with an embedded tire-size picker and a link to
// the Tire calculator.
function CircumferenceField({ cfg }: { cfg: DrivetrainConfig }) {
  // Carry the selected tire size across to the Tire calculator when one is set.
  const tireHref = cfg.tireSize ? `#/tire?size=${encodeURIComponent(cfg.tireSize)}` : "#/tire";
  return (
    <div className="rows">
      <Field
        label="Rolling circumference (mm)"
        hint={
          <>
            measured roll-out is most accurate ·{" "}
            <a className="inline-link" href={tireHref}>
              {cfg.tireSize
                ? `open ${cfg.tireSize} in the Tire calculator →`
                : "open the Tire calculator for sizes & conversion →"}
            </a>
          </>
        }
      >
        <div className="combo">
          <NumberInput
            value={cfg.circ}
            onChange={(v) => {
              // A hand-entered circumference no longer corresponds to a size.
              cfg.setCirc(v);
              cfg.setTireSize("");
            }}
            min={800}
          />
          <TirePicker
            onPick={(mm, label) => {
              cfg.setCirc(mm);
              cfg.setTireSize(label);
            }}
          />
        </div>
      </Field>
    </div>
  );
}

export function Drivetrain() {
  const units = useUnits();

  const configA = useDrivetrainConfig({
    mode: "cassette",
    chainringStr: "50, 34",
    cogStr: "11, 12, 13, 14, 15, 17, 19, 21, 24, 28",
    cassetteIdx: cassetteModelIdx([11, 12, 13, 14, 15, 17, 19, 21, 24, 28], "Shimano"),
    singleRing: 42,
    singleCog: 18,
    hubIdx: DEFAULT_HUB_IDX,
    derailleurId: "",
    shifter: null,
    circ: 2111,
    tireSize: "25-622",
  });
  const configB = useDrivetrainConfig({
    mode: "cassette",
    chainringStr: "46, 30",
    cogStr: "11, 13, 15, 17, 19, 21, 24, 28, 32, 37, 42",
    cassetteIdx: cassetteModelIdx([11, 13, 15, 17, 19, 21, 24, 28, 32, 37, 42], "Shimano"),
    singleRing: 42,
    singleCog: 18,
    hubIdx: DEFAULT_HUB_IDX,
    derailleurId: "",
    shifter: null,
    circ: 2111,
    tireSize: "25-622",
  });

  // Shared across both configs — cadence is just the speed-axis parameter.
  const [cadence, setCadence] = useState(90);
  const [chainstay, setChainstay] = useState(410);
  const [metric, setMetric] = useState<Metric>("speed");

  const [comparing, setComparing] = useState(false);
  // Which config the per-drivetrain detail sections (diagram, chain length,
  // derailleur fit, chain wear) describe. Only meaningful while comparing.
  const [focus, setFocus] = useState<"A" | "B">("A");
  const [activeGear, setActiveGear] = useState<{
    chainring: number;
    cog: number;
    hubName?: string;
    hubRatio?: number;
  } | null>(null);

  const derivedA = useDerived(configA, cadence);
  const derivedB = useDerived(configB, cadence);

  const focusCfg = comparing && focus === "B" ? configB : configA;
  const focusDerived = comparing && focus === "B" ? derivedB : derivedA;
  const { chainrings, cogs } = focusDerived;

  const rangeA = gearRange(derivedA.gears);
  const rangeB = gearRange(derivedB.gears);

  const largestRing = Math.max(...chainrings, 0);
  const largestCog = Math.max(...cogs, 0);
  const chain = chainLength({ chainstayMm: chainstay, largestChainring: largestRing, largestCog });
  const wearThresholds = chainWearThresholdsFor(hasDerailleur(focusCfg), cogs.length);

  // Rear-derailleur fit check (cassette only), for the focused config. The
  // derailleur is now chosen in the Setup section (per config). fitCassette
  // combines cog-clearance, capacity and speed-count into one verdict — the same
  // one that dots the cassette picker. Cog/capacity are skipped when the picked
  // derailleur has no data (many older or third-party entries) — see
  // `fitDataMissing` below.
  const derailleur = derailleurByKey(focusCfg.derailleurId);
  const shifter = focusCfg.shifter;
  // The selected cassette's cog-pitch standard, but only when the picked model
  // still matches the current cogs (a hand-edited cog list has no known model, so
  // its spacing is unknown and the pitch check is skipped).
  const focusCassette =
    focusCfg.cassetteIdx >= 0 ? CASSETTE_PRESETS[focusCfg.cassetteIdx] : null;
  const cassetteSpacing =
    focusCassette && sameCogs(focusCassette.cogs, cogs) ? focusCassette.spacing : undefined;
  const fitRes = derailleur
    ? fitCassette(derailleur, chainrings, cogs, shifter, cassetteSpacing)
    : null;
  const fitDataMissing =
    !!derailleur && (derailleur.totalCapacity == null || derailleur.maxSprocket == null);
  // The cog + capacity readout is shown only when both figures are present (as
  // before). `fit` gates that block and the capacity/max-cog note.
  const fit = !!fitRes && fitRes.cog !== "unknown" && fitRes.capacity !== "unknown";

  // Both checks are tri-state: a little over spec often still works (a big cog
  // with a long hanger / extra B-tension; a little extra capacity only shows as
  // slack in the small-small gear you'd avoid anyway).
  type FitStatus = "ok" | "caution" | "over";
  // Only meaningful when `fit` is true (which requires both fields present).
  const maxSprocket = derailleur?.maxSprocket ?? 0;
  const totalCapacity = derailleur?.totalCapacity ?? 0;
  const requiredCapacity = fitRes?.requiredCapacity ?? 0;
  const cogOver = fitRes?.cogOver ?? 0;
  const cogStatus = (fit ? fitRes!.cog : "ok") as FitStatus;
  const capOver = fitRes?.capOver ?? 0;
  const capStatus = (fit ? fitRes!.capacity : "ok") as FitStatus;
  const worst: FitStatus = [cogStatus, capStatus].includes("over")
    ? "over"
    : [cogStatus, capStatus].includes("caution")
      ? "caution"
      : "ok";

  const fitTone: "info" | "warn" = worst === "ok" ? "info" : "warn";
  let fitMessage = "";
  if (fit && derailleur) {
    if (worst === "ok") {
      fitMessage = `${derailleur.brand} ${derailleur.model} should handle this drivetrain (rated ${totalCapacity}T capacity, ${maxSprocket}T max cog).`;
    } else {
      const issues: string[] = [];
      if (cogStatus !== "ok")
        issues.push(`largest cog ${cogOver}T over the ${maxSprocket}T max`);
      if (capStatus !== "ok")
        issues.push(`capacity ${capOver}T over the ${totalCapacity}T rating`);
      const joined = issues.join("; ");
      fitMessage =
        worst === "caution"
          ? `Slightly out of spec — ${joined}. It may still work (a long hanger / extra B-tension, and avoiding the extreme cross-chain gears, can help) — look closely and proceed with caution.`
          : `Out of range — ${joined}. This is beyond what ${derailleur.brand} ${derailleur.model} is designed for.`;
    }
  }

  // Shifter compatibility: whether the chosen shifter can drive this derailleur on
  // this cassette. The derailleur only moves sideways — the shifter is what
  // indexes to each cog — so this is the accurate speed/actuation verdict. See
  // shifterCompatibility().
  const shifterVerdict = fitRes?.shifter ?? null;
  const shifterStatus = shifterVerdict?.status ?? "match";
  const shifterBadge: { cls: "ok" | "warn" | "danger" | "rh"; text: string } =
    shifterStatus === "unspecified"
      ? { cls: "rh", text: "not checked" }
      : shifterStatus === "wrong-family"
        ? { cls: "danger", text: "wrong family" }
        : shifterStatus === "friction-electronic"
          ? { cls: "danger", text: "needs electronic" }
          : shifterVerdict?.level === "ok"
            ? { cls: "ok", text: "OK" }
            : shifterVerdict?.level === "caution"
              ? { cls: "warn", text: "check" }
              : { cls: "danger", text: `≠ ${cogs.length}-sp` };

  // Cassette cog-pitch (spacing) verdict — shown only when the cassette's
  // standard is known (a picked model, not a hand-typed cog list).
  const spacingDim = fitRes?.spacing ?? "unknown";
  const spacingBadge: { cls: "ok" | "danger" | "rh"; text: string } =
    spacingDim === "ok"
      ? { cls: "ok", text: "OK" }
      : spacingDim === "over"
        ? { cls: "danger", text: "mismatch" }
        : { cls: "rh", text: "not checked" };

  // Compact overall verdict for the Gears summary row — the same traffic-light
  // level that dots the cassette picker, so the two views agree at a glance.
  const fitBadge: { cls: "ok" | "warn" | "danger"; text: string } | null = fitRes
    ? fitRes.level === "ok"
      ? { cls: "ok", text: "fits" }
      : fitRes.level === "caution"
        ? { cls: "warn", text: "marginal" }
        : {
            cls: "danger",
            text:
              incompatibleReason(fitRes) === "spacing"
                ? "wrong spacing"
                : incompatibleReason(fitRes) === "indexing"
                  ? "indexing mismatch"
                  : "out of range",
          }
    : null;

  const sliderCadence = Math.min(120, Math.max(60, cadence || 60));

  // Axis definitions for the gear chart. Speed uses the global unit (set in the
  // sidebar), so there's no per-chart unit toggle.
  const rpm = cadence || 90;
  const unitLabel = speedUnitLabel(units.speed);
  const toSpeed = (kmh: number) => (units.speed === "mph" ? kmhToMph(kmh) : kmh);
  const metricDefs: Record<
    Metric,
    { label: string; value: (g: GearResult) => number; format: (v: number) => string }
  > = {
    speed: {
      label: `Speed at ${rpm} rpm (${unitLabel})`,
      value: (g) => toSpeed(g.speedKmh),
      format: (v) => v.toFixed(1),
    },
    gearInches: { label: "Gear inches", value: (g) => g.gearInches, format: (v) => v.toFixed(0) },
    development: {
      label: "Development (m/rev)",
      value: (g) => g.developmentM,
      format: (v) => v.toFixed(2),
    },
    ratio: { label: "Gear ratio", value: (g) => g.ratio, format: (v) => v.toFixed(2) },
  };
  const metricOptions = (Object.keys(metricDefs) as Metric[]).map((k) => ({
    value: k,
    label: metricDefs[k].label,
  }));
  const activeMetric = metricDefs[metric];
  const pointLabel = (g: GearResult) => (g.hubGear ? g.hubGear.name : String(g.cog));

  // Chart series. One when not comparing (matches the diagram's palette);
  // config B is added as a hollow overlay on the same axis when comparing.
  const crossA = makeCrossChained(configA.mode, derivedA.chainrings, derivedA.cogs);
  const crossB = makeCrossChained(configB.mode, derivedB.chainrings, derivedB.cogs);
  // Combo drivetrains group into one row per hub gear (the hub steps read like
  // extra front gears over the cassette); everything else groups by chainring.
  const groupA = comboActive(configA) ? "hubGear" : "chainring";
  const groupB = comboActive(configB) ? "hubGear" : "chainring";
  const series: GearSeries[] = comparing
    ? [
        {
          id: "A",
          gears: derivedA.gears,
          isCrossChained: crossA,
          continuous: isCvt(configA),
          groupBy: groupA,
        },
        {
          id: "B",
          gears: derivedB.gears,
          hollow: true,
          isCrossChained: crossB,
          continuous: isCvt(configB),
          groupBy: groupB,
        },
      ]
    : [
        {
          id: "A",
          gears: derivedA.gears,
          isCrossChained: crossA,
          continuous: isCvt(configA),
          groupBy: groupA,
        },
      ];

  // Active gear for the drivetrain diagram (default to a middle gear until
  // hovered). Only hovers on the focused config move the diagram.
  const defaultCog = cogs.length ? cogs[Math.floor(cogs.length / 2)] : 0;
  const activeChainring =
    activeGear && chainrings.includes(activeGear.chainring) ? activeGear.chainring : chainrings[0] ?? 0;
  const activeCog = activeGear && cogs.includes(activeGear.cog) ? activeGear.cog : defaultCog;
  // Hub gear: use the hovered gear's hub step when it's valid for the focused
  // config, else a middle hub gear. Cassette/single-speed have no hub ratio (1).
  const focusHubGears = focusDerived.hubGears;
  const defaultHubGear = focusHubGears?.length
    ? focusHubGears[Math.floor(focusHubGears.length / 2)]
    : undefined;
  // A CVT exposes a continuous ratio between its low/high endpoints, so its
  // active "gear" is any value in that range (picked by hovering the chart band
  // or holding a shift button), not one of a discrete list.
  const isCvtFocus = isCvt(focusCfg);
  const cvtRange =
    isCvtFocus && focusHubGears && focusHubGears.length >= 2
      ? { lo: focusHubGears[0].ratio, hi: focusHubGears[focusHubGears.length - 1].ratio }
      : null;
  const activeHubGear = cvtRange
    ? (() => {
        const r = Math.min(
          cvtRange.hi,
          Math.max(cvtRange.lo, activeGear?.hubRatio ?? (cvtRange.lo + cvtRange.hi) / 2),
        );
        const pct = Math.round(((r - cvtRange.lo) / (cvtRange.hi - cvtRange.lo)) * 100);
        return { name: `${pct}%`, ratio: r };
      })()
    : activeGear?.hubName && focusHubGears?.some((h) => h.name === activeGear.hubName)
      ? { name: activeGear.hubName, ratio: activeGear.hubRatio ?? 1 }
      : defaultHubGear;
  const activeHubRatio = activeHubGear?.ratio ?? 1;
  // A bottom-bracket gearbox gears between the crank and the chainring, so the
  // diagram spins the crank (cadence) separately from the chainring (geared).
  const isGearbox =
    focusCfg.mode === "hub" && HUB_PRESETS[focusCfg.hubIdx].kind === "bottomBracket";
  // The gear currently drawn in the diagram, for highlighting in the chart.
  const focusId = comparing && focus === "B" ? "B" : "A";
  const isActiveGear = (g: GearResult, seriesId: string) =>
    seriesId === focusId &&
    g.chainring === activeChainring &&
    g.cog === activeCog &&
    (g.hubGear?.name ?? undefined) === (activeHubGear?.name ?? undefined);
  const activeSpeedKmh =
    activeCog > 0
      ? ((activeChainring / activeCog) *
          activeHubRatio *
          (focusCfg.circ / 1000) *
          (cadence || 90) *
          60) /
        1000
      : 0;

  const focusLabel = focus === "B" ? "Drivetrain B" : "Drivetrain A";

  // Shifting: step through gears like a real drivetrain rather than jumping
  // between chainrings by raw ratio. Shifting stays within the current "shift
  // group", stepping to the next usable cog in the shift direction. When the
  // group runs out of usable cogs (the next one would be cross-chained), it
  // rolls onto the next group and lands on the first gear that's actually higher
  // (shifting up) or lower (down) than the current one — matching a real front
  // shift's overlap, not the lowest usable gear on the new group.
  //
  // A shift group is the chainring for a cassette, or the hub gear for a
  // hub+cassette combo (its steps read like extra front gears over the
  // cassette), so combos shift front-then-rear just like a multi-ring crankset.
  const isCrossChained = makeCrossChained(focusCfg.mode, chainrings, cogs);
  const usableGears = focusDerived.gears.filter((g) => !isCrossChained(g));
  const activeRatio = activeCog > 0 ? (activeChainring / activeCog) * activeHubRatio : 0;
  const isCombo = comboActive(focusCfg);
  const groupKey = (g: GearResult) => (isCombo ? g.hubGear?.name ?? "" : String(g.chainring));
  const activeGroupKey = isCombo ? activeHubGear?.name ?? "" : String(activeChainring);
  // Group keys ordered by their ratio multiplier (hub ratio / chainring size), so
  // switching groups moves in one direction.
  const groupsOrdered = isCombo
    ? (focusHubGears ?? [])
        .slice()
        .sort((a, b) => a.ratio - b.ratio)
        .map((h) => h.name)
    : [...new Set(focusDerived.gears.map((g) => g.chainring))].sort((a, b) => a - b).map(String);
  // The usable gear in a group that sits just beyond the current ratio in the
  // shift direction, or undefined if the group has none.
  const nearest = (key: string, dir: number) => {
    const cand = usableGears.filter(
      (g) => groupKey(g) === key && (dir > 0 ? g.ratio > activeRatio : g.ratio < activeRatio),
    );
    if (!cand.length) return undefined;
    return cand.reduce((a, b) => (dir > 0 ? (b.ratio < a.ratio ? b : a) : b.ratio > a.ratio ? b : a));
  };
  const findShift = (dir: number): GearResult | undefined => {
    if (!usableGears.length) return undefined;
    // Prefer the same group; otherwise walk to adjacent groups in the shift
    // direction until one has a gear beyond the current ratio.
    const same = nearest(activeGroupKey, dir);
    if (same) return same;
    const gi = groupsOrdered.indexOf(activeGroupKey);
    for (let i = gi + dir; i >= 0 && i < groupsOrdered.length; i += dir) {
      const t = nearest(groupsOrdered[i], dir);
      if (t) return t;
    }
    return undefined;
  };
  const shiftGear = (delta: number) => {
    const g = findShift(delta > 0 ? 1 : -1);
    if (!g) return;
    setActiveGear({
      chainring: g.chainring,
      cog: g.cog,
      hubName: g.hubGear?.name,
      hubRatio: g.hubGear?.ratio,
    });
  };
  // CVT: set the continuous ratio directly (clamped to the range).
  const setCvtRatio = (r: number) => {
    if (!cvtRange) return;
    setActiveGear({
      chainring: activeChainring,
      cog: activeCog,
      hubName: "cvt",
      hubRatio: Math.min(cvtRange.hi, Math.max(cvtRange.lo, r)),
    });
  };
  const canShiftUp = cvtRange ? activeHubRatio < cvtRange.hi - 1e-6 : !!findShift(1);
  const canShiftDown = cvtRange ? activeHubRatio > cvtRange.lo + 1e-6 : !!findShift(-1);

  // Refs keep the hold loop / key listeners pointed at the latest closures
  // (which capture this render's active gear, range, etc.).
  const shiftGearRef = useRef(shiftGear);
  shiftGearRef.current = shiftGear;
  const setCvtRatioRef = useRef(setCvtRatio);
  setCvtRatioRef.current = setCvtRatio;
  const activeHubRatioRef = useRef(activeHubRatio);
  activeHubRatioRef.current = activeHubRatio;
  const cvtRangeRef = useRef(cvtRange);
  cvtRangeRef.current = cvtRange;

  // Hold-to-shift: a CVT sweeps its ratio continuously for as long as a button
  // or arrow key is held (longer press = more shift); a stepped drivetrain steps
  // once, then repeats at an interval while held.
  const holdRef = useRef<{ cancel: () => void } | null>(null);
  const stopShift = () => {
    holdRef.current?.cancel();
    holdRef.current = null;
  };
  const startShift = (dir: number) => {
    if (holdRef.current) return;
    const range = cvtRangeRef.current;
    if (range) {
      // A small immediate nudge so a quick tap still moves noticeably; holding
      // then sweeps the rest of the range.
      setCvtRatioRef.current(activeHubRatioRef.current + dir * (range.hi - range.lo) * 0.04);
      const perSec = (range.hi - range.lo) / 2.5; // full range in ~2.5 s
      let raf = 0;
      let last: number | null = null;
      const tick = (t: number) => {
        if (last != null) {
          setCvtRatioRef.current(activeHubRatioRef.current + dir * perSec * ((t - last) / 1000));
        }
        last = t;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      holdRef.current = { cancel: () => cancelAnimationFrame(raf) };
    } else {
      shiftGearRef.current(dir);
      const id = window.setInterval(() => shiftGearRef.current(dir), 220);
      holdRef.current = { cancel: () => window.clearInterval(id) };
    }
  };
  const startShiftRef = useRef(startShift);
  startShiftRef.current = startShift;

  // ←/→ start/stop a hold, ignoring keystrokes aimed at form fields. A pointerup
  // / blur anywhere also stops, so a hold can't get stuck (e.g. if the button
  // becomes disabled at the end of the range while still pressed).
  useEffect(() => {
    const isField = (t: HTMLElement | null) => {
      const tag = t?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!t?.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isField(e.target as HTMLElement)) return;
      e.preventDefault();
      if (e.repeat) return; // our own loop handles the hold
      startShiftRef.current(e.key === "ArrowRight" ? 1 : -1);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") stopShift();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerup", stopShift);
    window.addEventListener("blur", stopShift);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", stopShift);
      window.removeEventListener("blur", stopShift);
      stopShift();
    };
  }, []);

  return (
    <>
      <Section
        title="Setup"
        action={
          <button
            type="button"
            className="dt-compare-toggle"
            onClick={() => {
              // Seed drivetrain B from A when turning the comparison on, so it
              // starts identical and you can isolate a single change.
              if (!comparing) copyConfig(configA, configB);
              setComparing((c) => !c);
            }}
          >
            {comparing ? "✕ Remove comparison" : "+ Compare a second drivetrain"}
          </button>
        }
      >
        {comparing ? (
          <div className="dt-configs">
            <div className="dt-config dt-config-a">
              <div className="dt-config-head">Drivetrain A</div>
              <SetupFields cfg={configA} />
              <CircumferenceField cfg={configA} />
            </div>
            <div className="dt-config dt-config-b">
              <div className="dt-config-head">Drivetrain B</div>
              <SetupFields cfg={configB} />
              <CircumferenceField cfg={configB} />
            </div>
          </div>
        ) : (
          <>
            <SetupFields cfg={configA} />
            <CircumferenceField cfg={configA} />
          </>
        )}
      </Section>

      <Section
        title="Gears"
        info={
          <>
            {comboActive(focusCfg) ? (
              <>
                One line per <strong>hub gear</strong>; each dot is a cassette cog
                (labelled with its tooth count) — the hub steps act like extra front
                gears multiplied through the cassette. Hover a dot for its exact
                values.{" "}
              </>
            ) : (
              <>
                One line per chainring; each dot is a{" "}
                {focusCfg.mode === "hub" ? "hub gear" : "cog"} (labelled with its{" "}
                {focusCfg.mode === "hub" ? "gear" : "tooth count"}) — hover a dot for its
                exact values.{" "}
              </>
            )}
            {comparing && (
              <>
                <strong>Drivetrain B</strong> is drawn with hollow dots on a dashed line, sharing
                the same axis so you can compare range, gaps and overlap directly.{" "}
              </>
            )}
            {focusCfg.mode === "cassette" && chainrings.length > 1 && (
              <>
                <strong>Greyed dots</strong> are cross-chained combinations (big-big /
                small-small) to avoid shifting into.{" "}
              </>
            )}
            <strong>Gear inches</strong> = the drive-wheel diameter (in) of an
            equivalent direct-drive high-wheeler — a wheel-size-independent way to
            compare gears; bigger = taller/harder. <strong>Development</strong> is
            metres travelled per pedal revolution.
          </>
        }
      >
        <div className="chart-controls">
          {comparing ? (
            <>
              <Result
                label="A: gears / range"
                value={`${isCvt(configA) ? "∞" : derivedA.gears.length} · ${rangeA.toFixed(2)}× (${Math.round((rangeA - 1) * 100)}%)`}
              />
              <Result
                label="B: gears / range"
                value={`${isCvt(configB) ? "∞" : derivedB.gears.length} · ${rangeB.toFixed(2)}× (${Math.round((rangeB - 1) * 100)}%)`}
              />
            </>
          ) : (
            <>
              <Result label="Gears" value={isCvt(configA) ? "∞" : derivedA.gears.length} />
              <Result
                label="Range"
                value={`${rangeA.toFixed(2)}× (${Math.round((rangeA - 1) * 100)}%)`}
              />
            </>
          )}
          {hasDerailleur(focusCfg) && derailleur && fitBadge && (
            <Result
              label="Derailleur fit"
              value={
                <>
                  {derailleur.model}{" "}
                  <span className={"badge " + fitBadge.cls}>{fitBadge.text}</span>
                </>
              }
            />
          )}
        </div>

        <GearChart
          series={series}
          metric={metric}
          options={metricOptions}
          onMetricChange={(v) => setMetric(v as Metric)}
          value={activeMetric.value}
          format={activeMetric.format}
          pointLabel={pointLabel}
          cadenceRpm={rpm}
          isActive={isActiveGear}
          activeRatio={activeRatio}
          activeSeriesId={focusId}
          onHover={(g, seriesId) => {
            // Hovering a gear selects it in the diagram; if it belongs to the
            // other drivetrain, switch the diagram (and detail sections) to it.
            if (comparing && (seriesId === "A" || seriesId === "B")) setFocus(seriesId);
            setActiveGear({
              chainring: g.chainring,
              cog: g.cog,
              hubName: g.hubGear?.name,
              hubRatio: g.hubGear?.ratio,
            });
          }}
          extra={
            metric === "speed" ? (
              <div className="gc-cadence">
                <label htmlFor="cadence">Cadence</label>
                <input
                  id="cadence"
                  type="range"
                  min={60}
                  max={120}
                  step={1}
                  value={sliderCadence}
                  onChange={(e) => setCadence(parseInt(e.target.value))}
                />
                <input
                  type="number"
                  className="gc-cadence-num"
                  value={Number.isFinite(cadence) ? cadence : ""}
                  min={20}
                  max={200}
                  onChange={(e) => setCadence(parseInt(e.target.value))}
                />
                <span className="gc-cadence-unit">rpm</span>
              </div>
            ) : undefined
          }
        />

        {comparing && (
          <div className="dt-focus">
            <span>Diagram &amp; details below for drivetrain</span>
            <div className="dt-focus-seg">
              <button
                type="button"
                className={focus === "A" ? "active" : ""}
                onClick={() => setFocus("A")}
              >
                A
              </button>
              <button
                type="button"
                className={focus === "B" ? "active" : ""}
                onClick={() => setFocus("B")}
              >
                B
              </button>
            </div>
          </div>
        )}

        <DrivetrainDiagram
          chainrings={chainrings}
          cogs={cogs}
          activeChainring={activeChainring}
          activeCog={activeCog}
          chainstayMm={chainstay}
          wheelCircMm={focusCfg.circ}
          hasDerailleur={hasDerailleur(focusCfg)}
          cadenceRpm={rpm}
          speed={toSpeed(activeSpeedKmh)}
          speedUnit={unitLabel}
          hubRatio={activeHubRatio}
          hubLabel={activeHubGear?.name}
          isGearbox={isGearbox}
          onShiftStart={(dir) => startShift(dir)}
          onShiftStop={stopShift}
          canShiftDown={canShiftDown}
          canShiftUp={canShiftUp}
        />

        <div className="dt-controls">
          <label htmlFor="chainstay">Chainstay</label>
          <input
            id="chainstay"
            type="range"
            min={350}
            max={500}
            step={5}
            value={Number.isFinite(chainstay) ? chainstay : 410}
            onChange={(e) => setChainstay(parseInt(e.target.value))}
          />
          <input
            type="number"
            className="gc-cadence-num"
            value={Number.isFinite(chainstay) ? chainstay : ""}
            min={350}
            max={500}
            onChange={(e) => setChainstay(parseInt(e.target.value))}
          />
          <span>mm</span>
        </div>

        <p className="dt-hint">
          Want to know if this gearing will get you up a mountain? The{" "}
          <a className="inline-link" href="#/power">
            cycling power calculator
          </a>{" "}
          turns a speed and gradient into the watts you'd need — pair it with your
          lowest gear's speed at a comfortable cadence to see if the climb is
          realistic.
        </p>
      </Section>

      {hasDerailleur(focusCfg) && derailleur && (
        <Section
          title={comparing ? `Rear derailleur fit · ${focusLabel}` : "Rear derailleur fit"}
          info={
            <>
              Checks the derailleur you chose in <strong>Setup</strong> against this
              cassette/crankset. Needs capacity ≥ (big ring − small ring) + (big cog
              − small cog), and its max sprocket ≥ your largest cog. Specs are
              approximate — see the{" "}
              <a className="inline-link" href="#/derailleur">
                derailleur database
              </a>
              .
            </>
          }
        >
          <>
            <div className="results">
              <Result
                label="Derailleur"
                value={`${derailleur.brand} ${derailleur.model}${derailleur.cage ? ` · ${derailleur.cage}` : ""}`}
              />
              {fit && (
                  <Result
                    label="Largest cog"
                    value={
                      <>
                        {largestCog}T{" "}
                        <span
                          className={
                            "badge " +
                            (cogStatus === "ok" ? "ok" : cogStatus === "caution" ? "warn" : "danger")
                          }
                        >
                          {cogStatus === "ok"
                            ? "OK"
                            : cogStatus === "caution"
                              ? `+${cogOver}T over`
                              : `over ${maxSprocket}T`}
                        </span>
                      </>
                    }
                  />
                )}
                {fit && (
                  <Result
                    label="Capacity needed"
                    value={
                      <>
                        {requiredCapacity}T{" "}
                        <span
                          className={
                            "badge " +
                            (capStatus === "ok" ? "ok" : capStatus === "caution" ? "warn" : "danger")
                          }
                        >
                          {capStatus === "ok"
                            ? "OK"
                            : capStatus === "caution"
                              ? `+${capOver}T over`
                              : `over ${totalCapacity}T`}
                        </span>
                      </>
                    }
                  />
                )}
                <Result
                  label="Shifter"
                  value={
                    <>
                      {shifter ? shifterLabel(shifter) : `${derailleur.speeds}-speed`}{" "}
                      <span className={"badge " + shifterBadge.cls}>{shifterBadge.text}</span>
                    </>
                  }
                />
                <Result label="Actuation" value={derailleur.actuation ?? "unknown"} />
                <Result label="Pull ratio" value={pullRatioFor(derailleur)} />
                {fitRes?.cassetteSpacing && (
                  <Result
                    label="Cassette spacing"
                    value={
                      <>
                        {CASSETTE_SPACING_LABELS[fitRes.cassetteSpacing]}{" "}
                        <span className={"badge " + spacingBadge.cls}>{spacingBadge.text}</span>
                      </>
                    }
                  />
                )}
              </div>
              {fit && <Note tone={fitTone}>{fitMessage}</Note>}
              {fitDataMissing && (
                <Note tone="info">
                  No rated capacity / max-cog figures for{" "}
                  <strong>
                    {derailleur.brand} {derailleur.model}
                  </strong>{" "}
                  in the database yet, so the fit check is skipped — the speed and
                  actuation guide above still applies.
                </Note>
              )}
              {spacingDim === "over" && fitRes?.cassetteSpacing && fitRes?.expectedSpacing && (
                <Note tone="warn">
                  This is a{" "}
                  <strong>{CASSETTE_SPACING_LABELS[fitRes.cassetteSpacing]}</strong>{" "}
                  cassette, but {derailleur.brand} {derailleur.model}
                  {shifter && shifter.family ? " and its shifter" : ""} index to{" "}
                  <strong>{CASSETTE_SPACING_LABELS[fitRes.expectedSpacing]}</strong>{" "}
                  cog spacing. Even with the same {cogs.length} cogs, the sprocket pitch
                  differs, so the indexed clicks won’t line up cog-to-cog — it{" "}
                  <strong>won’t shift correctly</strong>. Use a{" "}
                  {CASSETTE_SPACING_LABELS[fitRes.expectedSpacing]} cassette, or a{" "}
                  <strong>friction shifter</strong> (which doesn’t index and works with any
                  spacing).
                </Note>
              )}
              {shifterStatus === "electronic-count" && shifter && (
                <Note tone="warn">
                  {derailleur.brand} {derailleur.model} is <strong>electronic</strong>,
                  driven by its matching <strong>{shifter.speeds}-speed</strong> control in
                  fixed, pre-programmed steps — but your cassette has{" "}
                  <strong>{cogs.length} cogs</strong>. Electronic groups can’t be re-indexed
                  for a different cog count, and there’s no friction fallback — so this{" "}
                  <strong>won’t work</strong> with a {cogs.length}-speed cassette.
                </Note>
              )}
              {shifterStatus === "friction-electronic" && (
                <Note tone="warn">
                  {derailleur.brand} {derailleur.model} is <strong>electronic</strong> — a
                  friction (or any cable) shifter can’t drive it. It needs its matching
                  electronic control, so a friction shifter <strong>won’t work</strong>.
                </Note>
              )}
              {shifterStatus === "wrong-count" && shifter && (
                <Note tone="warn">
                  The shifter indexes <strong>{shifter.speeds} speeds</strong> but your
                  cassette has <strong>{cogs.length} cogs</strong> — the indexed click
                  spacing won’t line up cog-to-cog. Set the shifter to {cogs.length}-speed,
                  or use a <strong>friction shifter</strong>, which doesn’t index at all and
                  lets you position each gear by feel.
                </Note>
              )}
              {shifterStatus === "wrong-family" && shifter && (
                <Note tone="warn">
                  The shifter’s actuation family (<strong>{shifter.family || "unspecified"}</strong>)
                  differs from the derailleur’s (<strong>{derailleur.actuation ?? "unknown"}</strong>)
                  — each click won’t pull the derailleur the right distance, so it won’t index.
                  Use a shifter in the derailleur’s family, or a{" "}
                  <strong>friction shifter</strong>.
                </Note>
              )}
              {shifterStatus === "unknown-family" && shifter && (
                <Note tone="info">
                  The <strong>{shifter.speeds}-speed</strong> count matches your cassette, but{" "}
                  {derailleur.brand} {derailleur.model}’s actuation family isn’t known, so we
                  can’t confirm the shifter’s pull ratio matches — verify before relying on it.
                  A <strong>friction shifter</strong> would sidestep the question entirely.
                </Note>
              )}
              {shifterStatus === "friction" && (
                <Note tone="info">
                  A <strong>friction shifter</strong> doesn’t index — you position each gear by
                  feel — so it drives {derailleur.brand} {derailleur.model} with any cog count.
                  The cog-clearance and chain-wrap checks above still apply.
                </Note>
              )}
              {shifterStatus === "unspecified" && (
                <Note tone="info">
                  The shifter’s actuation family is unspecified, so shifting compatibility{" "}
                  <strong>can’t be checked</strong> — pick the shifter’s family (or Friction) to
                  verify it indexes. The cog-clearance and chain-wrap checks above still apply.
                </Note>
              )}
          </>
        </Section>
      )}

      <Section
        title={comparing ? `Chain length · ${focusLabel}` : "Chain length"}
        info={
          hasDerailleur(focusCfg) ? (
            <>
              Park Tool formula, rounded up so the link count is even (each link ≈
              12.7 mm). It includes the +1 inch wrap for the rear derailleur. The
              big-big wrap method is more reliable for wide 1× and full-suspension.
            </>
          ) : undefined
        }
      >
        {hasDerailleur(focusCfg) ? (
          <div className="grid">
            <Result label="Chainstay length" value={`${chainstay} mm`} />
            <Result label="Largest ring / cog" value={`${largestRing} / ${largestCog} T`} />
            <Result label="Length" value={`${chain.mm} mm`} />
            <Result label="Links" value={chain.links} big />
          </div>
        ) : (
          <Note>
            {focusCfg.mode === "hub" ? "Hub-geared" : "Single-speed"} chains aren't sized
            by the derailleur formula — there's no derailleur cage to take up
            slack, so length is set by the <strong>dropout / tensioner
            position</strong>. Wrap the chain around the ring and cog, pull it
            snug, and pick the shortest link that lets the wheel sit within its
            adjustment range with correct tension (about 1 cm of vertical play).
            A <strong>half-link</strong> can fine-tune the fit on track/horizontal
            dropouts. Use a chain tensioner if the frame has vertical dropouts.
          </Note>
        )}
      </Section>

      <Section
        title={comparing ? `Chain wear — when to replace · ${focusLabel}` : "Chain wear — when to replace"}
        info={
          <>
            Measured at the bench with a chain-wear gauge.{" "}
            {hasDerailleur(focusCfg)
              ? `Shown for your ${cogs.length}-speed cassette.`
              : "Single-speed and hub bikes can run a narrow 3/32\" or wide 1/8\" chain — pick the row matching your chain."}{" "}
            Past the threshold the cassette (and possibly chainrings) may skip with a
            new chain.
          </>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Chain type</th>
                <th className="num">Replace at</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {wearThresholds.map((t) => (
                <tr key={t.chainType}>
                  <td>{t.chainType}</td>
                  <td className="num">{t.replaceAtPercent.toFixed(2)}%</td>
                  <td>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
