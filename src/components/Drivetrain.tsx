import { useMemo, useState } from "react";
import {
  CASSETTE_PRESETS,
  CHAINRING_PRESETS,
  HUB_PRESETS,
  chainWearThresholdsFor,
  computeGears,
  gearRange,
  chainLength,
  type GearResult,
  type HubGear,
} from "../lib/drivetrain";
import { TIRE_PRESETS } from "../lib/wheels";
import { kmhToMph } from "../lib/units";
import { Field, NumberInput, TextInput, Select, PresetMenu, Result, Note, Section } from "./ui";
import { GearChart } from "./GearChart";

type Mode = "cassette" | "single" | "hub";
type Metric = "speed" | "gearInches" | "development" | "ratio";

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
  const [metric, setMetric] = useState<Metric>("speed");

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
  const wearThresholds = chainWearThresholdsFor(mode === "cassette", cogs.length);

  const sliderCadence = Math.min(120, Math.max(60, cadence || 60));

  // Axis definitions for the gear chart.
  const metricDefs: Record<
    Metric,
    { label: string; value: (g: GearResult) => number; format: (v: number) => string }
  > = {
    speed: {
      label: `Speed (${speedUnit})`,
      value: (g) => speed(g.speedKmh),
      format: (v) => v.toFixed(1),
    },
    gearInches: { label: "Gear inches", value: (g) => g.gearInches, format: (v) => v.toFixed(0) },
    development: {
      label: "Development (m)",
      value: (g) => g.developmentM,
      format: (v) => v.toFixed(2),
    },
    ratio: { label: "Gear ratio", value: (g) => g.ratio, format: (v) => v.toFixed(2) },
  };
  const activeMetric = metricDefs[metric];
  const pointLabel = (g: GearResult) => (g.hubGear ? g.hubGear.name : String(g.cog));

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
        <div className="chart-controls">
          <Field label="Show gears by">
            <Select<Metric>
              value={metric}
              onChange={setMetric}
              options={[
                { value: "speed", label: `Speed at ${cadence || 90} rpm` },
                { value: "gearInches", label: "Gear inches" },
                { value: "development", label: "Development (m)" },
                { value: "ratio", label: "Gear ratio" },
              ]}
            />
          </Field>
          {metric === "speed" && (
            <button className="chip" onClick={() => setShowMph((v) => !v)}>
              {speedUnit} — switch to {showMph ? "km/h" : "mph"}
            </button>
          )}
          <Result label="Gears" value={gears.length} />
          <Result label="Range" value={`${range.toFixed(2)}× (${Math.round((range - 1) * 100)}%)`} />
        </div>

        <GearChart
          gears={gears}
          value={activeMetric.value}
          format={activeMetric.format}
          axisLabel={activeMetric.label}
          pointLabel={pointLabel}
        />

        <Note>
          One line per chainring; each dot is a {mode === "hub" ? "hub gear" : "cog"}{" "}
          (labelled with its {mode === "hub" ? "gear" : "tooth count"}), hover for
          detail. <strong>Gear inches</strong> = the drive-wheel diameter (in) of an
          equivalent direct-drive high-wheeler — a wheel-size-independent way to
          compare gears; bigger = taller/harder. <strong>Development</strong> is
          metres travelled per pedal revolution.
        </Note>
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
        <Note>
          Measured at the bench with a chain-wear gauge.{" "}
          {mode === "cassette"
            ? `Shown for your ${cogs.length}-speed cassette.`
            : "Single-speed and hub bikes can run a narrow 3/32\" or wide 1/8\" chain — pick the row matching your chain."}{" "}
          Past the threshold the cassette (and possibly chainrings) may skip with a
          new chain.
        </Note>
      </Section>
    </>
  );
}
