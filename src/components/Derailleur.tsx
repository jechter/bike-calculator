import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HUBS, HUB_TYPE_LABELS, type Hub } from "../lib/spokes";
import { CASSETTE_PRESETS, CASSETTE_SPACING_LABELS, HUB_PRESETS, type CassettePreset, type HubPreset } from "../lib/drivetrain";
import { DERAILLEURS, searchDerailleurs, pullRatioFor, type DerailleurSpec } from "../lib/derailleur";
import { Field, TextInput, Select, Section, PresetMenu } from "./ui";
import { useIsMobile, useMediaQuery } from "../useIsMobile";

type ComponentKind = "all" | "derailleur" | "hub" | "internal-hub" | "gearbox" | "cassette";
type ComponentRow =
  | { kind: "derailleur"; key: string; title: string; brand: string; data: DerailleurSpec }
  | { kind: "hub"; key: string; title: string; brand: string; data: Hub }
  | { kind: "gearing"; key: string; title: string; brand: string; data: HubPreset }
  | { kind: "cassette"; key: string; title: string; brand: string; data: CassettePreset };

function years(d: DerailleurSpec): string {
  if (d.introduced && d.discontinued) return `${d.introduced}–${d.discontinued}`;
  if (d.introduced) return `${d.introduced}–`;
  if (d.discontinued) return `–${d.discontinued}`;
  return "—";
}
const hubName = (h: Hub) => `${h.manufacturer} ${h.model}`;
const freehubOptions = (freehub: string) => freehub.split(",").map((option) => option.trim()).filter(Boolean);

const NEW_COMPONENT_EVENT = "components:propose-new";

// Address proposals are mailed to. Stored as shifted character codes so the plain
// address never appears in the source or bundle (keeps it from address-harvesting
// crawlers); it's only assembled when someone submits.
const PROPOSAL_MAILBOX = [99, 106, 108, 102, 46, 100, 112, 110, 113, 112, 111, 102, 111, 117, 46, 101, 98, 117, 98, 99, 98, 116, 102, 65, 107, 112, 111, 98, 116, 102, 100, 105, 117, 102, 115, 105, 112, 103, 103, 47, 100, 112, 110];
const proposalMailbox = () => String.fromCharCode(...PROPOSAL_MAILBOX.map((code) => code - 1));

/** Page-header button that opens the "New component" proposal form. */
export function ComponentProposalButton() {
  return <button type="button" className="copy-link-btn" onClick={() => window.dispatchEvent(new Event(NEW_COMPONENT_EVENT))}>＋ Propose new<span className="component-propose-long"> component</span></button>;
}

// Proposal types match the categories shown in the database list.
type NewCategory = "derailleur" | "hub" | "internal-hub" | "gearbox" | "cassette";
const NEW_CATEGORY_LABELS: Record<NewCategory, string> = { derailleur: "Derailleur", hub: "Wheel hub", "internal-hub": "Internal gear hub", gearbox: "Gearbox", cassette: "Cassette" };
// Editable fields per type, in the same order as the details table shows them.
const PROPOSAL_FIELDS: Record<NewCategory, string[]> = {
  derailleur: ["brand", "model", "series", "discipline", "speeds", "cage", "maxSprocket", "totalCapacity", "actuation", "pullRatio", "introduced", "discontinued", "source"],
  hub: ["manufacturer", "model", "type", "widthMm", "spokeCounts", "leftFlangeDiaMm", "rightFlangeDiaMm", "leftOffsetMm", "rightOffsetMm", "spokeHoleMm", "source"],
  "internal-hub": ["manufacturer", "label", "continuouslyVariable", "gears", "derailleurCompatible", "source"],
  gearbox: ["manufacturer", "label", "continuouslyVariable", "gears", "derailleurCompatible", "source"],
  cassette: ["brand", "model", "series", "cogs", "freehub", "spacing", "special", "weightGrams", "source"],
};
const FIELD_LABELS: Record<string, string> = {
  brand: "Brand", manufacturer: "Brand", model: "Model", label: "Model", series: "Series", discipline: "Discipline", speeds: "Speeds", cage: "Cage",
  maxSprocket: "Max sprocket (T)", totalCapacity: "Total capacity (T)", actuation: "Actuation", pullRatio: "Pull ratio", introduced: "Introduced (year)", discontinued: "Discontinued (year)",
  type: "Type", widthMm: "Spacing (OLD, mm)", spokeCounts: "Spoke counts", leftFlangeDiaMm: "Left flange diameter (mm)", rightFlangeDiaMm: "Right flange diameter (mm)",
  leftOffsetMm: "Left flange offset (mm)", rightOffsetMm: "Right flange offset (mm)", spokeHoleMm: "Spoke hole (mm)",
  continuouslyVariable: "Continuously variable", gears: "Ratios", derailleurCompatible: "Derailleur compatible",
  cogs: "Sprockets", freehub: "Freehub body", spacing: "Spacing standard", special: "Special type", weightGrams: "Weight (g)", source: "Source URL",
};
const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key;
const BOOLEAN_FIELDS = new Set(["continuouslyVariable", "derailleurCompatible"]);
// Example values pre-filled into a new proposal to show the expected list format.
// They read as placeholders: muted, selected on focus, and not accepted as an answer.
const NEW_EXAMPLES: Partial<Record<NewCategory, Record<string, string>>> = {
  "internal-hub": { gears: "0.527, 0.644, 0.748, 0.851, 1.000, 1.223, 1.419, 1.615" },
  gearbox: { gears: "0.549, 0.682, 0.843, 1.056, 1.313, 1.621, 2.030, 2.524, 3.117" },
  cassette: { cogs: "11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 32" },
};
/** Proposal draft for a type — from an existing entry's data, or blank (with examples) for a new one. */
function proposalDraft(category: NewCategory, data?: object): Record<string, unknown> {
  const raw = (data ?? {}) as Record<string, unknown>;
  const draft: Record<string, unknown> = { category };
  for (const key of PROPOSAL_FIELDS[category]) {
    let value = raw[key];
    // Sources are stored as { url, … }; propose just the URL.
    if (key === "source" && value && typeof value === "object") value = (value as { url?: string }).url;
    // Lists use the same comma-separated format a new proposal starts with.
    if (key === "gears" && Array.isArray(value)) value = (value as HubPreset["gears"]).map((gear) => gear.ratio);
    if (Array.isArray(value)) value = value.join(", ");
    draft[key] = BOOLEAN_FIELDS.has(key) ? Boolean(value) : value == null ? (data ? "" : NEW_EXAMPLES[category]?.[key] ?? "") : String(value);
  }
  return draft;
}
// List fields must be comma-separated numbers.
const LIST_FIELDS = new Set(["cogs", "gears", "spokeCounts"]);
const isNumberList = (value: unknown) => typeof value !== "string" || value.split(",").every((part) => part.trim() !== "" && Number.isFinite(Number(part)));

// Fields that must be filled before a proposal can be submitted (when the type has them).
const REQUIRED_FIELDS = new Set(["brand", "manufacturer", "model", "label", "speeds", "maxSprocket", "totalCapacity", "source", "gears", "cogs", "freehub", "spacing"]);
const isBlank = (value: unknown) => value == null || (typeof value === "string" && value.trim() === "");

// Existing database entries per proposal type — the source of each field's suggestions.
const CATEGORY_ITEMS: Record<NewCategory, object[]> = {
  derailleur: DERAILLEURS,
  hub: HUBS,
  "internal-hub": HUB_PRESETS.filter((h) => h.kind === "hub"),
  gearbox: HUB_PRESETS.filter((h) => h.kind === "bottomBracket"),
  cassette: CASSETTE_PRESETS,
};
// Per-product names (and free text) aren't worth suggesting.
const UNSUGGESTED_FIELDS = new Set(["model", "label", "source"]);
const VALUE_LABELS: Record<string, Record<string, string>> = { spacing: CASSETTE_SPACING_LABELS, type: HUB_TYPE_LABELS };
const suggestionCache = new Map<string, string[]>();
/** Distinct existing text values of a field, for the editor's pick-list. */
function fieldSuggestions(category: NewCategory, key: string): string[] {
  if (UNSUGGESTED_FIELDS.has(key)) return [];
  const cacheKey = `${category}:${key}`;
  let values = suggestionCache.get(cacheKey);
  if (!values) {
    const raw = CATEGORY_ITEMS[category].map((item) => (item as Record<string, unknown>)[key]).filter((v): v is string => typeof v === "string" && v.trim() !== "" && v !== "-");
    values = Array.from(new Set(key === "freehub" ? raw.flatMap(freehubOptions) : raw)).sort((x, y) => x.localeCompare(y, undefined, { sensitivity: "base" }));
    suggestionCache.set(cacheKey, values);
  }
  return values;
}

/** Plain-text email body for a proposal: free-text comments first, then the data as JSON. */
export function proposalEmailBody(draft: Record<string, unknown>, comments: string, existingEntry?: string): string {
  return [
    `Component ${existingEntry ? "change" : "addition"} proposal`,
    existingEntry && `Existing entry: ${existingEntry}`,
    comments && `Comments:\n${comments}`,
    `Proposed data:\n${JSON.stringify(draft, null, 2)}`,
  ].filter(Boolean).join("\n\n");
}

/** Editable version of the component spec table, for proposing additions/changes. */
function ProposalEditor(props: { isNew: boolean; draft: Record<string, unknown>; setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>; submitted: boolean; onCancel: () => void; onSubmit: (comments: string) => void }) {
  const { draft, setDraft } = props;
  const category = draft.category as NewCategory;
  const [attempted, setAttempted] = useState(false);
  const [comments, setComments] = useState("");
  const examples = (props.isNew && NEW_EXAMPLES[category]) || {};
  const isExample = (key: string) => examples[key] !== undefined && draft[key] === examples[key];
  const fields = PROPOSAL_FIELDS[category];
  const missing = fields.filter((key) => REQUIRED_FIELDS.has(key) && (isBlank(draft[key]) || isExample(key)));
  const malformed = fields.filter((key) => LIST_FIELDS.has(key) && !missing.includes(key) && !isBlank(draft[key]) && !isNumberList(draft[key]));
  const submit = () => { setAttempted(true); if (missing.length === 0 && malformed.length === 0) props.onSubmit(comments.trim()); };
  const setField = (key: string, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));
  // Switching type keeps whatever was entered for fields both types share.
  const changeCategory = (next: NewCategory) => setDraft((current) => {
    const fresh = proposalDraft(next, props.isNew ? undefined : {});
    for (const key of PROPOSAL_FIELDS[next]) if (key in current && !isBlank(current[key]) && current[key] !== examples[key]) fresh[key] = current[key];
    return fresh;
  });
  return <div className="component-editor" aria-label="Edit component details">
    <div className="table-wrap"><table className="component-edit-table"><tbody>
      <tr><th><label htmlFor="proposal-category">Component type</label></th><td><select id="proposal-category" value={category} onChange={(event) => changeCategory(event.target.value as NewCategory)}>{(Object.keys(NEW_CATEGORY_LABELS) as NewCategory[]).map((key) => <option key={key} value={key}>{NEW_CATEGORY_LABELS[key]}</option>)}</select></td></tr>
      {fields.map((key) => {
        const value = draft[key];
        const required = REQUIRED_FIELDS.has(key);
        const invalid = attempted && (missing.includes(key) || malformed.includes(key));
        const label = <th><label htmlFor={`proposal-${key}`}>{fieldLabel(key)}{required && <span className="component-edit-required" aria-hidden="true"> *</span>}</label></th>;
        if (BOOLEAN_FIELDS.has(key)) return <tr key={key}>{label}<td><input type="checkbox" id={`proposal-${key}`} checked={Boolean(value)} onChange={(event) => setField(key, event.target.checked)} /></td></tr>;
        const text = String(value ?? "");
        const suggestions = fieldSuggestions(category, key);
        // Narrow long lists to what's typed, unless the field already holds a listed value.
        const typed = text.trim().toLowerCase();
        const narrowed = typed && !suggestions.some((v) => v.toLowerCase() === typed) ? suggestions.filter((v) => v.toLowerCase().includes(typed) || (VALUE_LABELS[key]?.[v] ?? "").toLowerCase().includes(typed)) : [];
        const options = (narrowed.length ? narrowed : suggestions).map((v) => ({ value: v, label: VALUE_LABELS[key]?.[v] ? `${VALUE_LABELS[key][v]} (${v})` : v }));
        const input = <input type="text" id={`proposal-${key}`} className={isExample(key) ? "component-edit-example" : undefined} value={text} required={required} aria-invalid={invalid || undefined} onFocus={(event) => { if (isExample(key)) event.target.select(); }} placeholder={key === "source" ? "https://" : undefined} onChange={(event) => setField(key, event.target.value)} />;
        return <tr key={key} className={invalid ? "component-edit-invalid" : undefined}>{label}<td>
          {suggestions.length ? <div className="combo">{input}<PresetMenu title={`Pick an existing ${fieldLabel(key).toLowerCase()}`} options={options} onPick={(v) => setField(key, v)} /></div> : input}
        </td></tr>;
      })}
      <tr><th><label htmlFor="proposal-comments">Comments</label></th><td><textarea id="proposal-comments" rows={3} value={comments} placeholder="Any additional comments to explain the proposed changes to the database (optional)" onChange={(event) => setComments(event.target.value)} /></td></tr>
    </tbody></table></div>
    <div className="component-edit-footer"><p className="cp-foot">{attempted && (missing.length || malformed.length) ? <span className="component-edit-error" role="alert">{[missing.length ? `Fill in the required fields: ${missing.map(fieldLabel).join(", ")}.` : "", malformed.length ? `Use comma-separated numbers for: ${malformed.map(fieldLabel).join(", ")}.` : ""].filter(Boolean).join(" ")}</span> : <><span className="component-edit-required">*</span> Required. Your proposal is sent as an email for review; it won’t change the live database. By submitting, you agree that it may be included in the project’s data and distributed under the <a className="inline-link" href="https://github.com/jechter/bike-calculator/blob/master/LICENSE" target="_blank" rel="noreferrer">MIT License</a>.</>}</p><button type="button" className="component-action" onClick={props.onCancel}>Cancel</button><button type="button" className="component-action component-action--submit" onClick={submit}>Submit for review</button></div>
    {props.submitted && <p role="status" className="cp-foot">Email draft opened for your review.</p>}
  </div>;
}

export function Derailleur() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ComponentKind>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [brand, setBrand] = useState("all");
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [discipline, setDiscipline] = useState("all");
  const [speeds, setSpeeds] = useState("all");
  const [spokeCount, setSpokeCount] = useState("all");
  const [hubWidth, setHubWidth] = useState("all");
  const [cassetteRange, setCassetteRange] = useState("all");
  const [cassetteFreehub, setCassetteFreehub] = useState("all");
  const [gearCount, setGearCount] = useState("all");
  const [visibleCount, setVisibleCount] = useState(80);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [isNew, setIsNew] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const derailleurRows: ComponentRow[] = DERAILLEURS.map((d) => ({ kind: "derailleur", key: `rd:${d.key}`, title: `${d.series ? `${d.series} ` : ""}${d.model}${d.cage ? ` ${d.cage}` : ""}`, brand: d.brand, data: d }));
  const hubRows: ComponentRow[] = HUBS.map((h) => ({ kind: "hub", key: `hub:${hubName(h)}`, title: h.model, brand: h.manufacturer, data: h }));
  const gearRows: ComponentRow[] = HUB_PRESETS.map((h) => ({ kind: "gearing", key: `gear:${h.label}`, title: h.label.replace(new RegExp(`^${h.manufacturer}\\s+`, "i"), ""), brand: h.manufacturer, data: h }));
  const cassetteRows: ComponentRow[] = CASSETTE_PRESETS.map((c, index) => ({ kind: "cassette", key: `cassette:${c.brand}:${c.model}:${index}`, title: `${c.series ? `${c.series} ` : ""}${c.model}`, brand: c.brand, data: c }));
  const allRows = [...derailleurRows, ...hubRows, ...gearRows, ...cassetteRows].sort((a, b) => a.brand.localeCompare(b.brand, undefined, { sensitivity: "base" }) || a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  const brands = useMemo(() => Array.from(new Set(allRows.map((row) => row.brand))).sort((a, b) => a.localeCompare(b)), []);
  const filteredBrands = brands.filter((b) => b.toLowerCase().includes(brandSearch.trim().toLowerCase()));
  const scopedDerailleurs = DERAILLEURS.filter((d) => brand === "all" || d.brand === brand);
  const scopedDiscipline = scopedDerailleurs.filter((d) => discipline === "all" || d.discipline === discipline);
  const speedFacet = Array.from(new Set(scopedDiscipline.map((d) => d.speeds))).sort((a, b) => a - b);
  const cassetteSpeeds = Array.from(new Set(CASSETTE_PRESETS.filter((c) => brand === "all" || c.brand === brand).map((c) => c.speeds))).sort((a, b) => a - b);
  const cassetteScoped = CASSETTE_PRESETS.filter((c) => (brand === "all" || c.brand === brand) && (speeds === "all" || c.speeds === Number(speeds)));
  const cassetteCogs = cassetteScoped.map((c) => `${c.cogs[0]}–${c.cogs[c.cogs.length - 1]}T`);
  const cassetteFreehubs = Array.from(new Set(cassetteScoped.flatMap((c) => freehubOptions(c.freehub)))).sort((a, b) => a.localeCompare(b));
  const hubCounts = Array.from(new Set(HUBS.filter((h) => brand === "all" || h.manufacturer === brand).flatMap((h) => h.spokeCounts))).sort((a, b) => a - b);
  const hubWidths = Array.from(new Set(HUBS.filter((h) => (brand === "all" || h.manufacturer === brand) && (spokeCount === "all" || h.spokeCounts.includes(Number(spokeCount)))).map((h) => h.widthMm))).sort((a, b) => a - b);
  const matchingDerailleurs = searchDerailleurs(query).filter((d) => (brand === "all" || d.brand === brand) && (kind !== "derailleur" || discipline === "all" || d.discipline === discipline) && (kind !== "derailleur" || speeds === "all" || d.speeds === Number(speeds)));
  const normQuery = query.trim().toLowerCase();
  const results = allRows.filter((row) => {
    if (kind !== "all" && kind !== "internal-hub" && kind !== "gearbox" && row.kind !== kind) return false;
    if ((kind === "internal-hub" || kind === "gearbox") && (row.kind !== "gearing" || row.data.kind !== (kind === "gearbox" ? "bottomBracket" : "hub"))) return false;
    if (brand !== "all" && row.brand !== brand) return false;
    if (row.kind === "derailleur") return matchingDerailleurs.some((d) => d.key === row.data.key);
    if (kind === "hub" && row.kind === "hub" && ((discipline !== "all" && row.data.type !== discipline) || (spokeCount !== "all" && !row.data.spokeCounts.includes(Number(spokeCount))) || (hubWidth !== "all" && row.data.widthMm !== Number(hubWidth)))) return false;
    if ((kind === "internal-hub" || kind === "gearbox") && row.kind === "gearing" && ((gearCount === "cvt" && !row.data.continuouslyVariable) || (gearCount !== "all" && gearCount !== "cvt" && (row.data.continuouslyVariable || row.data.gears.length !== Number(gearCount))))) return false;
    if (row.kind === "cassette" && ((speeds !== "all" && row.data.speeds !== Number(speeds)) || (cassetteRange !== "all" && `${row.data.cogs[0]}–${row.data.cogs[row.data.cogs.length - 1]}T` !== cassetteRange) || (cassetteFreehub !== "all" && !freehubOptions(row.data.freehub).includes(cassetteFreehub)))) return false;
    if (row.kind === "cassette" && normQuery && !(`${row.title} ${row.brand} ${row.data.freehub} ${row.data.speeds} ${row.data.cogs.join(" ")}`.toLowerCase().includes(normQuery))) return false;
    if (row.kind === "hub" && normQuery && !(`${row.title} ${row.brand} ${row.data.type} ${row.data.widthMm}mm ${row.data.spokeCounts.join(" ")}`.toLowerCase().includes(normQuery))) return false;
    if (row.kind === "gearing" && normQuery && !(`${row.title} ${row.brand} ${row.data.kind} ${row.data.gears.length} speed`.toLowerCase().includes(normQuery))) return false;
    return true;
  });
  const shown = results.slice(0, visibleCount);
  const selected = allRows.find((row) => row.key === selectedKey) ?? null;
  // Deselect a component once the filters no longer match it (closing its details).
  const selectionFiltered = selectedKey !== null && !results.some((row) => row.key === selectedKey);
  useEffect(() => { if (selectionFiltered) setSelectedKey(null); }, [selectionFiltered]);

  // Capture arrow navigation at the document level so it works after a row click
  // even when focus remains on the page (rather than inside the scrollable table).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      event.stopPropagation();
      const currentIndex = results.findIndex((row) => row.key === selectedKey);
      const nextIndex = currentIndex < 0
        ? (event.key === "ArrowDown" ? 0 : results.length - 1)
        : Math.max(0, Math.min(results.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
      if (results[nextIndex]) setSelectedKey(results[nextIndex].key);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [results, selectedKey]);

  const opt = (value: string, label: string) => ({ value, label });
  const rowCategory = (row: ComponentRow): NewCategory => row.kind === "gearing" ? (row.data.kind === "bottomBracket" ? "gearbox" : "internal-hub") : row.kind;
  const categoryName = (row: ComponentRow) => row.kind === "derailleur" ? "Derailleur" : row.kind === "hub" ? "Wheel hub" : row.kind === "cassette" ? "Cassette" : row.data.kind === "bottomBracket" ? "Gearbox" : "Internal gear hub";
  const source = selected?.data.source;

  const beginEdit = (draft: Record<string, unknown>, fresh = false) => { setDraft(draft); setEditing(!fresh); setIsNew(fresh); setSubmitted(false); };
  const cancelEdit = () => { setEditing(false); setIsNew(false); };
  // Selecting a component discards any open proposal (a change or a new component).
  // Opening a new proposal clears the selection, so only a real selection closes it.
  useEffect(() => { setEditing(false); if (selectedKey) setIsNew(false); }, [selectedKey]);
  // "Propose new component" lives in the page header (ComponentProposalButton).
  const newEditorRef = useRef<HTMLDivElement>(null);
  // (The details-only view below shows the editor at the top already.)
  const detailsOnlyRef = useRef(false);
  useEffect(() => {
    const onNew = () => { setSelectedKey(null); beginEdit(proposalDraft("derailleur"), true); };
    window.addEventListener(NEW_COMPONENT_EVENT, onNew);
    return () => window.removeEventListener(NEW_COMPONENT_EVENT, onNew);
  }, []);
  useEffect(() => { if (isNew && !detailsOnlyRef.current) newEditorRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, [isNew]);
  // In the compact layout on a short screen (phones, small tablets in landscape)
  // the list and the details don't both fit — the details would land off-screen
  // below a long list. There the details (or a new proposal) replace the list
  // until closed; the list's scroll position is restored on the way back.
  const isMobile = useIsMobile();
  const shortScreen = useMediaQuery("(max-height: 1000px)");
  const detailsOnly = isMobile && shortScreen && (selected !== null || isNew);
  detailsOnlyRef.current = detailsOnly;
  const listRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef({ page: 0, list: 0 });
  const closeDetails = () => { setSelectedKey(null); cancelEdit(); };
  useLayoutEffect(() => {
    if (detailsOnly) {
      window.scrollTo?.(0, 0);
    } else {
      if (listRef.current) listRef.current.scrollTop = savedScroll.current.list;
      window.scrollTo?.(0, savedScroll.current.page);
    }
  }, [detailsOnly]);
  // Remember where the list was just before it's swapped out for the details.
  const rememberScroll = () => {
    if (detailsOnly) return;
    savedScroll.current = { page: window.scrollY, list: listRef.current?.scrollTop ?? 0 };
  };
  const select = (key: string) => { rememberScroll(); setSelectedKey(key); };
  useEffect(() => {
    // React applies the editor-opening state change after the event, so this
    // still sees the list in place.
    const onNew = () => rememberScroll();
    window.addEventListener(NEW_COMPONENT_EVENT, onNew);
    return () => window.removeEventListener(NEW_COMPONENT_EVENT, onNew);
  });
  const closeButton = (label: string) => <button type="button" className="component-close" aria-label={label} title={label} onClick={closeDetails}>
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
  </button>;
  const submitDraft = (comments: string) => {
    const body = proposalEmailBody(draft, comments, !isNew && selected ? `${selected.brand} ${selected.title} (${categoryName(selected)})` : undefined);
    window.location.href = `mailto:${proposalMailbox()}?subject=${encodeURIComponent("Component database proposal")}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  };
  return <div className={"component-db" + (detailsOnly ? " component-db--details-only" : "")}>
    {!detailsOnly && <>
    <div className="rows">
      <Field label="Search" hint={`${results.length} matching components`}>
        <div className="component-search">
          <TextInput value={query} onChange={setQuery} placeholder="e.g. Shimano, Deore, Rohloff, 135mm" />
          {query && <button type="button" className="component-search-clear" aria-label="Clear search" title="Clear search" onClick={() => setQuery("")}>×</button>}
        </div>
      </Field>
    </div>
    <div className="cp-filters" style={{ marginTop: 8 }}>
      <Field label="Component type"><Select value={kind} onChange={(v) => { setKind(v as ComponentKind); setDiscipline("all"); setSpeeds("all"); setSpokeCount("all"); setHubWidth("all"); setCassetteRange("all"); setCassetteFreehub("all"); setGearCount("all"); }} options={[opt("all", "All components"), opt("derailleur", "Derailleurs"), opt("hub", "Wheel hubs"), opt("internal-hub", "Internal gear hubs"), opt("gearbox", "Gearboxes"), opt("cassette", "Cassettes")]} /></Field>
      <Field label="Brand">
      <div className="component-brand-filter">
        <button type="button" className="preset-btn component-brand-trigger" aria-expanded={brandOpen} onClick={() => setBrandOpen((open) => !open)}>{brand === "all" ? "All brands" : brand} <span className="caret">▾</span></button>
        {brandOpen && <div className="cp-pop component-brand-pop">
          <input className="cp-search" type="text" autoFocus placeholder="Filter brands…" aria-label="Filter brands" value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)} />
          <ul className="cp-list">
            <li><button type="button" onClick={() => { setBrand("all"); setSpeeds("all"); setCassetteRange("all"); setCassetteFreehub("all"); setBrandOpen(false); }}>All brands</button></li>
            {filteredBrands.map((b) => <li key={b}><button type="button" onClick={() => { setBrand(b); setSpeeds("all"); setCassetteRange("all"); setCassetteFreehub("all"); setBrandOpen(false); }}>{b}</button></li>)}
            {filteredBrands.length === 0 && <li className="cp-empty">No brands match.</li>}
          </ul>
        </div>}
      </div>
      </Field>
      {kind === "derailleur" && <>
        <Field label="Type"><Select value={discipline} onChange={(d) => { setDiscipline(d); setSpeeds("all"); }} options={[opt("all", "All types"), opt("Road", "Road"), opt("Gravel", "Gravel"), opt("MTB", "MTB")]} /></Field>
        <Field label="Speeds"><Select value={speeds} onChange={setSpeeds} options={[opt("all", "All speeds"), ...speedFacet.map((s) => opt(String(s), `${s}-speed`))]} /></Field>
      </>}
      {kind === "hub" && <>
        <Field label="Hub type"><Select value={discipline} onChange={setDiscipline} options={[opt("all", "All types"), ...Object.entries(HUB_TYPE_LABELS).map(([value, label]) => opt(value, label))]} /></Field>
        <Field label="Spoke count"><Select value={spokeCount} onChange={(v) => { setSpokeCount(v); setHubWidth("all"); }} options={[opt("all", "Any holes"), ...hubCounts.map((n) => opt(String(n), `${n}h`))]} /></Field>
        <Field label="Spacing"><Select value={hubWidth} onChange={setHubWidth} options={[opt("all", "Any width"), ...hubWidths.map((w) => opt(String(w), `${w} mm`))]} /></Field>
      </>}
      {(kind === "internal-hub" || kind === "gearbox") && <Field label="Gears"><Select value={gearCount} onChange={setGearCount} options={[opt("all", "Any count"), ...Array.from(new Set(HUB_PRESETS.filter((h) => h.kind === (kind === "gearbox" ? "bottomBracket" : "hub") && !h.continuouslyVariable).map((h) => h.gears.length))).sort((a, b) => a - b).map((n) => opt(String(n), `${n} gears`)), opt("cvt", "Continuously variable")]} /></Field>}
      {kind === "cassette" && <>
        <Field label="Speeds"><Select value={speeds} onChange={(v) => { setSpeeds(v); setCassetteRange("all"); setCassetteFreehub("all"); }} options={[opt("all", "All speeds"), ...cassetteSpeeds.map((n) => opt(String(n), `${n}-speed`))]} /></Field>
        <Field label="Range"><Select value={cassetteRange} onChange={setCassetteRange} options={[opt("all", "All ranges"), ...Array.from(new Set(cassetteCogs)).sort().map((r) => opt(r, r))]} /></Field>
        <Field label="Freehub body"><Select value={cassetteFreehub} onChange={setCassetteFreehub} options={[opt("all", "All bodies"), ...cassetteFreehubs.map((f) => opt(f, f))]} /></Field>
      </>}
    </div>
    <div className="components-list-scroll table-wrap" ref={listRef} onScroll={(event) => {
      const el = event.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 32 && visibleCount < results.length) {
        setVisibleCount((count) => Math.min(count + 80, results.length));
      }
    }}><table>
      <thead><tr><th>Brand</th><th>Component</th><th className="component-col-cat">Category</th><th>Details</th></tr></thead>
      <tbody>
        {shown.map((row) => <tr key={row.key} className="component-row" onClick={() => select(row.key)} aria-selected={selectedKey === row.key}>
          <td>{row.brand}</td>
          <td><button type="button" className="component-select" onClick={() => select(row.key)}>{row.title}</button></td>
          <td className="component-col-cat">{categoryName(row)}</td>
          <td>{row.kind === "derailleur" ? `${row.data.discipline} · ${row.data.speeds}-speed` : row.kind === "hub" ? `${HUB_TYPE_LABELS[row.data.type]} · ${row.data.widthMm}mm · ${row.data.spokeCounts.join(", ")}h` : row.kind === "gearing" ? row.data.continuouslyVariable ? `CVT · ${row.data.gears[0].ratio.toFixed(2)}–${row.data.gears[1].ratio.toFixed(2)} ratio` : `${row.data.gears.length} gears` : `${row.data.speeds}-speed · ${row.data.cogs[0]}–${row.data.cogs[row.data.cogs.length - 1]}T`}</td>
        </tr>)}
        {shown.length === 0 && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>No components match — try a different search or category.</td></tr>}
      </tbody>
    </table></div>
    {results.length > shown.length && <div className="cp-foot">Showing first {shown.length} of {results.length} — refine to narrow.</div>}
    </>}
    {selected && <div className="component-details"><Section title={<><span>{selected.brand} {selected.title}</span><span className="component-detail-kind">{categoryName(selected)}</span></>} action={<>{!editing && <button type="button" className="component-action" onClick={() => beginEdit(proposalDraft(rowCategory(selected), selected.data))}><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M11.7 1.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4L5.1 14H1v-4.1L11.7 1.3zM2.5 10.5v2h2L12.9 4 11 2.1z"/></svg> Propose changes</button>}{closeButton("Close details")}</>}>
      {editing && <ProposalEditor key={selected.key} isNew={false} draft={draft} setDraft={setDraft} submitted={submitted} onCancel={cancelEdit} onSubmit={submitDraft} />}
      {!editing && <div className="table-wrap"><table><tbody>
        {selected.kind === "derailleur" && <>
          <tr><th>Brand / model</th><td>{selected.data.brand} {selected.data.model}</td></tr><tr><th>Series</th><td>{selected.data.series ?? "—"}</td></tr><tr><th>Discipline / speeds</th><td>{selected.data.discipline} · {selected.data.speeds}-speed</td></tr><tr><th>Cage</th><td>{selected.data.cage ?? "—"}</td></tr><tr><th>Max sprocket / capacity</th><td>{selected.data.maxSprocket != null ? `${selected.data.maxSprocket}T` : "—"} / {selected.data.totalCapacity != null ? `${selected.data.totalCapacity}T` : "—"}</td></tr><tr><th>Actuation / pull ratio</th><td>{selected.data.actuation ?? "Unknown"} / {pullRatioFor(selected.data)}</td></tr><tr><th>Years</th><td>{years(selected.data)}</td></tr>
        </>}
        {selected.kind === "hub" && <>
          <tr><th>Manufacturer / model</th><td>{selected.data.manufacturer} {selected.data.model}</td></tr><tr><th>Type</th><td>{HUB_TYPE_LABELS[selected.data.type]}</td></tr><tr><th>Spacing (OLD)</th><td>{selected.data.widthMm} mm</td></tr><tr><th>Spoke counts</th><td>{selected.data.spokeCounts.join(", ")}</td></tr><tr><th>Flange diameters</th><td>{selected.data.leftFlangeDiaMm} / {selected.data.rightFlangeDiaMm} mm</td></tr><tr><th>Flange offsets</th><td>{selected.data.leftOffsetMm} / {selected.data.rightOffsetMm} mm</td></tr><tr><th>Spoke hole</th><td>{selected.data.spokeHoleMm ?? "—"} mm</td></tr>
        </>}
        {selected.kind === "gearing" && <>
          <tr><th>Manufacturer / model</th><td>{selected.brand} {selected.title}</td></tr>{selected.data.kind === "bottomBracket" && <tr><th>Type</th><td>Bottom-bracket gearbox</td></tr>}<tr><th>Gear count</th><td>{selected.data.continuouslyVariable ? "Continuously variable" : selected.data.gears.length}</td></tr><tr><th>Ratios</th><td>{selected.data.gears.map((g) => g.ratio.toFixed(3)).join(", ")}</td></tr><tr><th>Derailleur compatible</th><td>{selected.data.derailleurCompatible ? "Yes" : "No"}</td></tr>
        </>}
        {selected.kind === "cassette" && <>
          <tr><th>Brand / model</th><td>{selected.data.brand} {selected.data.model}</td></tr>{selected.data.series && <tr><th>Series</th><td>{selected.data.series}</td></tr>}<tr><th>Speeds</th><td>{selected.data.speeds}</td></tr><tr><th>Sprockets</th><td>{selected.data.cogs.map((cog) => `${cog}T`).join(" – ")}</td></tr><tr><th>Freehub body</th><td>{selected.data.freehub}</td></tr><tr><th>Spacing standard</th><td>{CASSETTE_SPACING_LABELS[selected.data.spacing]}</td></tr><tr><th>Special type</th><td>{selected.data.special ?? "—"}</td></tr><tr><th>Weight</th><td>{selected.data.weightGrams != null ? `${selected.data.weightGrams} g` : "—"}</td></tr>
        </>}
        {source && <tr><th>Source</th><td><a className="inline-link" href={source.url} target="_blank" rel="noreferrer">{source.url}</a></td></tr>}
        <tr><th>Configure</th><td><a className="inline-link component-config-link" href={selected.kind === "hub" ? `#/wheel-building?hub=${encodeURIComponent(`${selected.data.manufacturer}~${selected.data.model}`)}` : selected.kind === "cassette" ? `#/drivetrain?cassette=${encodeURIComponent(`${selected.data.brand} ${selected.data.model}`)}` : selected.kind === "gearing" ? `#/drivetrain?gearing=${encodeURIComponent(selected.data.label)}` : `#/drivetrain?derailleur=${encodeURIComponent(selected.data.key)}`}>{selected.kind === "hub" ? "Configure in Wheel Building" : "Configure in Drivetrain"} →</a></td></tr>
      </tbody></table></div>}
    </Section></div>}
    {isNew && <div className="component-details" ref={newEditorRef}><Section title={<><span>New component</span><span className="component-detail-kind">{NEW_CATEGORY_LABELS[draft.category as NewCategory]}</span></>} action={closeButton("Close proposal")}>
      <ProposalEditor isNew draft={draft} setDraft={setDraft} submitted={submitted} onCancel={cancelEdit} onSubmit={submitDraft} />
    </Section></div>}
  </div>;
}
