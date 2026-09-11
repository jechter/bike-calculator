# Lookup data

These JSON files hold the reference tables the calculators look numbers up in.
They are plain data — you can add or edit entries here **without touching any
code**. Each file is an array of objects; add a new object (or edit an existing
one) following the shape of the entries already there.

The values are APPROXIMATE / community-sourced reference data — verify against
the manufacturer or your own measurements before relying on them.

| File | Used by | What it is |
| --- | --- | --- |
| `derailleurs.json` | Drivetrain & Derailleur calculators | ~550 rear derailleur specs (capacity, max sprocket, pull ratio), sourced per entry. |
| `hub-gears.json` | Drivetrain calculator | Internal-gear-hub, bottom-bracket-gearbox, and CVT gearing (Rohloff, Pinion, Nexus, Alfine, Enviolo, …), with a source per entry. |
| `chainring-presets.json` | Drivetrain calculator | Common crankset chainring combinations. |
| `cassette-presets.json` | Drivetrain calculator | Cassette / sprocket sets by brand & model, with a source per entry. |
| `hubs.json` | Wheel-building calculator | Real hubs — flange diameters / offsets for spoke lengths, plus type / width / drillings for the picker. |
| `tension-curves.json` | Wheel-building calculator | Tensiometer reading → tension (kgf) conversion tables. |

## Field reference

### `derailleurs.json`
An object with a `derailleurs` array (plus `count` / `sources` / `description`
metadata). Each raw entry is mapped to a `DerailleurSpec` at load time (see
`src/lib/derailleur.ts`), which generates a stable `key` (from
brand+model+cage+speeds — **not** stored in the file) and *derives* the
`actuation` family. Optional fields are omitted when unknown; the UI shows
"—"/"unknown" for them. Raw fields:
- `brand`, `model` — display strings.
- `series` — groupset/series (e.g. `"Deore"`, `"Eagle"`); `"-"` means none.
- `type` — `"Road"`, `"Gravel"`, or `"MTB"` (maps to `discipline`).
- `nominalSpeeds` — indexed speed count (number, e.g. `11`).
- `cage` — cage-length label (`"SS"`, `"GS"`, `"SGS"`, `"S"`/`"M"`/`"L"`…); optional.
- `maxLow` — largest cog the cage clears (teeth); optional.
- `minLow` — smallest cog (teeth); optional.
- `capacity` — rated total capacity (teeth); optional.
- `pullRatio` — sourced numeric cable-pull ratio (`:1`), e.g. `1.4`; optional.
- `electronic` — electronic group label (`"Di2"`, `"AXS"`, `"eTap"`, `"WT"`…) if
  the derailleur is electronic (no cable pull); optional.
- `introduced`, `discontinued` — model years; optional.
- `source` — `{ url, sourceType: "primary" | "secondary", note }` citing the specs.

The `actuation` family is **derived** from brand/type/speeds/electronic and must
match a family in `DERAILLEUR_SYSTEMS`; third-party brands and ambiguous cases
are left "unknown". Pull-ratio display prefers the numeric `pullRatio`, falling
back to the family estimate in `PULL_RATIOS`.

### `hub-gears.json`
An object with a `hubs` array (plus `description` / `extractedOn` / `count`
metadata). Each hub is mapped to a `HubPreset` at load time (see
`src/lib/drivetrain.ts`):
- `name` — display name.
- `manufacturer` — maker name; the drivetrain picker groups models under it
  (makers sorted by name, models by speed count).
- `type` — `"hub"` (internal gear hub) or `"bottomBracket"` (gearbox).
- `continuouslyVariable` — `true` for a CVT; then `numGears` is `null` and
  `ratios` is `[min, max]` of the continuous range (the app exposes the two
  endpoints as "Low" / "High").
- `numGears` — number of gears (or `null` for a CVT).
- `ratios` — gear ratios relative to 1:1 direct drive, lowest first. `1.0` is
  direct drive; below 1 is a reduction, above 1 an overdrive. Discrete hubs get
  ordinal gear names ("1st", "2nd", …) automatically.
- `derailleurCompatible` — `true` for systems designed to be combined with a
  rear derailleur + cassette (Schlumpf, Classified, Brompton, Sachs 3×7…);
  optional (omitted = false). The drivetrain calculator then offers to add a
  derailleur/cassette alongside the hub, multiplying the hub ratios through
  every cog.
- `source` — `{ url, sourceType: "primary" | "secondary", note }` citing where
  the ratios came from.

### `chainring-presets.json`
Each entry is a `ChainringPreset` (see `src/lib/drivetrain.ts`):
- `label` — display name.
- `rings` — array of chainring tooth counts, largest first (e.g. `[50, 34]`).

### `cassette-presets.json`
An object with a `cassettes` array (plus `description` / `count` / `sources`
metadata). Each entry is mapped to a `CassettePreset` at load time (see
`src/lib/drivetrain.ts`); the drivetrain calculator has a **"Browse" foldout**
next to the cog field that opens a searchable cassette picker with **brand /
speeds / range** filters. Picking one fills the editable cog field:
- `brand` — maker name; the picker's first dropdown.
- `model` — model designation (`"-"` when the source lists none).
- `freehub` — freehub-body standard(s) the cassette fits (e.g. `"HG 11"`,
  `"XD"`, `"Micro Spline"`).
- `speeds` — number of sprockets (equals `sprockets.length`).
- `sprockets` — cog tooth counts, **smallest first** (e.g. `[11, 13, 15, …]`).
- `weightGrams`, `priceUsd` — approximate weight (g) and price (USD); either may
  be `null`.
- `special` — special drivetrain family if any, e.g. `"LinkGlide"` or `"T-Type"`.
- `source` — `{ url, sourceType: "primary" | "secondary", note }` citing where
  the tooth counts came from.

### `hubs.json`
An array of real hubs; each is a `Hub` (see `src/lib/spokes.ts`). The
wheel-building calculator's **Hub** section has a searchable picker with
**maker / type / spoke-count / width** filters; picking one fills the flange
fields (and snaps the spoke count to a drilling the hub offers):
- `manufacturer`, `model` — display strings; the picker groups by maker.
- `type` — one of `"front"`, `"front-dynamo"`, `"rear-cassette"`,
  `"rear-internal"` (internal-gear/coaster), or `"rear-single"` (track/
  single-speed). Only affects filtering/labels, not the geometry math.
- `widthMm` — over-locknut dimension / frame spacing (mm).
- `spokeCounts` — drillings the hub is offered in (e.g. `[28, 32, 36]`).
- `leftFlangeDiaMm`, `rightFlangeDiaMm` — flange diameters, i.e. the pitch
  circle through the spoke holes (mm). Left = non-drive, right = drive.
- `leftOffsetMm`, `rightOffsetMm` — centre-to-flange distances (mm).
- `spokeHoleMm` — flange spoke-hole diameter (mm).
- `source` — `{ url, sourceType, note }`. The shipped rows are transcribed from
  Damon Rinard's public-domain spoke database (spocalc,
  <https://sheldonbrown.com/rinard/spocalc.htm>). Flange geometry varies between
  production runs — treat these as starting points and measure your own hub.

### `tension-curves.json`
Each entry is a `TensionCurve` (see `src/lib/spokes.ts`):
- `tool` — tensiometer name.
- `spokeType` — material + shape + size, e.g. `"steel round 2.0 mm"`.
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
