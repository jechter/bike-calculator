import { NumberInput, Select, type SelectOption } from "./ui";
import { EditorPopover, EditorField } from "./EditorPopover";
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
 * The CdA estimator panel. Builds CdA from bike type, position, rider size,
 * wheels and clothing, and writes the estimate live through `onChange`. Bike type
 * comes first because it decides which riding positions are possible. Rider weight
 * comes from the page's rider field.
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

  const note = faired ? (
    <>
      The fairing sets the frontal area, so the shell's drag is essentially fixed —
      wheels, clothing and rider size don't change it.
    </>
  ) : recumbent ? (
    <>
      A recumbent's drag comes mostly from how low and reclined the rider is. Uses
      your rider weight ({Math.round(props.massKg)} kg) from above.
    </>
  ) : (
    <>
      Uses your rider weight ({Math.round(props.massKg)} kg) from above. A rough
      estimate to compare setups — not a substitute for wind-tunnel or field
      testing.
    </>
  );

  return (
    <EditorPopover
      title="Estimate CdA"
      onClose={props.onClose}
      readoutLabel="Estimated CdA"
      readoutValue={`${cda.toFixed(3)} m²`}
      note={note}
    >
      <EditorField label="Bike type">
        <Select
          value={p.bike}
          options={opts(CDA_BIKES)}
          onChange={(v) => set({ bike: v, position: defaultPositionFor(v) })}
        />
      </EditorField>
      <EditorField label="Riding position">
        <Select
          value={p.position}
          options={positionOpts}
          onChange={(v) => set({ position: v as CdaParams["position"] })}
          disabled={positionOpts.length < 2}
        />
      </EditorField>
      <EditorField label="Rider height">
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
      </EditorField>
      <EditorField label="Wheelset">
        <Select
          value={p.wheels}
          options={opts(CDA_WHEELS)}
          onChange={(v) => set({ wheels: v })}
          disabled={faired}
        />
      </EditorField>
      <EditorField label="Clothing" wide>
        <Select
          value={p.clothing}
          options={opts(CDA_CLOTHING)}
          onChange={(v) => set({ clothing: v })}
          disabled={faired}
        />
      </EditorField>
    </EditorPopover>
  );
}
