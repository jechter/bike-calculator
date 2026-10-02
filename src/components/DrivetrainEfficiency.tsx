import { Select, type SelectOption } from "./ui";
import { EditorPopover, EditorField } from "./EditorPopover";
import {
  DRIVETRAIN_PRESETS,
  GEARING_PRESETS,
  combinedEfficiency,
  type EfficiencyParams,
} from "../lib/power";

const DRIVETRAIN_OPTS: SelectOption<string>[] = DRIVETRAIN_PRESETS.map((o) => ({
  value: o.id,
  label: `${o.label} (${o.eff})`,
}));
const GEARING_OPTS: SelectOption<string>[] = GEARING_PRESETS.map((o) => ({
  value: o.id,
  label: `${o.label} (${o.eff})`,
}));

/**
 * Editor for overall drivetrain efficiency: pick the chain/belt condition and the
 * gearing type, which multiply into η. Writes the combined value live via
 * `onChange`; the parent field also stays directly type-able for a custom η.
 */
export function DrivetrainEfficiencyPanel(props: {
  params: EfficiencyParams;
  onChange: (p: EfficiencyParams) => void;
  onClose: () => void;
}) {
  const p = props.params;
  const eff = combinedEfficiency(p);
  return (
    <EditorPopover
      title="Drivetrain efficiency"
      onClose={props.onClose}
      readoutLabel="Overall efficiency"
      readoutValue={`η ≈ ${eff.toFixed(2)}`}
      note={
        <>
          Chain/belt friction × gear-mechanism losses. Figures follow gearbox/hub
          efficiency testing — see{" "}
          <a
            className="inline-link"
            href="https://www.cyclingabout.com/speed-difference-testing-gearbox-systems/"
            target="_blank"
            rel="noreferrer"
          >
            cyclingabout.com
          </a>
          .
        </>
      }
    >
      <EditorField label="Drivetrain (chain / belt)" wide>
        <Select
          value={p.drivetrain}
          options={DRIVETRAIN_OPTS}
          onChange={(v) => props.onChange({ ...p, drivetrain: v })}
        />
      </EditorField>
      <EditorField label="Gearing" wide>
        <Select
          value={p.gearing}
          options={GEARING_OPTS}
          onChange={(v) => props.onChange({ ...p, gearing: v })}
        />
      </EditorField>
    </EditorPopover>
  );
}
