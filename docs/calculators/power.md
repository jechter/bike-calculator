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
| `CdA` | drag area, m² | 0.30–0.40 hoods, ~0.25 drops, ~0.22 aero/TT |
| `v_headwind` | head/tail wind component, m/s | + head, − tail |
| `η` | drivetrain efficiency | ~0.97–0.98 |

Each coefficient (CdA, Crr, ρ, drivetrain efficiency) is an **editable field with
a preset dropdown** (combobox): pick a common value or type your own. Expose the
assumptions so the number is interpretable.

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
