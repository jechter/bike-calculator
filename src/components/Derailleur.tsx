import { useState } from "react";
import { DERAILLEUR_SYSTEMS, searchDerailleurs } from "../lib/derailleur";
import { Field, TextInput, Section } from "./ui";

export function Derailleur() {
  const [query, setQuery] = useState("");
  const results = searchDerailleurs(query);

  return (
    <>
      <Section
        title="Derailleur database"
        info={
          <>
            Search by brand, model, discipline or speeds (e.g. “shimano 11”,
            “deore”, “gravel”). Specs are <strong>approximate, community-sourced</strong>
            {" "}— verify against the manufacturer. To check whether one fits a given
            cassette/crankset, pick it in the{" "}
            <a className="inline-link" href="#/drivetrain">
              drivetrain calculator
            </a>
            .
          </>
        }
      >
        <div className="rows">
          <Field label="Search" hint={`${results.length} of ${searchDerailleurs("").length} shown`}>
            <TextInput
              value={query}
              onChange={setQuery}
              placeholder="e.g. shimano 11, deore, gravel, tourney"
            />
          </Field>
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Disc.</th>
                <th>Speeds</th>
                <th>Cage</th>
                <th className="num">Max cog</th>
                <th className="num">Capacity</th>
                <th>Actuation</th>
              </tr>
            </thead>
            <tbody>
              {results.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.model}
                    {d.notes && <div className="dr-note">{d.notes}</div>}
                  </td>
                  <td>{d.discipline}</td>
                  <td>{d.speeds}</td>
                  <td>{d.cage}</td>
                  <td className="num">{d.maxSprocket}T</td>
                  <td className="num">{d.totalCapacity}T</td>
                  <td>{d.actuation}</td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: "var(--muted)" }}>
                    No derailleurs match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
