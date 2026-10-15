# Cycling Power Calculator

Two directions of the same physics model:

- **Power → speed**: how fast will I go pushing X watts (on a given gradient,
  etc.)?
- **Speed → power**: how many watts to hold Y km/h on that gradient?

## Model

Total power at the pedals is the power to overcome the resisting forces, divided
by drivetrain efficiency:

```
P_pedal = (F_gravity + F_rolling + F_aero) × v / η_drivetrain
```

(steady state; ignores acceleration — add `F_accel = m·a` if modelling changes
in speed.)

Forces, with ground speed `v` (m/s) and road gradient `G` (rise/run, e.g. 0.05
for 5%):

```
slope_angle = atan(G)

F_gravity = m · g · sin(slope_angle)
F_rolling = Crr · m · g · cos(slope_angle)
F_aero    = 0.5 · ρ · CdA · (v + v_headwind)²
```

Then:

```
P_pedal = (F_gravity + F_rolling + F_aero) · v / η
```

### Symbols & typical values

| Symbol | Meaning | Typical |
|--------|---------|---------|
| `m` | total mass = rider + bike & equipment, kg | e.g. 70 + 10 = 80 |
| `g` | gravity | 9.81 m/s² |
| `G` | gradient (rise/run) | −0.10 … 0.20 |
| `Crr` | coefficient of rolling resistance | 0.004 (good road tire) – 0.008 (rough), 0.012+ off-road |
| `ρ` | air density, kg/m³ | 1.225 at sea level, 15 °C (varies with altitude/temp) |
| `CdA` | drag coefficient × frontal area ("drag area"), m² | 0.30–0.40 hoods, ~0.25 drops, ~0.22 aero/TT |
| `v_headwind` | head/tail wind component, m/s | + head, − tail |
| `η` | drivetrain efficiency = `η_chain · η_gearing` | ~0.82–0.99 |

Each coefficient (CdA, Crr, ρ, drivetrain efficiency) is an **editable field with
a ⌄ button**: pick a common value or type your own. Crr opens a simple preset
list; CdA, air density and drivetrain efficiency open a richer **"complex editing"
foldout** (the shared `EditorPopover` chrome in `src/components/EditorPopover.tsx`,
with the `useOutsideClose` anchor pattern). All three editor-backed fields behave
the same: seeded from their editor, re-derived live as you change a factor, and
switched to *manual* (left alone) once you type a value directly; opening or
closing a panel never recomputes.

**CdA has a built-in estimator** (`src/lib/cda.ts`, `CdaAdvanced.tsx`). The CdA
field's caret opens a foldout (there's no fixed-value dropdown — the estimator
replaces it) that builds `CdA = Cd·A` from a position baseline for a reference
rider (175 cm, 72 kg), scaled by body size and nudged by bike type, wheelset,
clothing and legs:

```
CdA = base[position] · size_scale(height, mass) · bike · clothing · legs + wheel_delta
size_scale = (height/175)^0.6 · (mass/72)^0.35
```

**Bike type is the primary choice** — it carries the frame/tire-bulk `bike`
multiplier and decides the available riding positions, which really follow the
**handlebar**:

- **Drop bar** (road, endurance, gravel) → Tops / Hoods / Drops / Drops-low /
  Clip-on aero bars. All three share this list and differ only by `factor` (gravel
  bulkier than road). Clip-ons (~0.26 base, for ultra/TT setups) sit below the
  drops but above a dedicated TT bike's tuck — the frame isn't aero and the
  position is less optimised.
- **Flat bar** (city, mountain) → Upright / Leaning forward. No hoods or drops.
- **Aero bar** (TT) → Aero tuck / Base bar.
- **Recumbent** → High-racer / Low-racer / Low-racer + tailbox.
- **Velomobile** → a single enclosed shell.

The drop-bar baselines are anchored so an average rider reproduces the old quick
presets (hoods ~0.36, drops ~0.31, aero-tuck ~0.23). The two low-drag categories
go much further: a **recumbent** is ~0.16–0.26, and a **velomobile** is ~0.055 —
an order below a road bike. The velomobile's fairing sets the frontal area, so
its CdA is rider-independent: wheels, clothing, legs and rider size are all disabled and
have no effect.

**Legs** — unshaved or shaved. Shaved legs multiply CdA by 0.95. Specialized's
Win Tunnel (2014) measured ~7 % less drag after riders shaved; other tests found
less, so the estimate takes a conservative 5 %. Like clothing, it has no effect
inside a velomobile's fairing.

**Drafting** is the last step: one *Drafting formation* menu, with a count
field labelled **Other riders** next to it, scales the solo CdA by a draft factor (`groupDraftFactor` in
`cda.ts`). The same count is retained when switching formations. The options are single file, double file, double file (average in
rotating group), and bunch/peloton.

**Holding a spot** (single file, double file, bunch). `n` is the count entered:
- Single file: riders ahead.
- Double file and bunch: other riders in the formation, including riders
  alongside you. The preview fills rows with `n + 1` riders, including you.
  Double-file drag uses the highlighted rider's complete row depth. Bunch drag
  remains a count-based approximation, not a position-specific CFD calculation.

Zero means alone. `draftFactor` applies:

```
CdA = CdA_solo · draft(n, formation)
line:   draft = 0.55 + 0.45 · 3^(−n)          (single file)
bunch:  draft = 0.10 + 0.90 / (1 + n/2)       (bunch / peloton)
```

For fixed double file, you occupy row-major slot `n` (zero-based) in the same
rows of two used by the schematic. `r = floor(n / 2)` is the number of complete
rows ahead. The shared per-position model is:

```
solo:       factor = 1
front pair: factor = 1.03
row r ≥ 1:  factor = 0.35 + 0.65 · 0.48^r
```

The 1.03 penalty, 0.35 floor and 0.48 decay are heuristic model choices, not
coefficients fitted to a documented published dataset. The front-pair penalty
is spacing-dependent in reality; it is deliberately shared between fixed and
rotating double file rather than suggesting a saving for two riders abreast.

- **Behind one wheel**, single file and bunch give ~0.70, a ~30 % saving,
  anchored to two-rider studies. In double file, one row ahead
  (`n = 2`, two physical riders ahead) gives ~0.66.
- **Single file** levels off near 0.55. Team-pursuit riders 3–4 feel ~55–60 % of
  the lead's drag.
- **Double file:** one other rider puts you abreast at the front (+3% estimated
  drag). Two or three others put you behind one full row (factor 0.662).
  Four or five others put you behind two full rows (factor 0.49976). Adding a
  neighbour in your own row does not add another half-row of drafting shelter.
  These are simplified estimates, not exact drag predictions for each spacing.
- **Bunch:** the preview uses staggered rows widening 1, 2, …, 10, then
  alternating 9/10, based on section 2.2 / Fig. 3 of
  [Blocken et al. (2018)](https://doi.org/10.1016/j.jweia.2018.06.011).
  The highlighted rider occupies a central slot in the row being filled;
  other riders fill neighbouring slots before a new row begins. The preview does not claim
  to reproduce the paper's exact rider positions or CFD values.
  Riders on both sides shelter you, so drag keeps falling toward ~0.10
  deep in a large peloton (Blocken et al. 2018, 121-rider CFD): 5 ahead → ~0.36,
  20 → ~0.18, 100 → ~0.12.

**Rotating double file** (through & off / Belgian tourniquet). Nobody holds one
spot. The **Other riders** count stays unchanged; the group has `N = n + 1`
riders including you (0 other riders = alone). The factor is the **average over every position**, including your turns
on the front (`rotatingDraftFactor`):

- The calculation averages `doubleFilePositionFactor(slot, N)` over all `N`
  slots, using exactly the same front-pair and complete-row model as fixed
  double file. Rotating-group averages remain unchanged.
- The front pair uses the shared estimated penalty of 1.03. This is a
  conservative approximation; lateral spacing and staggering affect the actual
  interference drag. No particular measured percentage is claimed for this model.
- **Typical averages:** 8 riders → ~0.65, 16 → ~0.51, 24 → ~0.46.
- **Limits:** the model only captures drag. A tourniquet's real draw at club size
  is short, steady pulls, which it doesn't capture. I found no study that
  measures a full rotation.

All formations share one **Other riders** value (0–150), excluding you.
Switching formation preserves that value; rotating mode adds you internally. These are rough fits for comparing scenarios,
not position-exact aerodynamics.

Rider mass comes from the page's rider field. **CdA starts seeded from the
estimator** (road / hoods / reference rider) and stays *estimator-driven*: changing
any factor — or the rider weight — re-derives it. Merely opening or closing the
panel never overwrites it. **Typing a value in the CdA field switches it to
manual**, after which it's left alone (weight changes no longer move it). These are
plausible estimates for comparing setups, not wind-tunnel data.

**Drivetrain efficiency is one field whose editor multiplies two factors** — so the
number isn't quietly a best-case single-speed figure that ignores the transmission
(`combinedEfficiency` in `src/lib/power.ts`, editor `DrivetrainEfficiency.tsx`):

- `η_chain` — friction in the **chain or belt** itself: clean & waxed ~0.99,
  typical chain ~0.98, worn/dirty ~0.96, belt drive ~0.98.
- `η_gearing` — losses in the **gear mechanism**: single speed 1.00, derailleur
  ~0.98, internal gear hub ~0.95, CVT ~0.85 (figures in line with gearbox/hub
  efficiency testing, e.g. [cyclingabout.com](https://www.cyclingabout.com/speed-difference-testing-gearbox-systems/),
  which measures a CVT around 83–84 % overall — ~0.85 once the chain is factored out).

A typical chain on a derailleur (0.98 × 0.98 ≈ **0.96**) is the default — a little
lower than a naïve 0.97–0.98, because it now counts the derailleur's losses.

**Air density has an editor too** (`src/lib/airDensity.ts`, `AirDensity.tsx`) that
derives ρ from **temperature and altitude**: standard-atmosphere pressure at the
altitude, `P(h) = 101325 · (1 − 2.25577e‑5·h)^5.25588`, then the ideal-gas law
`ρ = P / (287.05 · (T+273.15))`. Anchored to the usual references — sea level at
15 °C → 1.225, at 25 °C → 1.184. Humidity is ignored.

### Coupled speed ⇄ power ⇄ W/kg fields

Rather than a "solve for" switch, **speed, power and power-to-weight (W/kg) are
editable fields that stay in sync**: edit one and the others update via the
model. When a *condition* (mass, gradient, CdA, …) changes, the field the user
**edited last** is held fixed and the others are recomputed — the intuitive
behaviour. Internally: track `last ∈ {speed, power, wkg}`; from it we get the
independent pedal power (`powerForSpeed(speed)`, the typed watts, or
`wkg × rider_mass`), then derive the rest (`speedForPower`, `watts / rider_mass`).

**Power-to-weight uses rider mass, not total mass** — the conventional cycling
metric (climbing/FTP comparisons are per body kg). Total mass (rider + bike &
equipment) still drives the physics; only the W/kg readout divides by the rider
alone. Mass is entered as two fields — **rider** and **bike & equipment** — that
sum to `m`.

## Power → speed

`F_aero` makes this a **cubic in `v`** — no simple closed form. Solve
numerically:

- Rearrange to `f(v) = (F_gravity + F_rolling + F_aero(v))·v/η − P = 0` and solve
  with bisection or Newton–Raphson for `v > 0`. It is monotonic in the realistic
  range, so bisection between 0 and, say, 30 m/s converges reliably.

## Speed → power

Direct substitution — plug `v` into the model above.

## Outputs

- The answer (speed in km/h & mph, or power in W).
- A **breakdown** of where the watts go, in **watts and %**, against gravity,
  rolling and aero, plus the **drivetrain loss** — the four sum to the total pedal
  power. It's drawn as a colour-coded stacked bar under the cards. This is
  genuinely instructive (e.g. shows how aero dominates on the flat and gravity
  dominates on a climb) and helps sanity-check inputs. The percentages are shares
  of the **resisting** power (the parts the rider must overcome). On a descent
  gravity *assists* rather than resists, so it shows negative watts labelled
  "assist" and takes no bar width, while the rest still sum to 100 %. The
  drivetrain loss is `road_power × (1/η − 1)`, so it shrinks as gravity assists on
  a descent. If gravity overcomes rolling and drag on its own (pedal power ≤ 0),
  there's nothing to pedal against — the breakdown is replaced by a note that you'd
  coast or brake.
- **Work & energy** over a ride: pedal work (kJ), food energy (kcal) and
  elevation change — see above.
- Optionally a small table: power at a range of speeds, or speed at a range of
  powers.

## Work & energy

A **Work & energy** section turns the steady effort into totals for a ride
(`metabolicKcal`, `elevationChange` in `src/lib/power.ts`):

- **Duration ⇄ distance** are coupled through the speed above, like the
  speed/power fields: edit either, the other follows, and the one edited last is
  held fixed when speed or conditions change. Distance is in km or mi, following
  the speed unit.
- **Pedal work** `W = P_pedal · t` (kJ).
- **Food energy** `E = W / η_gross` (kcal, 1 kcal = 4184 J). `η_gross` is the
  rider's gross metabolic efficiency (a % field with rider-level presets), ~18 % untrained to ~25 % elite; the 24 %
  default is where the "1 kJ of work ≈ 1 kcal eaten" rule comes from. It excludes
  resting metabolism.
- **Elevation change** `h = d · sin(atan G)`. Over a climb the gravity work equals
  the potential energy gained, `m · g · h`.

If pedal power is ≤ 0 (you'd coast), there's no work to add up and a note shows
the descent instead.

Example: the flat worked example below (~150 W) for 1 h is ~540 kJ, ≈ 540 kcal at
24 %. A 10 km climb at 6 % gains ~599 m.

## Worked example (sanity check)

`m` = 80 kg, `G` = 0 (flat), `Crr` = 0.005, `ρ` = 1.225, `CdA` = 0.32,
no wind, `η` = 0.97, target `v` = 30 km/h = 8.333 m/s.

- F_gravity = 0
- F_rolling = 0.005 × 80 × 9.81 × 1 = 3.92 N
- F_aero = 0.5 × 1.225 × 0.32 × 8.333² = 13.61 N
- P = (3.92 + 13.61) × 8.333 / 0.97 ≈ **150 W**

On a 6% climb at 12 km/h (3.333 m/s), same rider:
- F_gravity ≈ 80 × 9.81 × sin(atan 0.06) ≈ 47.0 N
- F_rolling ≈ 0.005 × 80 × 9.81 × cos(...) ≈ 3.92 N
- F_aero ≈ 0.5 × 1.225 × 0.32 × 3.333² ≈ 2.18 N
- P ≈ (47.0 + 3.92 + 2.18) × 3.333 / 0.97 ≈ **182 W** (gravity dominates)

Use these to unit-test the implementation.

The CdA editor places the side-view riding-position and top-down formation
previews side by side below the estimated CdA and explanatory note. The
highlighted formation rider is red, without a surrounding circle. The travel
arrow and label sit outside the scaled SVG so they remain legible in large groups.

The shared `BikePositionDiagram` also supports high-racer and low-racer recumbents,
low-racers with tailboxes, and velomobiles. These show a reclined seat and
feet-forward pedals rather than a conventional diamond frame. The velomobile
shows an enclosed three-wheel shell with the rider visible in cutaway, to explain
the riding position; it is not a transparent real-world shell. Upright and
reclined variants share the capsule rider renderer and two-bone limb solver.
These illustrative geometries do not change the CdA calculation or frame sizing.

Popup editors and pickers share viewport-aware placement. They stay directly
below the triggering field when they fit there; otherwise they shift upward
and horizontally into the viewport while keeping their preferred size. Only
content larger than the available viewport is capped to fit, with internal
scrolling. They remain above sticky navigation and scrolling columns. Long
content scrolls inside the panel, with Close remaining reachable. Placement
updates on resize, scrolling, content changes, and visual-viewport changes
(including the on-screen keyboard). Height-constrained panels lock background scrolling,
keep keyboard focus inside, and return focus to the trigger when dismissed.

The Food energy result has an info popup with live illustrative food equivalents.
It uses 105 kcal per medium banana, 220 kcal per energy bar (~60 g), 1000 kcal per
whole margherita pizza (~30 cm), and 430 kcal per litre of regular lager. These
are explicitly labelled assumptions, not exact nutrition values or fueling advice.

On devices with a coarse primary pointer, numerical fields show touch-sized − / +
steppers. Tap for one step, or hold to repeat; min/max bounds still apply. The
buttons and number stay on one line inside a shared outline, without separate
button borders. Numeric editor fields use a full row on narrow phones when needed.
Direct entry requests a decimal numeric keyboard (`inputmode="decimal"`); the
exact keyboard, including availability of a minus key, depends on the device.
Desktop numerical controls retain their compact appearance.
