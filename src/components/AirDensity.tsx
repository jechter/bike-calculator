import { NumberInput } from "./ui";
import { EditorPopover, EditorField } from "./EditorPopover";
import {
  airDensity,
  TEMP_MIN_C,
  TEMP_MAX_C,
  ALT_MIN_M,
  ALT_MAX_M,
  type AirParams,
} from "../lib/airDensity";

/**
 * Editor for air density ρ from temperature and altitude. Writes the computed ρ
 * live via `onChange`; the parent field also stays directly type-able.
 */
export function AirDensityPanel(props: {
  params: AirParams;
  onChange: (p: AirParams) => void;
  onClose: () => void;
}) {
  const p = props.params;
  const rho = airDensity(p.tempC, p.altitudeM);
  return (
    <EditorPopover
      title="Air density"
      onClose={props.onClose}
      readoutLabel="Air density"
      readoutValue={`${rho.toFixed(3)} kg/m³`}
      note="Standard-atmosphere pressure at the altitude, with the ideal-gas law at your temperature. (Humidity lowers it a little and is ignored.)"
    >
      <EditorField label="Temperature">
        <div className="combo">
          <NumberInput
            value={p.tempC}
            onChange={(v) => props.onChange({ ...p, tempC: v })}
            suffix="°C"
            min={TEMP_MIN_C}
            max={TEMP_MAX_C}
            step={1}
          />
        </div>
      </EditorField>
      <EditorField label="Altitude">
        <div className="combo">
          <NumberInput
            value={p.altitudeM}
            onChange={(v) => props.onChange({ ...p, altitudeM: v })}
            suffix="m"
            min={ALT_MIN_M}
            max={ALT_MAX_M}
            step={100}
          />
        </div>
      </EditorField>
    </EditorPopover>
  );
}
