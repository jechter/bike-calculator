import { NumberInput, Select, type SelectOption } from "./ui";
import {
  CDA_POSITIONS,
  CDA_BIKES,
  CDA_WHEELS,
  CDA_CLOTHING,
  estimateCda,
  bikeByValue,
  defaultPositionFor,
  isFaired,
  type CdaParams,
} from "../lib/cda";

// Map one of the cda.ts preset tables into the Select's {value,label} options.
function opts<T extends string>(
  table: ReadonlyArray<{ value: T; label: string }>,
): SelectOption<T>[] {
  return table.map((o) => ({ value: o.value, label: o.label }));
}

/**
 * The CdA estimator panel (the `.cp-pop` foldout idiom). It builds CdA from a
 * richer set of factors — bike type, position, rider size, wheels, clothing — and
 * writes the estimate live through `onChange`, so the power results update as you
 * play with the knobs. Bike type comes first because it decides which riding
 * positions are possible. Rider weight comes from the page's rider field.
 *
 * Open/close (and outside-click dismissal) is owned by the parent, which wraps
 * the trigger button and this panel in one anchor.
 */
export function CdaAdvancedPanel(props: {
  params: CdaParams;
  massKg: number;
  onChange: (p: CdaParams) => void;
  onClose: () => void;
}) {
  const p = props.params;
  const set = (patch: Partial<CdaParams>) => props.onChange({ ...p, ...patch });
  const cda = estimateCda(p, props.massKg);
  const faired = isFaired(p.bike);
  const recumbent = p.bike === "recumbent";

  // Positions available for the chosen bike (first is its default).
  const positionOpts: SelectOption<string>[] = bikeByValue(p.bike).positions.map(
    (v) => ({ value: v, label: CDA_POSITIONS[v].label }),
  );

  return (
    <div className="cp-pop cda-pop">
      <div className="cda-pop-head">
        <strong>Estimate CdA</strong>
        <button
          type="button"
          className="cda-pop-close"
          onClick={props.onClose}
          aria-label="Close estimator"
        >
          ×
        </button>
      </div>

      <div className="cda-pop-grid">
        <label className="cda-field">
          <span>Bike type</span>
          <Select
            value={p.bike}
            options={opts(CDA_BIKES)}
            onChange={(v) =>
              // Switching bike may invalidate the current position, so reset it.
              set({ bike: v, position: defaultPositionFor(v) })
            }
          />
        </label>
        <label className="cda-field">
          <span>Riding position</span>
          <Select
            value={p.position}
            options={positionOpts}
            onChange={(v) => set({ position: v as CdaParams["position"] })}
            disabled={positionOpts.length < 2}
          />
        </label>
        <label className="cda-field">
          <span>Rider height</span>
          <div className={"combo" + (faired ? " combo-disabled" : "")}>
            <NumberInput
              value={p.heightCm}
              onChange={(v) => set({ heightCm: v })}
              suffix="cm"
              min={120}
              max={210}
              step={1}
              disabled={faired}
            />
          </div>
        </label>
        <label className="cda-field">
          <span>Wheelset</span>
          <Select
            value={p.wheels}
            options={opts(CDA_WHEELS)}
            onChange={(v) => set({ wheels: v })}
            disabled={faired}
          />
        </label>
        <label className="cda-field cda-field-wide">
          <span>Clothing</span>
          <Select
            value={p.clothing}
            options={opts(CDA_CLOTHING)}
            onChange={(v) => set({ clothing: v })}
            disabled={faired}
          />
        </label>
      </div>

      <div className="cda-pop-out">
        <span>Estimated CdA</span>
        <strong>{cda.toFixed(3)} m²</strong>
      </div>
      {faired ? (
        <p className="cda-pop-note">
          The fairing sets the frontal area, so the shell's drag is essentially
          fixed — wheels, clothing and rider size don't change it.
        </p>
      ) : recumbent ? (
        <p className="cda-pop-note">
          A recumbent's drag comes mostly from how low and reclined the rider is.
          Uses your rider weight ({Math.round(props.massKg)} kg) from above.
        </p>
      ) : (
        <p className="cda-pop-note">
          Uses your rider weight ({Math.round(props.massKg)} kg) from above. A rough
          estimate to compare setups — not a substitute for wind-tunnel or field
          testing.
        </p>
      )}
    </div>
  );
}
