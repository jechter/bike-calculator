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
- **Chainrings**: list of tooth counts, e.g. `50, 34` or `48` for 1×. An
  editable field with a preset button for **common cranksets** (compact 50/34,
  standard 53/39, sub-compact, gravel 2×, triples, 1× options).
  (Single speed / IGH: a single chainring.)
- **Cassette/cogs**: list of tooth counts, e.g. `11, 12, 13, 14, 15, 17, 19,
  21, 24, 28`. Editable field with a preset button for common cassettes (11–28,
  11–34, 10–52, etc.). (Single speed / IGH: a single sprocket.)
- **Rolling circumference** (mm): an editable field with an integrated preset
  dropdown (combobox) that fills it from a tire size (labelled by **ETRTO**,
  e.g. `25-622`). A measured roll-out is most accurate. Links across to the
  [tire calculator](tire.md) for size conversion.
- **Cadence** (rpm): lives in the **chart's control bar** (next to the axis
  selector), since it only affects the speed visualisation — a compact slider
  over 60–120 with a number field for values outside it. Default 90.
- **Speed unit** (km/h / mph): the global switch in the sidebar footer, shared
  with the [power calculator](power.md) — not a per-chart toggle.
- **For chain length**: chainstay length (mm) OR the "big-big" measurement,
  plus largest chainring and largest cog.
- **Rear derailleur** (cassette mode, optional): pick one from the
  [derailleur database](derailleur-compatibility.md); the tool checks that your
  largest cog ≤ its max sprocket and required capacity ≤ its rated capacity, and
  shows its actuation/pull ratio. Both checks are **tri-state** — OK / caution /
  over — since a little past spec usually still works: up to **+4T** over is a
  caution (max cog: long hanger / extra B-tension; capacity: the extra slack only
  appears in the small-small cross-chain gear you'd avoid anyway). The caution
  band shows amber with a "proceed with caution" note; beyond it is a hard fail.
  (Gear range isn't repeated here — it's in the Gears summary.)

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

Present the gears as a **visualization**, not a table: a horizontal axis (the
chosen metric — speed at cadence, gear inches, development, or ratio) with **one
line per chainring** and a dot per gear (labelled with its cog / hub gear). This
makes overlaps and gaps between chainrings, and the overall range, obvious at a
glance. Also show the gear count and range (`highest ratio / lowest ratio`).

> **Gear inches** (offered as a chart axis) = the drive-wheel diameter, in inches,
> of an equivalent direct-drive high-wheeler — a wheel-size-independent way to
> compare gearing; bigger = taller/harder. It's a classic metric but niche, hence
> it's one of several selectable axes rather than the default (speed is default).

**Drivetrain view.** Below the chart, a schematic side view (real mm, chain pitch
12.7 mm) draws the chainring(s) and cassette cogs **to scale by tooth count**,
spaced by the **chainstay length**, with the **chain over the currently-selected
gear**. Hovering a gear dot in the chart moves the chain (default: a middle gear).
For a **derailleur** setup a rear derailleur is simulated: the tension pulley
swings on its cage (solved by circle intersection) so the **total chain length
stays constant** as the gear changes — bigger cogs retract the cage, smaller cogs
extend it. Single-speed/hub setups draw a plain chain loop (no derailleur).

**Cross-chaining.** With 2+ chainrings, the chart **greys out** the extreme
cross-chained combinations to avoid shifting into: the big ring with the two
largest cogs, and the small ring with the two smallest cogs (big-big /
small-small). The hover tooltip flags them too. Single-speed and hub setups have
no cross-chaining.

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
`circumference / π`, or from tire size.

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

> **Only shown for a derailleur (cassette) setup.** The `+ 1` term is the
> rear-derailleur wrap, so this formula does **not** apply to single-speed or
> hub-geared bikes — there's no cage to take up slack. For those, chain length
> is set by the dropout/tensioner position: wrap the chain snug around ring and
> cog and pick the shortest link that lets the wheel sit within its adjustment
> range at correct tension; a half-link fine-tunes horizontal/track dropouts,
> and a tensioner is used with vertical dropouts. The app shows this guidance
> instead of a (misleading) number for single speed / IGH.

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
with a chain-wear gauge. This is just the **replace-at threshold**, which depends
on chain type. Since the drivetrain is already known, the app shows only the
relevant one: the cassette's cog count gives the speed (→ 0.5% or 0.75%), and
single-speed/hub bikes use the 1/8" row.

| Chain type | Replace at |
|-----------|-----------|
| 11- & 12-speed | 0.5% |
| 6- to 10-speed | 0.75% |
| Single speed, narrow (3/32") | 0.75% |
| Single speed / hub, wide (1/8") | 1.0% |

For a **cassette** the app shows the one row matching the cog count. For
**single-speed / hub** setups it shows **both** the narrow (3/32", derailleur-width
— wears like a geared chain) and wide (1/8", track/BMX/most hubs) rows, since
either can be fitted; the user picks the one matching their chain. Narrower chains
wear faster, so they get replaced earlier; past the threshold the cassette (and
possibly chainrings) may skip with a new chain.

## Worked example

50/34 chainrings, 11–28 cassette, 700×25c (circ ≈ 2.111 m), cadence 90.

- 50×11: ratio = 4.545; speed = 4.545 × 2.111 × 90 × 60/1000 ≈ **51.8 km/h**.
- 34×28: ratio = 1.214; speed ≈ **13.8 km/h**.
- Chain length, chainstay 410 mm: `2×(410/25.4) + 50/4 + 28/4 + 1`
  `= 32.28 + 12.5 + 7 + 1 = 52.78` → round up to 53 inches → **1346 mm / 106 links**.

## Reference data needed

- Common cassette presets (tooth lists).
- Wheel/tire rolling circumferences — shared with the [tire calculator](tire.md).
