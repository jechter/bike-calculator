# Drivetrain Calculator

Answers: for a given drivetrain (derailleur cassette, single speed, or internally
geared hub), which gear combinations give which ratios, and what road speed
results at a chosen cadence — plus how long a chain to cut and when to replace a
worn chain.

## Inputs

- **Drivetrain type** — pick one:
  - **Derailleur (cassette)**: multiple chainrings × multiple cogs.
  - **Single speed / fixed**: one chainring × one cog (see below).
  - **Internally geared hub (IGH)**: chainring × sprocket, then multiplied by the
    hub's internal gear ratios (see below).
- **Chainrings**: list of tooth counts, e.g. `50, 34` or `48` for 1×.
  (Single speed / IGH: a single chainring.)
- **Cassette/cogs**: list of tooth counts, e.g. `11, 12, 13, 14, 15, 17, 19,
  21, 24, 28`. Allow entering a range or a common cassette preset (11–28,
  11–34, 10–52, etc.). (Single speed / IGH: a single sprocket.)
- **Rolling circumference** (mm): an editable field with a small preset button
  that fills it from a tyre size (labelled by **ETRTO**, e.g. `25-622`). A
  measured roll-out is most accurate. Links across to the [tyre calculator](tire.md)
  for size conversion.
- **Cadence** (rpm): a slider over the usual 60–120 range, with a number field
  for values outside it. Default 90.
- **For chain length**: chainstay length (mm) OR the "big-big" measurement,
  plus largest chainring and largest cog.

> **Gain ratio** (Sheldon Brown's crank-length-aware measure) is intentionally
> *not* shown — it's niche and needing a crank-length input for it added clutter.
> The formula lives in the "Formulas" section and the calc library still exposes
> it if we ever want to bring it back.

## Drivetrain types

### Derailleur (cassette)
The default: every chainring × cog combination, presented as a grid (below).

### Single speed / fixed gear
One chainring, one cog → a single ratio. Still useful to show gear inches,
development, and speed-at-cadence, and to help pick a cog/chainring for a target
gear inch. For **fixed-gear/track and horizontal dropouts**, also consider adding
a "skid patch" count (`cog / gcd(cog, chainring)`, doubled if the rider is
ambidextrous) and a chain-tension/"magic gear" note — see
[additional-ideas.md](../additional-ideas.md).

### Internally geared hub (IGH)
The transmission ratio is the chainring/sprocket ratio **multiplied by the hub's
internal ratio** for each hub gear:

```
overall_ratio(gear) = (chainring / sprocket) × hub_ratio(gear)
```

Feed `overall_ratio` into all the outputs below (gear inches, development, speed
at cadence). Provide presets for common hubs with their published internal
ratios, e.g. Shimano Nexus/Alfine (3/7/8/11-speed), Sturmey-Archer (3-speed),
Rohloff Speedhub (14-speed), Kindernay. Store these ratios as **cited data** (do
not reproduce from memory) and let the user override. Useful IGH outputs:
per-gear overall ratio and speed, plus the **total gear range**
(`top ratio / bottom ratio`, often quoted as a %) and the **step between gears**.

> IGHs use a single chainring and single sprocket, so the chain-length and
> single-speed tensioning notes apply. There is no front/rear derailleur
> capacity to worry about.

## Outputs

- **Gear ratio** for every chainring × cog combination: `ratio = chainring / cog`.
- **Gear inches**: `gear_inches = ratio × wheel_diameter_inches`
  (classic penny-farthing-equivalent measure).
- **Development / metres of development**: distance travelled per crank
  revolution: `development_m = ratio × circumference_m`.
- **Speed at cadence**:
  `speed = ratio × circumference × cadence` →
  `speed_kmh = ratio × circumference_m × cadence_rpm × 60 / 1000`.
- **Chain length** (see below).

Present the ratio/speed data as a **grid** (chainrings as rows, cogs as columns)
and highlight useful things: duplicate/overlapping gears between chainrings, the
overall gear range (`highest ratio / lowest ratio`), and any large jumps between
adjacent gears.

## Formulas

Let `C` = chainring teeth, `S` = sprocket (cog) teeth, `circ` = rolling
circumference, `cad` = cadence in rpm.

```
ratio        = C / S
gear_inches  = (C / S) × wheel_diameter_in_inches
development  = (C / S) × circ                     # per crank revolution
gain_ratio   = (wheel_radius / crank_length) × (C / S)
speed        = (C / S) × circ × cad               # distance per minute
speed_kmh    = ratio × circ_m × cad × 60 / 1000
speed_mph    = speed_kmh × 0.621371
```

Wheel diameter for gear inches can be taken as
`circumference / π`, or from tyre size.

## Chain length

Two accepted methods; offer both.

**1. Rigid-formula method (Park Tool):**

```
L_inches = 2 × (chainstay_length_in_inches)
         + (largest_chainring / 4)
         + (largest_cog / 4)
         + 1
```

Round **up** to the nearest whole inch (each inch = 2 links = 1 inner + 1 outer),
which keeps the link count even. `chainstay_length_in_inches = chainstay_mm / 25.4`.
Report the result to the user in **mm** (`links × 12.7`, i.e. `inches × 25.4`)
and as a **link count** (`links = inches × 2`) — links being what you actually
cut. The formula is inch-based internally only.

**2. Largest-largest ("big-big") method:**

Wrap the chain around the largest chainring and largest cog **without** routing
through the rear derailleur, pull snug, then add **2 links (1 inch)** for the
derailleur wrap. This is measured, not calculated — the calculator can explain
the procedure and, if the user enters the measured big-big link count, add 2.

> Notes: full-suspension frames need the chain sized at the chainstay length
> that gives maximum chain growth. For 1× with a clutch/wide-range cassette,
> the big-big method is generally preferred. Always verify the result won't
> over-extend the derailleur in big-big or go slack in small-small.

## Chain wear — when to replace

We do **not** calculate chain wear — in the workshop that's measured directly
with a chain-wear gauge. This section is just the **replacement-threshold
reference**, since the %-elongation at which to replace depends on chain type.
Narrower chains wear the cassette faster, so they get replaced earlier.

| Chain type | Replace at |
|-----------|-----------|
| 11- & 12-speed | 0.5% |
| 6- to 10-speed | 0.75% |
| Single speed / internally geared (1/8") | 1.0% |

Past the threshold the cassette (and possibly chainrings) are likely worn too and
may skip with a new chain.

## Worked example

50/34 chainrings, 11–28 cassette, 700×25c (circ ≈ 2.111 m), cadence 90.

- 50×11: ratio = 4.545; speed = 4.545 × 2.111 × 90 × 60/1000 ≈ **51.8 km/h**.
- 34×28: ratio = 1.214; speed ≈ **13.8 km/h**.
- Chain length, chainstay 410 mm: `2×(410/25.4) + 50/4 + 28/4 + 1`
  `= 32.28 + 12.5 + 7 + 1 = 52.78` → round up to 53 inches → **1346 mm / 106 links**.

## Reference data needed

- Common cassette presets (tooth lists).
- Wheel/tyre rolling circumferences — shared with the [tyre calculator](tire.md).
