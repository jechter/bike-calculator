import { NumberInput, Select, type SelectOption } from "./ui";
import { EditorPopover, EditorField } from "./EditorPopover";
import {
  CDA_POSITIONS,
  CDA_BIKES,
  CDA_WHEELS,
  CDA_CLOTHING,
  CDA_FORMATIONS,
  DRAFT_RIDERS_MAX,
  GROUP_SIZE_MAX,
  isDrafting,
  isRotating,
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
 * comes from the page's rider field. Drafting (a fixed spot behind N riders, or
 * rotating through a group of N) scales the solo estimate down last.
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
  const drafting = isDrafting(p);
  const rotating = isRotating(p.formation);
  const solo = drafting
    ? estimateCda({ ...p, formation: "line", draftRiders: 0 }, props.massKg)
    : cda;
  const saving = drafting ? Math.round((1 - cda / solo) * 100) : 0;
  const faired = isFaired(p.bike);
  const recumbent = p.bike === "recumbent";

  // Positions available for the chosen bike (first is its default).
  const positionOpts: SelectOption<string>[] = bikeByValue(p.bike).positions.map(
    (v) => ({ value: v, label: CDA_POSITIONS[v].label }),
  );

  const draftNote = drafting && rotating && (
    <>
      {" "}Rotating: averaged over a full rotation, including your turns on the
      front, so it saves less than sitting in. The saving grows with group size.
    </>
  );

  const note = faired ? (
    <>
      The fairing sets the frontal area, so the shell's drag is essentially fixed —
      wheels, clothing and rider size don't change it.{draftNote}
    </>
  ) : recumbent ? (
    <>
      A recumbent's drag comes mostly from how low and reclined the rider is. Uses
      your rider weight ({Math.round(props.massKg)} kg) from above.{draftNote}
    </>
  ) : (
    <>
      Uses your rider weight ({Math.round(props.massKg)} kg) from above. A rough
      estimate to compare setups — not a substitute for wind-tunnel or field
      testing.{draftNote}
    </>
  );

  return (
    <EditorPopover
      title="Estimate CdA"
      className="cda-pop"
      onClose={props.onClose}
      readoutLabel="Estimated CdA"
      readoutValue={
        drafting
          ? `${cda.toFixed(3)} m² (solo ${solo.toFixed(3)}, −${saving} %)`
          : `${cda.toFixed(3)} m²`
      }
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
      {/* Formation and its rider count share one row: a wide menu, narrow count. */}
      <div className="editor-field-wide cda-draft-row">
        <EditorField label="Drafting formation">
          <Select
            value={p.formation}
            options={opts(CDA_FORMATIONS)}
            onChange={(v) => set({ formation: v })}
          />
        </EditorField>
        {rotating ? (
          <EditorField label="Riders in group">
            <div className="combo">
              <NumberInput
                value={p.groupSize}
                onChange={(v) => set({ groupSize: Math.round(v) })}
                min={1}
                max={GROUP_SIZE_MAX}
                step={1}
              />
            </div>
          </EditorField>
        ) : (
          <EditorField label="Riders ahead">
            <div className="combo">
              <NumberInput
                value={p.draftRiders}
                onChange={(v) => set({ draftRiders: Math.round(v) })}
                min={0}
                max={DRAFT_RIDERS_MAX}
                step={1}
              />
            </div>
          </EditorField>
        )}
      </div>
    </EditorPopover>
  );
}
