import { useState } from "react";
import { checkCapacity, DERAILLEUR_SYSTEMS } from "../lib/derailleur";
import { Field, NumberInput, Result, Note, Section } from "./ui";

export function Derailleur() {
  const [bigRing, setBigRing] = useState(50);
  const [smallRing, setSmallRing] = useState(34);
  const [bigCog, setBigCog] = useState(32);
  const [smallCog, setSmallCog] = useState(11);
  const [capacity, setCapacity] = useState(37);
  const [maxSprocket, setMaxSprocket] = useState(32);

  const r = checkCapacity({
    largestChainring: bigRing,
    smallestChainring: smallRing,
    largestCog: bigCog,
    smallestCog: smallCog,
    ratedCapacity: capacity,
    maxSprocket,
  });

  return (
    <>
      <Section title="Capacity & max-sprocket check">
        <div className="grid">
          <Field label="Largest chainring">
            <NumberInput value={bigRing} onChange={setBigRing} suffix="T" />
          </Field>
          <Field label="Smallest chainring" hint="= largest for 1×">
            <NumberInput value={smallRing} onChange={setSmallRing} suffix="T" />
          </Field>
          <Field label="Largest cog">
            <NumberInput value={bigCog} onChange={setBigCog} suffix="T" />
          </Field>
          <Field label="Smallest cog">
            <NumberInput value={smallCog} onChange={setSmallCog} suffix="T" />
          </Field>
          <Field label="Derailleur rated capacity">
            <NumberInput value={capacity} onChange={setCapacity} suffix="T" />
          </Field>
          <Field label="Derailleur max sprocket">
            <NumberInput value={maxSprocket} onChange={setMaxSprocket} suffix="T" />
          </Field>
        </div>
        <div className="results" style={{ marginTop: 8 }}>
          <Result
            label="Required capacity"
            value={`${r.requiredCapacity} T`}
            big
          />
          <Result label="Front / rear difference" value={`${r.frontDifference} + ${r.rearDifference} T`} />
          <Result
            label="Capacity"
            value={
              <span className={"badge " + (r.capacityOk ? "ok" : "danger")}>
                {r.capacityOk ? "OK" : "over"}
              </span>
            }
          />
          <Result
            label="Max sprocket"
            value={
              <span className={"badge " + (r.maxSprocketOk ? "ok" : "danger")}>
                {r.maxSprocketOk ? "OK" : "too big"}
              </span>
            }
          />
        </div>
        <Note>
          Required capacity = (big ring − small ring) + (big cog − small cog). It
          must be ≤ the derailleur's rated capacity, and the largest cog must not
          exceed the derailleur's max sprocket.
        </Note>
      </Section>

      <Section title="Compatibility reference">
        <Note tone="warn">
          Actuation ratios below are approximate and marketing-obscured —{" "}
          <strong>verify before relying on them</strong>. The reliable rule:
          shifter and rear derailleur must share an actuation family, and the
          cassette speed count must match the shifter.
        </Note>
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
