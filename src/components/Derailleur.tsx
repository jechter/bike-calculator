import { useMemo, useState } from "react";
import {
  DERAILLEUR_SYSTEMS,
  DERAILLEURS,
  searchDerailleurs,
  pullRatioFor,
  type DerailleurSpec,
} from "../lib/derailleur";
import { Field, TextInput, Select, Section } from "./ui";

// Keep the DOM light: the database has ~550 rows, so cap what's rendered and
// nudge the user to filter (mirrors the cassette picker's cap).
const ROW_CAP = 250;

function years(d: DerailleurSpec): string {
  if (d.introduced && d.discontinued) return `${d.introduced}–${d.discontinued}`;
  if (d.introduced) return `${d.introduced}–`;
  if (d.discontinued) return `–${d.discontinued}`;
  return "—";
}

export function Derailleur() {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [discipline, setDiscipline] = useState("all");
  const [speeds, setSpeeds] = useState("all");

  const brands = useMemo(
    () => Array.from(new Set(DERAILLEURS.map((d) => d.brand))).sort((a, b) => a.localeCompare(b)),
    [],
  );

  // Facets narrow left-to-right: speeds reflect the chosen brand + discipline.
  const byBrand = DERAILLEURS.filter((d) => brand === "all" || d.brand === brand);
  const byDiscipline = byBrand.filter((d) => discipline === "all" || d.discipline === discipline);
  const speedFacet = Array.from(new Set(byDiscipline.map((d) => d.speeds))).sort((a, b) => a - b);

  const textMatches = searchDerailleurs(query);
  const results = textMatches.filter(
    (d) =>
      (brand === "all" || d.brand === brand) &&
      (discipline === "all" || d.discipline === discipline) &&
      (speeds === "all" || d.speeds === Number(speeds)),
  );
  const shown = results.slice(0, ROW_CAP);

  const opt = (value: string, label: string) => ({ value, label });
  const brandOptions = [opt("all", "All brands"), ...brands.map((b) => opt(b, b))];
  const disciplineOptions = [
    opt("all", "All types"),
    opt("Road", "Road"),
    opt("Gravel", "Gravel"),
    opt("MTB", "MTB"),
  ];
  const speedsOptions = [opt("all", "All speeds"), ...speedFacet.map((s) => opt(String(s), `${s}-speed`))];

  return (
    <>
      <Section
        title="Derailleur database"
        info={
          <>
            {DERAILLEURS.length} rear derailleurs. Search by brand, model, series,
            discipline or speeds (e.g. “shimano 11”, “deore”, “eagle”), and narrow
            with the filters. Specs are <strong>sourced but approximate</strong> —
            each row links to its source; verify against the manufacturer. The{" "}
            <strong>actuation family is derived</strong> (from brand/type/speeds)
            and shown as a guide; third-party brands are often “unknown”. To check
            whether one fits a given cassette/crankset, pick it in the{" "}
            <a className="inline-link" href="#/drivetrain">
              drivetrain calculator
            </a>
            .
          </>
        }
      >
        <div className="rows">
          <Field label="Search" hint={`${results.length} of ${DERAILLEURS.length} shown`}>
            <TextInput
              value={query}
              onChange={setQuery}
              placeholder="e.g. shimano 11, deore, eagle, tourney"
            />
          </Field>
        </div>
        <div className="cp-filters" style={{ marginTop: 8 }}>
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
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Disc.</th>
                <th className="num">Speeds</th>
                <th>Cage</th>
                <th className="num">Max cog</th>
                <th className="num">Capacity</th>
                <th>Actuation</th>
                <th className="num">Pull ratio</th>
                <th className="num">Years</th>
                <th>Src</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.key}>
                  <td>
                    {d.brand} {d.model}
                    {d.series && <div className="dr-note">{d.series}{d.electronic ? ` · ${d.electronic}` : ""}</div>}
                    {!d.series && d.electronic && <div className="dr-note">{d.electronic}</div>}
                  </td>
                  <td>{d.discipline}</td>
                  <td className="num">{d.speeds}</td>
                  <td>{d.cage ?? "—"}</td>
                  <td className="num">{d.maxSprocket != null ? `${d.maxSprocket}T` : "—"}</td>
                  <td className="num">{d.totalCapacity != null ? `${d.totalCapacity}T` : "—"}</td>
                  <td>{d.actuation ?? <span style={{ color: "var(--muted)" }}>unknown</span>}</td>
                  <td className="num">{pullRatioFor(d)}</td>
                  <td className="num">{years(d)}</td>
                  <td>
                    {d.source ? (
                      <a
                        className="inline-link"
                        href={d.source.url}
                        target="_blank"
                        rel="noreferrer"
                        title={`${d.source.sourceType} source${d.source.note ? ` — ${d.source.note}` : ""}`}
                      >
                        ↗
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ color: "var(--muted)" }}>
                    No derailleurs match — try a different search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {results.length > shown.length && (
          <div className="cp-foot">
            Showing first {shown.length} of {results.length} — refine to narrow.
          </div>
        )}
      </Section>

      <Section
        title="Compatibility reference"
        info={
          <>
            Actuation ratios are approximate and marketing-obscured —{" "}
            <strong>verify before relying on them</strong>. The reliable rule:
            shifter and rear derailleur must share an actuation family, and the
            cassette speed count must match the shifter.
          </>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Family</th>
                <th>Speeds</th>
                <th>Discipline</th>
                <th>Actuation</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {DERAILLEUR_SYSTEMS.map((s) => (
                <tr key={s.family}>
                  <td>{s.family}</td>
                  <td>{s.speeds}</td>
                  <td>{s.discipline}</td>
                  <td>{s.actuationNote}</td>
                  <td>{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
