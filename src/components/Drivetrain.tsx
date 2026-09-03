import { useMemo, useState } from "react";
import {
  CASSETTE_PRESETS,
  CHAINRING_PRESETS,
  HUB_PRESETS,
  chainWearThresholdFor,
  computeGears,
  gearRange,
  chainLength,
  type HubGear,
} from "../lib/drivetrain";
import { TIRE_PRESETS } from "../lib/wheels";
import { kmhToMph } from "../lib/units";
import { Field, NumberInput, TextInput, Select, PresetMenu, Result, Note, Section } from "./ui";

type Mode = "cassette" | "single" | "hub";

function parseList(s: string): number[] {
  return s
    .split(/[\s,]+/)
    .map((x) => parseFloat(x))
    .filter((x) => Number.isFinite(x) && x > 0);
}

// ETRTO-labelled options that fill the rolling circumference field.
const TIRE_OPTIONS = TIRE_PRESETS.map((p) => ({
  value: String(p.circumferenceMm),
  label: `${p.widthMm}-${p.iso}  (${p.label})`,
}));

const CASSETTE_OPTIONS = CASSETTE_PRESETS.map((p) => ({
  value: p.cogs.join(", "),
  label: p.label,
}));

const CRANKSET_OPTIONS = CHAINRING_PRESETS.map((p) => ({
  value: p.rings.join(", "),
  label: p.label,
}));

export function Drivetrain() {
  const [mode, setMode] = useState<Mode>("cassette");
  const [chainringStr, setChainringStr] = useState("50, 34");
  const [cogStr, setCogStr] = useState("11, 12, 13, 14, 15, 17, 19, 21, 24, 28");
  const [singleRing, setSingleRing] = useState(42);
  const [singleCog, setSingleCog] = useState(18);
  const [hubIdx, setHubIdx] = useState(0);
  const [circ, setCirc] = useState(2111);
  const [cadence, setCadence] = useState(90);
  const [showMph, setShowMph] = useState(false);

  const [chainstay, setChainstay] = useState(410);

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
        hubGears,
      }),
    [chainringStr, cogStr, singleRing, singleCog, mode, hubIdx, circ, cadence],
  );

  const range = gearRange(gears);
  const speed = (kmh: number) => (showMph ? kmhToMph(kmh) : kmh);
  const speedUnit = showMph ? "mph" : "km/h";

  const largestRing = Math.max(...chainrings, 0);
  const largestCog = Math.max(...cogs, 0);
  const chain = chainLength({ chainstayMm: chainstay, largestChainring: largestRing, largestCog });
  const wearThreshold = chainWearThresholdFor(mode === "cassette", cogs.length);

  const sliderCadence = Math.min(120, Math.max(60, cadence || 60));

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
                <div className="input-with-preset">
                  <TextInput value={chainringStr} onChange={setChainringStr} />
                  <PresetMenu
                    title="Fill from a common crankset"
                    options={CRANKSET_OPTIONS}
                    onPick={setChainringStr}
                  />
                </div>
              </Field>
              <Field label="Cassette cogs" hint="comma-separated tooth counts">
                <div className="input-with-preset">
                  <TextInput value={cogStr} onChange={setCogStr} />
                  <PresetMenu
                    title="Fill from a cassette preset"
                    options={CASSETTE_OPTIONS}
                    onPick={setCogStr}
                  />
                </div>
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
        </div>

        {/* Wheel / cadence always on their own rows for a stable layout. */}
        <div className="rows">
          <Field
            label="Rolling circumference"
            hint={
              <>
                measured roll-out is most accurate ·{" "}
                <a className="inline-link" href="#/tire">
                  open the Tyre calculator for sizes &amp; conversion →
                </a>
              </>
            }
          >
            <div className="input-with-preset">
              <NumberInput value={circ} onChange={setCirc} suffix="mm" min={800} />
              <PresetMenu
                title="Fill from a tyre size (ETRTO)"
                options={TIRE_OPTIONS}
                onPick={(v) => setCirc(parseFloat(v))}
              />
            </div>
          </Field>

          <Field label="Cadence" hint="slider 60–120 rpm; type any value">
            <div className="slider-row">
              <input
                type="range"
                min={60}
                max={120}
                step={1}
                value={sliderCadence}
                onChange={(e) => setCadence(parseInt(e.target.value))}
              />
              <NumberInput value={cadence} onChange={setCadence} suffix="rpm" min={20} max={200} />
            </div>
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
                  <td className="num">{speed(g.speedKmh).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Chain length">
        {mode === "cassette" ? (
          <>
            <div className="grid">
              <Field label="Chainstay length">
                <NumberInput value={chainstay} onChange={setChainstay} suffix="mm" min={350} max={500} />
              </Field>
              <Result label="Largest ring / cog" value={`${largestRing} / ${largestCog} T`} />
              <Result label="Length" value={`${chain.mm} mm`} />
              <Result label="Links" value={chain.links} big />
            </div>
            <Note>
              Park Tool formula, rounded up so the link count is even (each link ≈
              12.7 mm). It includes the +1 inch wrap for the rear derailleur. The
              big-big wrap method is more reliable for wide 1× and full-suspension.
            </Note>
          </>
        ) : (
          <Note>
            {mode === "hub" ? "Hub-geared" : "Single-speed"} chains aren't sized
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

      <Section title="Chain wear — when to replace">
        <div className="results">
          <Result label="Your chain type" value={wearThreshold.chainType} />
          <Result label="Replace at" value={`${wearThreshold.replaceAtPercent.toFixed(2)}%`} big />
        </div>
        <Note>
          Measured at the bench with a chain-wear gauge. Shown for your current
          drivetrain{mode === "cassette" ? ` (${cogs.length}-speed)` : ""}.
          Narrower chains wear the cassette faster, so they get replaced earlier;
          past the threshold the cassette may skip with a new chain.
        </Note>
      </Section>
    </>
  );
}
