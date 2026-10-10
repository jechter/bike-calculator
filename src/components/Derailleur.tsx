import { useEffect, useMemo, useState } from "react";
import { HUBS, HUB_TYPE_LABELS, type Hub } from "../lib/spokes";
import { CASSETTE_PRESETS, CASSETTE_SPACING_LABELS, HUB_PRESETS, type CassettePreset, type HubPreset } from "../lib/drivetrain";
import { DERAILLEURS, searchDerailleurs, pullRatioFor, type DerailleurSpec } from "../lib/derailleur";
import { Field, TextInput, Select, Section } from "./ui";

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
  const categoryName = (row: ComponentRow) => row.kind === "derailleur" ? "Derailleur" : row.kind === "hub" ? "Wheel hub" : row.kind === "cassette" ? "Cassette" : row.data.kind === "bottomBracket" ? "Gearbox" : "Internal gear hub";
  const source = selected?.data.source;

  return <Section title="Components database">
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
    <div className="components-list-scroll table-wrap" onScroll={(event) => {
      const el = event.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 32 && visibleCount < results.length) {
        setVisibleCount((count) => Math.min(count + 80, results.length));
      }
    }} style={{ marginTop: 12, maxHeight: 340, overflowY: "auto" }}><table>
      <thead><tr><th>Brand</th><th>Component</th><th>Category</th><th>Details</th></tr></thead>
      <tbody>
        {shown.map((row) => <tr key={row.key} className="component-row" onClick={() => setSelectedKey(row.key)} aria-selected={selectedKey === row.key}>
          <td>{row.brand}</td>
          <td><button type="button" className="component-select" onClick={() => setSelectedKey(row.key)}>{row.title}</button></td>
          <td>{categoryName(row)}</td>
          <td>{row.kind === "derailleur" ? `${row.data.discipline} · ${row.data.speeds}-speed` : row.kind === "hub" ? `${HUB_TYPE_LABELS[row.data.type]} · ${row.data.widthMm}mm · ${row.data.spokeCounts.join(", ")}h` : row.kind === "gearing" ? row.data.continuouslyVariable ? `CVT · ${row.data.gears[0].ratio.toFixed(2)}–${row.data.gears[1].ratio.toFixed(2)} ratio` : `${row.data.gears.length} gears` : `${row.data.speeds}-speed · ${row.data.cogs[0]}–${row.data.cogs[row.data.cogs.length - 1]}T`}</td>
        </tr>)}
        {shown.length === 0 && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>No components match — try a different search or category.</td></tr>}
      </tbody>
    </table></div>
    {results.length > shown.length && <div className="cp-foot">Showing first {shown.length} of {results.length} — refine to narrow.</div>}
    {selected && <div className="component-details"><Section title={<><span>{selected.brand} {selected.title}</span><span className="component-detail-kind">{categoryName(selected)}</span></>}>
      <div className="table-wrap"><table><tbody>
        {selected.kind === "derailleur" && <>
          <tr><th>Brand / model</th><td>{selected.data.brand} {selected.data.model}</td></tr><tr><th>Series</th><td>{selected.data.series ?? "—"}</td></tr><tr><th>Discipline / speeds</th><td>{selected.data.discipline} · {selected.data.speeds}-speed</td></tr><tr><th>Cage</th><td>{selected.data.cage ?? "—"}</td></tr><tr><th>Max sprocket / capacity</th><td>{selected.data.maxSprocket != null ? `${selected.data.maxSprocket}T` : "—"} / {selected.data.totalCapacity != null ? `${selected.data.totalCapacity}T` : "—"}</td></tr><tr><th>Actuation / pull ratio</th><td>{selected.data.actuation ?? "Unknown"} / {pullRatioFor(selected.data)}</td></tr><tr><th>Years</th><td>{years(selected.data)}</td></tr>
        </>}
        {selected.kind === "hub" && <>
          <tr><th>Manufacturer / model</th><td>{selected.data.manufacturer} {selected.data.model}</td></tr><tr><th>Type</th><td>{HUB_TYPE_LABELS[selected.data.type]}</td></tr><tr><th>Spacing (OLD)</th><td>{selected.data.widthMm} mm</td></tr><tr><th>Spoke counts</th><td>{selected.data.spokeCounts.join(", ")}</td></tr><tr><th>Flange diameters</th><td>{selected.data.leftFlangeDiaMm} / {selected.data.rightFlangeDiaMm} mm</td></tr><tr><th>Flange offsets</th><td>{selected.data.leftOffsetMm} / {selected.data.rightOffsetMm} mm</td></tr><tr><th>Spoke hole</th><td>{selected.data.spokeHoleMm ?? "—"} mm</td></tr>
        </>}
        {selected.kind === "gearing" && <>
          <tr><th>Manufacturer / model</th><td>{selected.data.manufacturer} {selected.data.label}</td></tr>{selected.data.kind === "bottomBracket" && <tr><th>Type</th><td>Bottom-bracket gearbox</td></tr>}<tr><th>Gear count</th><td>{selected.data.continuouslyVariable ? "Continuously variable" : selected.data.gears.length}</td></tr><tr><th>Ratios</th><td>{selected.data.gears.map((g) => g.ratio.toFixed(3)).join(", ")}</td></tr><tr><th>Derailleur compatible</th><td>{selected.data.derailleurCompatible ? "Yes" : "No"}</td></tr>
        </>}
        {selected.kind === "cassette" && <>
          <tr><th>Brand / model</th><td>{selected.data.brand} {selected.data.model}</td></tr>{selected.data.series && <tr><th>Series</th><td>{selected.data.series}</td></tr>}<tr><th>Speeds</th><td>{selected.data.speeds}</td></tr><tr><th>Sprockets</th><td>{selected.data.cogs.map((cog) => `${cog}T`).join(" – ")}</td></tr><tr><th>Freehub body</th><td>{selected.data.freehub}</td></tr><tr><th>Spacing standard</th><td>{CASSETTE_SPACING_LABELS[selected.data.spacing]}</td></tr><tr><th>Special type</th><td>{selected.data.special ?? "—"}</td></tr><tr><th>Weight</th><td>{selected.data.weightGrams != null ? `${selected.data.weightGrams} g` : "—"}</td></tr>
        </>}
        {source && <tr><th>Source</th><td><a className="inline-link" href={source.url} target="_blank" rel="noreferrer">{source.url}</a></td></tr>}
        <tr><th>Configure</th><td><a className="inline-link component-config-link" href={selected.kind === "hub" ? `#/wheel-building?hub=${encodeURIComponent(`${selected.data.manufacturer}~${selected.data.model}`)}` : selected.kind === "cassette" ? `#/drivetrain?cassette=${encodeURIComponent(`${selected.data.brand} ${selected.data.model}`)}` : selected.kind === "gearing" ? `#/drivetrain?gearing=${encodeURIComponent(selected.data.label)}` : `#/drivetrain?derailleur=${encodeURIComponent(selected.data.key)}`}>{selected.kind === "hub" ? "Configure in Wheel Building" : "Configure in Drivetrain"} →</a></td></tr>
      </tbody></table></div>
    </Section></div>}
  </Section>;
}
