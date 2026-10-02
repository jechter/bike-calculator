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
rider (175 cm, 72 kg), scaled by body size and nudged by bike type, wheelset and
clothing:

```
CdA = base[position] · size_scale(height, mass) · bike · clothing + wheel_delta
size_scale = (height/175)^0.6 · (mass/72)^0.35
```

**Bike type is the primary choice** — it carries the frame/tire-bulk `bike`
multiplier and decides the available riding positions, which really follow the
**handlebar**:

- **Drop bar** (road, endurance, gravel) → Tops / Hoods / Drops / Drops-low. All
  three share this list and differ only by `factor` (gravel bulkier than road).
- **Flat bar** (city, mountain) → Upright / Leaning forward. No hoods or drops.
- **Aero bar** (TT) → Aero tuck / Base bar.
- **Recumbent** → High-racer / Low-racer / Low-racer + tailbox.
- **Velomobile** → a single enclosed shell.

The drop-bar baselines are anchored so an average rider reproduces the old quick
presets (hoods ~0.36, drops ~0.31, aero-tuck ~0.23). The two low-drag categories
go much further: a **recumbent** is ~0.16–0.26, and a **velomobile** is ~0.055 —
an order below a road bike. The velomobile's fairing sets the frontal area, so
its CdA is rider-independent: wheels, clothing and rider size are all disabled and
have no effect.

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
- Optionally a small table: power at a range of speeds, or speed at a range of
  powers.

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
