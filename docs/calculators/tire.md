# Tyre Calculator

Two jobs:

1. **Convert tyre size** between the formats you find stamped on tyres and rims.
2. **Recommend a tyre pressure** for a given rider, tyre, and use.

## Part 1 — Size conversion

Tyre and rim sizing is a mess of legacy systems. The reliable one is **ETRTO /
ISO** (`width-bead_diameter`, e.g. `25-622`). Everything else maps to it.

### Inputs
- A tyre size in any supported format, or width + ISO bead diameter.

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

> Warning to surface in the UI: two tyres can both say `20"` (or `26"`) yet have
> different ISO bead diameters and **not fit the same rim**. ISO is the truth.

### Format notes
- **ETRTO/ISO**: `width-bead`, e.g. `37-622`. Unambiguous.
- **French**: `700 × 35C` — the `700` is a nominal outer diameter, the letter
  (A/B/C) is an old width code, not the ISO diameter. `700C` → 622 mm bead.
- **Inch (decimal)**: `26 × 2.10`. The decimal is the width.
- **Inch (fractional)**: `26 × 1 3/8` — a *different* system from decimal;
  `26 × 1 3/8` (590 mm) ≠ `26 × 1.375` decimal. Handle carefully.

### Rolling circumference (also = speedometer / bike-computer calibration value)
Approximate outer diameter: `bead_diameter + 2 × tyre_height`, where tyre height
≈ tyre width (round-ish casing) — adjust with a section-height factor if known.
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

Correct pressure depends mainly on **load on the tyre** (rider + bike + gear,
split by weight distribution) and **tyre width**; wider tyres need less
pressure. Modern guidance targets a tyre "drop" (sag) of ~15%.

### Inputs
- Total system weight (rider + bike + luggage), or rider weight + bike weight.
- Weight distribution front/rear (default ~40/60 for road, adjustable).
- Tyre width (mm) per wheel; wheel/ISO size.
- Tube type: clincher w/ tube, tubeless, tubular.
- Surface / use: smooth tarmac, rough tarmac, gravel, off-road.

### Outputs
- Recommended **front** and **rear** pressures (bar and psi), typically rear
  higher than front because it carries more load.
- A sensible **range**, and never exceed the tyre's or rim's stated max.

### Method
No single closed formula is authoritative; implement a load-based model and be
explicit about it:

- Base the target on the **Frank Berto 15%-drop** tension data (the basis of most
  online tyre-pressure charts): for each tyre width, pressure scales with the
  load carried by that wheel.
- Then apply modifiers: **−10–15%** for tubeless, **lower** for rougher surfaces
  (rougher → lower for grip/comfort/lower rolling resistance), respect min/max.

Present it as: "based on ~15% tyre drop for your load and width; adjust to feel."
Cite the model (Berto / a reputable tyre-pressure guide) in the notes so the
number is defensible.

### Hard limits
- Clamp to the **tyre sidewall min/max** and the **rim's max pressure** (esp.
  hooked vs hookless — hookless rims often cap at 72.5 psi / 5 bar). Warn loudly
  near limits.
