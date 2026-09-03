import { useMemo, useState } from "react";
import {
  CASSETTE_PRESETS,
  HUB_PRESETS,
  computeGears,
  gearRange,
  chainLength,
  chainWear,
  type HubGear,
} from "../lib/drivetrain";
import { TIRE_PRESETS } from "../lib/wheels";
import { kmhToMph } from "../lib/units";
import { Field, NumberInput, TextInput, Select, Result, Note, Section } from "./ui";

type Mode = "cassette" | "single" | "hub";

function parseList(s: string): number[] {
  return s
    .split(/[\s,]+/)
    .map((x) => parseFloat(x))
    .filter((x) => Number.isFinite(x) && x > 0);
}

export function Drivetrain() {
  const [mode, setMode] = useState<Mode>("cassette");
  const [chainringStr, setChainringStr] = useState("50, 34");
  const [cogStr, setCogStr] = useState("11, 12, 13, 14, 15, 17, 19, 21, 24, 28");
  const [singleRing, setSingleRing] = useState(42);
  const [singleCog, setSingleCog] = useState(18);
  const [hubIdx, setHubIdx] = useState(0);
  const [circ, setCirc] = useState(2111);
  const [cadence, setCadence] = useState(90);
  const [crank, setCrank] = useState(170);
  const [showMph, setShowMph] = useState(false);

  // chain length
  const [chainstay, setChainstay] = useState(410);
  // chain wear
  const [wearLinks, setWearLinks] = useState(12);
  const [wearMm, setWearMm] = useState(304.8);

  const chainrings = mode === "cassette" ? parseList(chainringStr) : [singleRing];
  const cogs = mode === "cassette" ? parseList(cogStr) : [singleCog];
  const hubGears: HubGear[] | undefined =
    mode === "hub" ? HUB_PRESETS[hubIdx].gears : undefined;

  const gears = useMemo(
    () =>
      computeGears({
        chainrings,
        cogs,
        circumferenceMm: circ,
        cadenceRpm: cadence,
        crankLengthMm: crank,
        hubGears,
      }),
    [chainringStr, cogStr, singleRing, singleCog, mode, hubIdx, circ, cadence, crank],
  );

  const range = gearRange(gears);
  const speed = (kmh: number) => (showMph ? kmhToMph(kmh) : kmh);
  const speedUnit = showMph ? "mph" : "km/h";

  const largestRing = Math.max(...chainrings, 0);
  const largestCog = Math.max(...cogs, 0);
  const chain = chainLength({ chainstayMm: chainstay, largestChainring: largestRing, largestCog });
  const wear = chainWear({ measuredMm: wearMm, links: wearLinks });

  return (
    <>
      <Section title="Setup">
        <div className="grid">
          <Field label="Drivetrain type">
            <Select<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: "cassette", label: "Derailleur (cassette)" },
                { value: "single", label: "Single speed / fixed" },
                { value: "hub", label: "Internally geared hub" },
              ]}
            />
          </Field>

          {mode === "cassette" && (
            <>
              <Field label="Chainrings" hint="comma-separated tooth counts">
                <TextInput value={chainringStr} onChange={setChainringStr} />
              </Field>
              <Field label="Cassette cogs" hint="comma-separated tooth counts">
                <TextInput value={cogStr} onChange={setCogStr} />
              </Field>
              <Field label="Cassette preset">
                <Select
                  value=""
                  onChange={(v) => {
                    const p = CASSETTE_PRESETS.find((x) => x.label === v);
                    if (p) setCogStr(p.cogs.join(", "));
                  }}
                  options={[
                    { value: "", label: "— pick —" },
                    ...CASSETTE_PRESETS.map((p) => ({ value: p.label, label: p.label })),
                  ]}
                />
              </Field>
            </>
          )}

          {mode === "single" && (
            <>
              <Field label="Chainring (teeth)">
                <NumberInput value={singleRing} onChange={setSingleRing} min={20} />
              </Field>
              <Field label="Cog (teeth)">
                <NumberInput value={singleCog} onChange={setSingleCog} min={8} />
              </Field>
            </>
          )}

          {mode === "hub" && (
            <>
              <Field label="Chainring (teeth)">
                <NumberInput value={singleRing} onChange={setSingleRing} min={20} />
              </Field>
              <Field label="Sprocket (teeth)">
                <NumberInput value={singleCog} onChange={setSingleCog} min={8} />
              </Field>
              <Field label="Hub" hint="internal ratios — verify against maker's data">
                <Select
                  value={String(hubIdx)}
                  onChange={(v) => setHubIdx(parseInt(v))}
                  options={HUB_PRESETS.map((p, i) => ({ value: String(i), label: p.label }))}
                />
              </Field>
            </>
          )}

          <Field label="Wheel / tyre">
            <Select
              value={String(circ)}
              onChange={(v) => setCirc(parseFloat(v))}
              options={TIRE_PRESETS.map((p) => ({
                value: String(p.circumferenceMm),
                label: `${p.label} (${p.circumferenceMm} mm)`,
              }))}
            />
          </Field>
          <Field label="Rolling circumference" hint="measured roll-out is most accurate">
            <NumberInput value={circ} onChange={setCirc} suffix="mm" min={800} />
          </Field>
          <Field label="Cadence">
            <NumberInput value={cadence} onChange={setCadence} suffix="rpm" min={30} max={150} />
          </Field>
          <Field label="Crank length" hint="for gain ratio">
            <NumberInput value={crank} onChange={setCrank} suffix="mm" min={100} max={220} />
          </Field>
        </div>
      </Section>

      <Section title="Gears">
        <div className="results" style={{ marginBottom: 14 }}>
          <Result label="Gears" value={gears.length} />
          <Result label="Gear range" value={`${range.toFixed(2)}× (${Math.round((range - 1) * 100)}%)`} />
          <Result
            label="Speed units"
            value={
              <button className="chip" onClick={() => setShowMph((v) => !v)}>
                {speedUnit} — switch
              </button>
            }
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ring</th>
                <th>Cog</th>
                {mode === "hub" && <th>Hub</th>}
                <th className="num">Ratio</th>
                <th className="num">Gear in.</th>
                <th className="num">Dev (m)</th>
                <th className="num">Gain</th>
                <th className="num">Speed ({speedUnit})</th>
              </tr>
            </thead>
            <tbody>
              {gears.map((g, i) => (
                <tr key={i}>
                  <td>{g.chainring}</td>
                  <td>{g.cog}</td>
                  {mode === "hub" && <td>{g.hubGear?.name}</td>}
                  <td className="num">{g.ratio.toFixed(2)}</td>
                  <td className="num">{g.gearInches.toFixed(1)}</td>
                  <td className="num">{g.developmentM.toFixed(2)}</td>
                  <td className="num">{g.gainRatio.toFixed(2)}</td>
                  <td className="num">{speed(g.speedKmh).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Chain length">
        <div className="grid">
          <Field label="Chainstay length">
            <NumberInput value={chainstay} onChange={setChainstay} suffix="mm" min={350} max={500} />
          </Field>
          <Result label="Largest ring / cog" value={`${largestRing} / ${largestCog} T`} />
          <Result label="Length" value={`${chain.inches} in`} />
          <Result label="Links" value={chain.links} big />
        </div>
        <Note>
          Park Tool formula, rounded up to a whole inch (each inch = 2 links). The
          big-big wrap method is more reliable for wide 1× and full-suspension —
          see the drivetrain doc.
        </Note>
      </Section>

      <Section title="Chain wear">
        <div className="grid">
          <Field label="Measured over (links)" hint="12 links = 12 in nominal">
            <NumberInput value={wearLinks} onChange={setWearLinks} min={1} />
          </Field>
          <Field label="Measured length">
            <NumberInput value={wearMm} onChange={setWearMm} suffix="mm" min={1} />
          </Field>
          <Result label="Elongation" value={`${wear.elongationPercent.toFixed(2)} %`} big />
          <Result
            label="Verdict"
            value={
              <span
                className={
                  "badge " +
                  (wear.verdict === "ok" ? "ok" : wear.verdict === "replace-soon" ? "warn" : "danger")
                }
              >
                {wear.verdict.replace("-", " ")}
              </span>
            }
          />
        </div>
        <Note tone={wear.verdict === "ok" ? "info" : "warn"}>{wear.message}</Note>
      </Section>
    </>
  );
}
