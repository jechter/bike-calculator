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
import { DERAILLEURS, derailleurById, checkCapacity, pullRatioFor } from "../lib/derailleur";
import { TIRE_PRESETS } from "../lib/wheels";
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

const DERAILLEUR_OPTIONS = [
  { value: "", label: "— none —" },
  ...DERAILLEURS.map((d) => ({
    value: d.id,
    label: `${d.brand} ${d.model} · ${d.speeds}sp · max ${d.maxSprocket}T`,
  })),
];

// --- Per-drivetrain config --------------------------------------------------
// All the state describing one drivetrain, including its wheel's rolling
// circumference (so a comparison can span two different bikes, or the same bike
// with a different wheel/tire). Cadence is shared across configs — it's just the
// axis parameter for the speed visualisation, not part of a drivetrain.

interface ConfigInit {
  mode: Mode;
  chainringStr: string;
  cogStr: string;
  singleRing: number;
  singleCog: number;
  hubIdx: number;
  derailleurId: string;
  circ: number;
}

interface DrivetrainConfig extends ConfigInit {
  setMode: (m: Mode) => void;
  setChainringStr: (s: string) => void;
  setCogStr: (s: string) => void;
  setSingleRing: (n: number) => void;
  setSingleCog: (n: number) => void;
  setHubIdx: (n: number) => void;
  setDerailleurId: (s: string) => void;
  setCirc: (n: number) => void;
}

function useDrivetrainConfig(init: ConfigInit): DrivetrainConfig {
  const [mode, setMode] = useState<Mode>(init.mode);
  const [chainringStr, setChainringStr] = useState(init.chainringStr);
  const [cogStr, setCogStr] = useState(init.cogStr);
  const [singleRing, setSingleRing] = useState(init.singleRing);
  const [singleCog, setSingleCog] = useState(init.singleCog);
  const [hubIdx, setHubIdx] = useState(init.hubIdx);
  const [derailleurId, setDerailleurId] = useState(init.derailleurId);
  const [circ, setCirc] = useState(init.circ);
  return {
    mode,
    chainringStr,
    cogStr,
    singleRing,
    singleCog,
    hubIdx,
    derailleurId,
    circ,
    setMode,
    setChainringStr,
    setCogStr,
    setSingleRing,
    setSingleCog,
    setHubIdx,
    setDerailleurId,
    setCirc,
  };
}

interface Derived {
  chainrings: number[];
  cogs: number[];
  hubGears?: HubGear[];
  gears: GearResult[];
}

function useDerived(cfg: DrivetrainConfig, cadence: number): Derived {
  return useMemo(() => {
    const chainrings = cfg.mode === "cassette" ? parseList(cfg.chainringStr) : [cfg.singleRing];
    const cogs = cfg.mode === "cassette" ? parseList(cfg.cogStr) : [cfg.singleCog];
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

// The mode + chainring/cog/hub inputs for one config (the shared rolling
// circumference lives outside, on its own row).
function SetupFields({ cfg }: { cfg: DrivetrainConfig }) {
  return (
    <div className="grid">
      <Field label="Drivetrain type">
        <Select<Mode>
          value={cfg.mode}
          onChange={cfg.setMode}
          options={[
            { value: "cassette", label: "Derailleur (cassette)" },
            { value: "single", label: "Single speed / fixed" },
            { value: "hub", label: "Internally geared hub" },
          ]}
        />
      </Field>

      {cfg.mode === "cassette" && (
        <>
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
          <Field label="Cassette cogs" hint="comma-separated tooth counts">
            <div className="combo">
              <TextInput value={cfg.cogStr} onChange={cfg.setCogStr} />
              <PresetMenu
                title="Fill from a cassette preset"
                options={CASSETTE_OPTIONS}
                onPick={cfg.setCogStr}
              />
            </div>
          </Field>
        </>
      )}

      {cfg.mode === "single" && (
        <>
          <Field label="Chainring (teeth)">
            <NumberInput value={cfg.singleRing} onChange={cfg.setSingleRing} min={20} />
          </Field>
          <Field label="Cog (teeth)">
            <NumberInput value={cfg.singleCog} onChange={cfg.setSingleCog} min={8} />
          </Field>
        </>
      )}

      {cfg.mode === "hub" && (
        <>
          <Field label="Chainring (teeth)">
            <NumberInput value={cfg.singleRing} onChange={cfg.setSingleRing} min={20} />
          </Field>
          <Field label="Sprocket (teeth)">
            <NumberInput value={cfg.singleCog} onChange={cfg.setSingleCog} min={8} />
          </Field>
          <Field label="Hub" hint="internal ratios — verify against maker's data">
            <Select
              value={String(cfg.hubIdx)}
              onChange={(v) => cfg.setHubIdx(parseInt(v))}
              options={HUB_PRESETS.map((p, i) => ({ value: String(i), label: p.label }))}
            />
          </Field>
        </>
      )}
    </div>
  );
}

// Rolling circumference lives per-config (each config is a bike/wheel), on its
// own row for a stable layout, with a tire-size preset and a link to the Tire
// calculator.
function CircumferenceField({ cfg }: { cfg: DrivetrainConfig }) {
  return (
    <div className="rows">
      <Field
        label="Rolling circumference (mm)"
        hint={
          <>
            measured roll-out is most accurate ·{" "}
            <a className="inline-link" href="#/tire">
              open the Tire calculator for sizes &amp; conversion →
            </a>
          </>
        }
      >
        <div className="combo">
          <NumberInput value={cfg.circ} onChange={cfg.setCirc} min={800} />
          <PresetMenu
            title="Fill from a tire size (ETRTO)"
            options={TIRE_OPTIONS}
            onPick={(v) => cfg.setCirc(parseFloat(v))}
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
    singleRing: 42,
    singleCog: 18,
    hubIdx: 0,
    derailleurId: "",
    circ: 2111,
  });
  const configB = useDrivetrainConfig({
    mode: "cassette",
    chainringStr: "46, 30",
    cogStr: "11, 13, 15, 17, 19, 21, 24, 28, 32, 37, 42",
    singleRing: 42,
    singleCog: 18,
    hubIdx: 0,
    derailleurId: "",
    circ: 2111,
  });

  // Shared across both configs — cadence is just the speed-axis parameter.
  const [cadence, setCadence] = useState(90);
  const [chainstay, setChainstay] = useState(410);
  const [metric, setMetric] = useState<Metric>("speed");

  const [comparing, setComparing] = useState(false);
  // Which config the per-drivetrain detail sections (diagram, chain length,
  // derailleur fit, chain wear) describe. Only meaningful while comparing.
  const [focus, setFocus] = useState<"A" | "B">("A");
  const [activeGear, setActiveGear] = useState<{ chainring: number; cog: number } | null>(null);

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
  const wearThresholds = chainWearThresholdsFor(focusCfg.mode === "cassette", cogs.length);

  // Rear-derailleur fit check (cassette only), for the focused config.
  const derailleur = derailleurById(focusCfg.derailleurId);
  const fit =
    derailleur && chainrings.length && cogs.length
      ? checkCapacity({
          largestChainring: largestRing,
          smallestChainring: Math.min(...chainrings),
          largestCog,
          smallestCog: Math.min(...cogs),
          ratedCapacity: derailleur.totalCapacity,
          maxSprocket: derailleur.maxSprocket,
        })
      : null;

  // Both checks are tri-state: a little over spec often still works (a big cog
  // with a long hanger / extra B-tension; a little extra capacity only shows as
  // slack in the small-small gear you'd avoid anyway).
  type FitStatus = "ok" | "caution" | "over";
  const cogOver = derailleur ? largestCog - derailleur.maxSprocket : 0;
  const cogStatus: FitStatus = cogOver <= 0 ? "ok" : cogOver <= 4 ? "caution" : "over";
  const capOver = fit && derailleur ? fit.requiredCapacity - derailleur.totalCapacity : 0;
  const capStatus: FitStatus = capOver <= 0 ? "ok" : capOver <= 4 ? "caution" : "over";
  const worst: FitStatus = [cogStatus, capStatus].includes("over")
    ? "over"
    : [cogStatus, capStatus].includes("caution")
      ? "caution"
      : "ok";

  const fitTone: "info" | "warn" = worst === "ok" ? "info" : "warn";
  let fitMessage = "";
  if (fit && derailleur) {
    if (worst === "ok") {
      fitMessage = `${derailleur.brand} ${derailleur.model} should handle this drivetrain (rated ${derailleur.totalCapacity}T capacity, ${derailleur.maxSprocket}T max cog).`;
    } else {
      const issues: string[] = [];
      if (cogStatus !== "ok")
        issues.push(`largest cog ${cogOver}T over the ${derailleur.maxSprocket}T max`);
      if (capStatus !== "ok")
        issues.push(`capacity ${capOver}T over the ${derailleur.totalCapacity}T rating`);
      const joined = issues.join("; ");
      fitMessage =
        worst === "caution"
          ? `Slightly out of spec — ${joined}. It may still work (a long hanger / extra B-tension, and avoiding the extreme cross-chain gears, can help) — look closely and proceed with caution.`
          : `Out of range — ${joined}. This is beyond what ${derailleur.brand} ${derailleur.model} is designed for.`;
    }
  }

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
  const series: GearSeries[] = comparing
    ? [
        { id: "A", gears: derivedA.gears, isCrossChained: crossA },
        { id: "B", gears: derivedB.gears, hollow: true, isCrossChained: crossB },
      ]
    : [{ id: "A", gears: derivedA.gears, isCrossChained: crossA }];

  // Active gear for the drivetrain diagram (default to a middle cog until
  // hovered). Only hovers on the focused config move the diagram.
  const defaultCog = cogs.length ? cogs[Math.floor(cogs.length / 2)] : 0;
  const activeChainring =
    activeGear && chainrings.includes(activeGear.chainring) ? activeGear.chainring : chainrings[0] ?? 0;
  const activeCog = activeGear && cogs.includes(activeGear.cog) ? activeGear.cog : defaultCog;
  const activeSpeedKmh =
    activeCog > 0
      ? ((activeChainring / activeCog) * (focusCfg.circ / 1000) * (cadence || 90) * 60) / 1000
      : 0;

  const focusLabel = focus === "B" ? "Drivetrain B" : "Drivetrain A";

  return (
    <>
      <Section
        title="Setup"
        action={
          <button
            type="button"
            className="dt-compare-toggle"
            onClick={() => setComparing((c) => !c)}
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
            One line per chainring; each dot is a {focusCfg.mode === "hub" ? "hub gear" : "cog"}{" "}
            (labelled with its {focusCfg.mode === "hub" ? "gear" : "tooth count"}) — hover a dot
            for its exact values.{" "}
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
                value={`${derivedA.gears.length} · ${rangeA.toFixed(2)}× (${Math.round((rangeA - 1) * 100)}%)`}
              />
              <Result
                label="B: gears / range"
                value={`${derivedB.gears.length} · ${rangeB.toFixed(2)}× (${Math.round((rangeB - 1) * 100)}%)`}
              />
            </>
          ) : (
            <>
              <Result label="Gears" value={derivedA.gears.length} />
              <Result
                label="Range"
                value={`${rangeA.toFixed(2)}× (${Math.round((rangeA - 1) * 100)}%)`}
              />
            </>
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
          onHover={(g, seriesId) => {
            // Hovering a gear selects it in the diagram; if it belongs to the
            // other drivetrain, switch the diagram (and detail sections) to it.
            if (comparing && (seriesId === "A" || seriesId === "B")) setFocus(seriesId);
            setActiveGear({ chainring: g.chainring, cog: g.cog });
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
          hasDerailleur={focusCfg.mode === "cassette"}
          cadenceRpm={rpm}
          speed={toSpeed(activeSpeedKmh)}
          speedUnit={unitLabel}
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

      {focusCfg.mode === "cassette" && (
        <Section
          title={comparing ? `Rear derailleur fit · ${focusLabel}` : "Rear derailleur fit"}
          info={
            <>
              Pick a derailleur to check it against this cassette/crankset. Needs
              capacity ≥ (big ring − small ring) + (big cog − small cog), and its
              max sprocket ≥ your largest cog. Specs are approximate — see the{" "}
              <a className="inline-link" href="#/derailleur">
                derailleur database
              </a>
              .
            </>
          }
        >
          <div className="rows">
            <Field label="Rear derailleur (optional)">
              <Select
                value={focusCfg.derailleurId}
                onChange={focusCfg.setDerailleurId}
                options={DERAILLEUR_OPTIONS}
              />
            </Field>
          </div>
          {fit && derailleur && (
            <>
              <div className="results" style={{ marginTop: 8 }}>
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
                            : `over ${derailleur.maxSprocket}T`}
                      </span>
                    </>
                  }
                />
                <Result
                  label="Capacity needed"
                  value={
                    <>
                      {fit.requiredCapacity}T{" "}
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
                            : `over ${derailleur.totalCapacity}T`}
                      </span>
                    </>
                  }
                />
                <Result label="Actuation" value={`${derailleur.actuation}`} />
                <Result label="Pull ratio" value={pullRatioFor(derailleur)} />
              </div>
              <Note tone={fitTone}>{fitMessage}</Note>
            </>
          )}
        </Section>
      )}

      <Section
        title={comparing ? `Chain length · ${focusLabel}` : "Chain length"}
        info={
          focusCfg.mode === "cassette" ? (
            <>
              Park Tool formula, rounded up so the link count is even (each link ≈
              12.7 mm). It includes the +1 inch wrap for the rear derailleur. The
              big-big wrap method is more reliable for wide 1× and full-suspension.
            </>
          ) : undefined
        }
      >
        {focusCfg.mode === "cassette" ? (
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
            {focusCfg.mode === "cassette"
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
