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
- **Wheel/tyre size**: to get rolling circumference. Either
  - pick a preset (e.g. 700×25c ≈ 2111 mm, 700×28c ≈ 2136 mm, 26×2.1 ≈ 2073 mm),
    see [tyre spec](tire.md) for a circumference table, or
  - enter a measured roll-out circumference (most accurate).
- **Cadence** (rpm): for the speed table, e.g. 90. Allow a few cadences.
- **Crank length** (mm): only needed for gain ratio, e.g. 170.
- **For chain length**: chainstay length (mm) OR the "big-big" measurement,
  plus largest chainring and largest cog.

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
- **Gain ratio** (Sheldon Brown, dimensionless, accounts for crank length):
  `gain_ratio = (wheel_radius / crank_length) × (chainring / cog)`
  with wheel_radius and crank_length in the same units.
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

Round **up** to the nearest whole inch (each inch = 2 links = 1 inner + 1 outer).
Convert to number of links: `links = L_inches × 2`.
`chainstay_length_in_inches = chainstay_mm / 25.4`.

**2. Largest-largest ("big-big") method:**

Wrap the chain around the largest chainring and largest cog **without** routing
through the rear derailleur, pull snug, then add **2 links (1 inch)** for the
derailleur wrap. This is measured, not calculated — the calculator can explain
the procedure and, if the user enters the measured big-big link count, add 2.

> Notes: full-suspension frames need the chain sized at the chainstay length
> that gives maximum chain growth. For 1× with a clutch/wide-range cassette,
> the big-big method is generally preferred. Always verify the result won't
> over-extend the derailleur in big-big or go slack in small-small.

## Chain wear (replacement check)

A worn ("stretched") chain accelerates cassette and chainring wear, so checking
it belongs with the drivetrain. Chain wear is elongation from roller/pin wear,
measured as a percentage over a nominal length.

### Inputs
- Either a **chain-checker tool reading** (e.g. 0.5 / 0.75 / 1.0), or
- a **measured length over N links**. Nominal pitch is 0.5 inch (12.7 mm) per
  link, so N links should measure `N × 12.7 mm` when new. A standard field
  measurement is over 12 complete links (24 pins) = nominally 12 inches / 304.8 mm.

### Formula
```
elongation_% = (measured_length − nominal_length) / nominal_length × 100
             = (measured_length / (N_links × 12.7 mm) − 1) × 100
```

### Guidance (output thresholds)
- **< 0.5%** — OK.
- **0.5%–0.75%** — replace the chain soon; the cassette is usually still fine
  (esp. 11/12-speed, where < 0.5% is the common replace point).
- **> 0.75% (≈ 1.0% for older/wider chains)** — replace the chain; the cassette
  (and possibly chainrings) are likely worn too and may skip with a new chain.

State which thresholds you use and that narrower 11/12-speed chains generally
warrant earlier replacement than older 5–9-speed chains.

## Worked example

50/34 chainrings, 11–28 cassette, 700×25c (circ ≈ 2.111 m), cadence 90, crank
170 mm.

- 50×11: ratio = 4.545; speed = 4.545 × 2.111 × 90 × 60/1000 ≈ **51.8 km/h**.
- 34×28: ratio = 1.214; speed ≈ **13.8 km/h**.
- Chain length, chainstay 410 mm: `2×(410/25.4) + 50/4 + 28/4 + 1`
  `= 32.28 + 12.5 + 7 + 1 = 52.78` → round up to **53 inches → 106 links**.

## Reference data needed

- Common cassette presets (tooth lists).
- Wheel/tyre rolling circumferences — shared with the [tyre calculator](tire.md).
