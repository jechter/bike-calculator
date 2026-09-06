# Lookup data

These JSON files hold the reference tables the calculators look numbers up in.
They are plain data — you can add or edit entries here **without touching any
code**. Each file is an array of objects; add a new object (or edit an existing
one) following the shape of the entries already there.

The values are APPROXIMATE / community-sourced reference data — verify against
the manufacturer or your own measurements before relying on them.

| File | Used by | What it is |
| --- | --- | --- |
| `derailleurs.json` | Drivetrain calculator | Rear derailleur specs (capacity, max sprocket, actuation family). |
| `hub-gears.json` | Drivetrain calculator | Internally-geared-hub ratios (Sturmey-Archer, Nexus, Alfine, …). |
| `chainring-presets.json` | Drivetrain calculator | Common crankset chainring combinations. |
| `cassette-presets.json` | Drivetrain calculator | Common cassette cog sets. |
| `hub-geometry.json` | Wheel-building calculator | Hub flange diameters / offsets for spoke-length presets. |
| `tension-curves.json` | Wheel-building calculator | Tensiometer reading → tension (kgf) conversion tables. |

## Field reference

### `derailleurs.json`
Each entry is a `DerailleurSpec` (see `src/lib/derailleur.ts`):
- `id` — unique kebab-case key (must be unique across the file).
- `brand`, `model` — display strings.
- `discipline` — `"Road"`, `"MTB"`, or `"Gravel"`.
- `speeds` — string, may list several (e.g. `"8"`, `"6/7"`).
- `cage` — cage length label (e.g. `"GS (medium)"`).
- `maxSprocket` — largest cog the cage clears (teeth).
- `minSprocket` — smallest cog (teeth), optional.
- `totalCapacity` — rated total capacity (teeth).
- `actuation` — must match a family in `DERAILLEUR_SYSTEMS` (`src/lib/derailleur.ts`).
- `oneBy` — `true` for dedicated 1× (optional).
- `notes` — free text (optional).

### `hub-gears.json`
Each entry is a `HubPreset` (see `src/lib/drivetrain.ts`):
- `label` — display name.
- `gears` — array of `{ "name": "1st", "ratio": 0.75 }`. `ratio` of `1.0` is
  direct drive; below 1 is a reduction, above 1 an overdrive.

### `chainring-presets.json`
Each entry is a `ChainringPreset` (see `src/lib/drivetrain.ts`):
- `label` — display name.
- `rings` — array of chainring tooth counts, largest first (e.g. `[50, 34]`).

### `cassette-presets.json`
Each entry is a `CassettePreset` (see `src/lib/drivetrain.ts`):
- `label` — display name.
- `cogs` — array of cog tooth counts, smallest first (e.g. `[11, 13, 15, …]`).

### `hub-geometry.json`
Each entry is a `HubGeometryPreset` (see `src/lib/spokes.ts`):
- `label` — display name.
- `leftFlangeDiaMm`, `rightFlangeDiaMm` — flange diameters (mm).
- `leftOffsetMm`, `rightOffsetMm` — centre-to-flange distances (mm).
- `spokeHoleMm` — flange spoke-hole diameter (mm).

### `tension-curves.json`
Each entry is a `TensionCurve` (see `src/lib/spokes.ts`):
- `tool` — tensiometer name.
- `spokeType` — e.g. `"round 2.0 mm"`.
- `points` — array of `{ "reading": 10, "kgf": 40 }`, **sorted by `reading`
  ascending**. Readings between listed points are interpolated linearly.

The shipped rows are Park Tool TM-1 conversion curves covering steel round
(1.4–2.6 mm), steel/aluminum/titanium/UHMWPE/PBO/carbon **bladed** spokes, and
several non-steel round sizes. The kgf values were generated from Park Tool's own
Wheel Tension App — <https://www.parktool.com/en-int/wta> — which computes the
same conversion as the printed TM-1 chart
(<https://www.parktool.com/assets/doc/product/TM-1_conv-table.pdf>) but also
covers non-standard sizes. Each column is trimmed to the ~40–185 kgf usable band
and rounded to whole kgf. They are reference values — spot-check against the
official chart/app for your tool before trusting a reading. To add another size
or tensiometer, add more entries following the same shape.

Only the numeric conversion values (facts) are reproduced here, re-keyed into our
own structure — not Park Tool's chart artwork. "Park Tool" and "TM-1" are their
trademarks, used only to identify the tool the data describes.
