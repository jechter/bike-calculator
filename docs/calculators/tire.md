# Tire Calculator

Two jobs:

1. **Convert tire size** between the formats you find stamped on tires and rims.
2. **Recommend a tire pressure** for a given rider, tire, and use.

## Part 1 — Size conversion

Tire and rim sizing is a mess of legacy systems. The reliable one is **ETRTO /
ISO** (`width-bead_diameter`, e.g. `25-622`). Everything else maps to it.

### Inputs
- A tire size in any supported format, or width + ISO bead diameter.

### Outputs
- The equivalent in the other formats, and the **ISO bead diameter** (which is
  what determines rim compatibility).
- Approximate **outer diameter** and **rolling circumference** (shared with the
  [drivetrain calculator](drivetrain.md)).

### Key bead-diameter (ISO) equivalences

| ISO bead | Common names |
|----------|-------------|
| 622 mm | 700C, 28", 29er (29×…) |
| 584 mm | 650B, 27.5" |
| 559 mm | 26" (MTB) |
| 630 mm | 27" (old road) |
| 571 mm | 650C |
| 507 mm | 24" |
| 406 mm | 20" (BMX, many folders) |
| 451 mm | 20" (some folders/recumbents — **not** interchangeable with 406) |
| 349 mm | 16" (Brompton) |

> Warning to surface in the UI: two tires can both say `20"` (or `26"`) yet have
> different ISO bead diameters and **not fit the same rim**. ISO is the truth.

### Format notes
- **ETRTO/ISO**: `width-bead`, e.g. `37-622`. Unambiguous.
- **French**: `700 × 35C` — the `700` is a nominal outer diameter, the letter
  (A/B/C) is an old width code, not the ISO diameter. `700C` → 622 mm bead.
- **Inch (decimal)**: `26 × 2.10`. The decimal is the width.
- **Inch (fractional)**: `26 × 1 3/8` — a *different* system from decimal;
  `26 × 1 3/8` (590 mm) ≠ `26 × 1.375` decimal. Handle carefully.

### Rolling circumference (also = speedometer / bike-computer calibration value)
Approximate outer diameter: `bead_diameter + 2 × tire_height`, where tire height
≈ tire width (round-ish casing) — adjust with a section-height factor if known.
`circumference = π × outer_diameter`. Prefer a **measured roll-out** when the
number matters. Maintain a small table of measured circumferences for common
sizes.

Surface this circumference explicitly as the **wheel-size value (mm) to enter
into a bike computer / speedometer** so speed and distance read correctly — this
is a common workshop task. It's also the rolling circumference fed to the
[drivetrain calculator](drivetrain.md). Note that a measured roll-out (mark the
valve, roll one rev under rider weight, measure) is more accurate than the
calculated value.

## Part 2 — Pressure recommendation

Correct pressure depends mainly on **load on the tire** (rider + bike + gear,
split by weight distribution) and **tire width**; wider tires need less
pressure. Modern guidance targets a tire "drop" (sag) of ~15%.

### Inputs
- Total system weight (rider + bike + luggage), or rider weight + bike weight.
- Weight distribution front/rear (default ~40/60 for road, adjustable).
- Tire width (mm) per wheel; wheel/ISO size.
- Tube type: clincher w/ tube, tubeless, tubular.
- Surface / use: smooth tarmac, rough tarmac, gravel, off-road.

### Outputs
- Recommended **front** and **rear** pressures (bar and psi), typically rear
  higher than front because it carries more load.
- A sensible **range**, and never exceed the tire's or rim's stated max.

### Method
No single closed formula is authoritative; we implement a simple, transparent
load-based model (Berto ~15%-drop lineage) and say so:

- `pressure_bar ≈ 3.2 × (load_on_wheel_kg / tire_width_mm)`, clamped to a sane
  1.5–8.5 bar. The coefficient is calibrated so typical setups land in the right
  ballpark (e.g. ~40 kg on 25 mm ≈ 5 bar / ~75 psi; wide tires much lower).
- Then apply modifiers: tubeless ×0.88, tubular ×0.95; surface smooth ×1.0,
  rough ×0.92, gravel ×0.85, off-road ×0.78.
- Rear gets more load than front, so it comes out higher.

It's a **starting estimate**, presented as "adjust to feel". Not a manufacturer
chart — worth swapping for cited chart data later.

### Hard limits
- Clamp to the **tire sidewall min/max** and the **rim's max pressure** (esp.
  hooked vs hookless — hookless rims often cap at 72.5 psi / 5 bar). Warn loudly
  near limits.
