# Wheel Building Calculator

Two jobs: (1) what spoke length(s) do I need to lace this hub to this rim with
this spoke pattern, and (2) a **spoke tension converter** for tensiometer
readings. Front and rear wheels are asymmetric, so left and right sides usually
need **different** lengths (and, by design, different tensions).

## Inputs

Grouped into a **Rim** section and a **Hub** section, each with an
approximate-preset picker (common rims / common hubs) that fills the fields —
always overridable, and clearly flagged as starting points to measure against.

**Rim** section:

- **ERD** — Effective Rim Diameter (mm). The diameter at which the spoke ends
  sit (nipple seat), the single most important and error-prone number. Must be
  measured or taken from the rim spec, **not** the bead/tire diameter. The rim
  preset fills a rough ERD by wheel size.
- **Spoke-hole offset (alternating drilling)** (mm) — many rims are drilled with
  each hole nudged a little toward the flange it feeds, alternating left/right
  around the rim, so the spoke enters the bed straighter. This drives the 3D
  view's rim-hole placement (0 = a plain centre-drilled rim). It's a small axial
  shift at the rim bed; it does **not** meaningfully change the computed spoke
  length, so the length formula ignores it (as do the standard calculators).

**Hub** section (spoke count, hole diameter, and per side L/R):

- **Spoke count** `n` (e.g. 32, 36, 28, 24) and **spoke hole diameter** on the
  flange (usually 2.6 mm).
- Per side (left/non-drive and right/drive):
  - **Flange diameter** — the diameter of the circle through the spoke holes on
    the flange (mm), a.k.a. PCD. Use radius `R = flange_diameter / 2`.
  - **Flange offset / centre-to-flange** (`W`, mm) — distance from the wheel
    centreline to the flange. Drive and non-drive differ on a dished wheel.
  - **Lacing** — a single menu that combines the cross count with the pattern, so
    only buildable combinations are offered. It's grouped into:
    - **Radial** (0-cross).
    - **Crossed** — 1- to 4-cross, the usual alternating (1L1T) builds.
    - **Grouped & crow's foot** — the decorative patterns:
      - **2L2T / 3L3T / 4L4T** run two/three/four leading spokes together, then the
        same number trailing, giving the paired "clustered" look. Grouping only
        re-pairs which flange hole each spoke uses — **spoke length is unchanged**.
      - **Crow's foot** laces the flange in repeating groups of three: two crossed
        spokes flanking one radial spoke, so each group forms a bird's-foot /
        trident. Unlike the grouped patterns it produces **two spoke lengths per
        side** — the crossed spokes at the cross-length and the radial ones at the
        (shorter) 0-cross length.
    - The drive side's menu starts with **Same as left side** (the default), so a
      symmetric build needs only one choice; pick a specific entry to differ.
- The **hub preset** fills flange diameters, offsets and hole size for common
  hub types (road/MTB, front/rear, QR/Boost) — approximate; measure to confirm.

### Wheel diagram

The page renders the wheel as a **rotatable 3D view** — a WebGL rendering (a
box-section rim with a concave tyre channel and nipples seated in the bed, hub
barrel + flanges, and spokes with button heads on the flange faces) so you can
see how the inputs affect the spokes. Spokes are coloured by side (blue = left /
non-drive, red = right / drive) and shaded by weave role: light = leading,
medium = radial (a crow's foot's centre spokes), dark = trailing; nipples match
their spoke's colour. The legend spells out the shades, dropping the radial one
unless a crow's foot pattern is in use.

- **Drag** with the mouse to turn the wheel, and use the **zoom** slider to
  inspect the lacing at the hub.
- **Face** and **Side** buttons animate the view to a head-on lacing view or an
  edge-on view that shows the **dish** and bracing angles.

Raw WebGL, no 3D library — falls back to a short message where WebGL isn't
available.

A **build scrubber** (slider + play button) steps through lacing the wheel one
spoke at a time, in the order a wheel is actually built: drive-side first set
(heads-out, every other flange hole), then the non-drive first set, then the
drive-side crossing set, then the non-drive crossing set — each group filled in
around the wheel starting next to the valve. It follows the grouping in
[Sheldon Brown's wheelbuilding guide](https://www.sheldonbrown.com/wheelbuild.html).
It's a build-order guide, not a weave animation — the straight spokes don't show
the over/under of the crossing sets.

### Lacing feasibility

Two limits bound the cross count:

1. **Divisibility.** Symmetric cross lacing splits each side's `n/2` spokes into
   equal leading and trailing halves, so it needs `n/4` spokes per group — the
   count must be **divisible by 4**. Counts like 22 or 26 (`n/2` odd) can't be
   cross-laced at all: the alternation can't balance, and two spokes would be
   forced into the same flange hole. They lace **radially only**.
2. **Angle.** A `k`-cross spoke subtends `720°·k/n` at the hub; once that exceeds
   90° the spoke would have to wrap backwards. So for divisible counts the
   **maximum cross is `floor(n/8)`** (matching the standard tables: 32h → 4×,
   24h → 3×, 20h → 2×, 8h → 1×).

Grouped lacing (`g`L`g`T for a run length `g`) adds two more rules, on top of the
cross limits above, for it to stay a valid equal-length pattern on a normally
drilled hub and rim:

3. **Group divisibility.** Each flange must split into balanced runs of `g`
   leading and `g` trailing spokes, so the count must be **divisible by `4·g`**
   (2L2T → ÷8, 3L3T → ÷12, 4L4T → ÷16).
4. **Cross must be a multiple of `g`.** The angular shift between a group's two
   ends is `2k mod 2g`, which lands a leading and a trailing spoke in the *same*
   flange hole unless `k` is a multiple of `g`. So 2L2T needs an **even** cross
   (2×, 4×), 3L3T needs 3×, 4L4T needs 4×. Odd-cross grouped patterns are only
   buildable on a specially paired-drilled rim, which this calculator doesn't
   model. (Standard 1L1T has `g = 1`, so both rules vanish — any cross works.)

**Crow's foot** has its own rules (it's not a `g`L`g`T grouping):

5. **Count divisible by 6.** Three spokes per foot on each flange, so `n/2` must
   be divisible by 3 → `n` divisible by 6 (24, 36, 48h; 32h can't). Note this is
   independent of the ÷4 rule above — 18h, say, is radial-only for normal lacing
   but *can* take crow's foot.
6. **Crossed count `k` ≠ 1 (mod 3).** The two crossed spokes of a foot are shifted
   `±k` holes; `k ≡ 1 (mod 3)` lands one of them in the radial spoke's hole. So the
   crossed count must be **2 or 3** (with `k ≤ floor(n/8)`); 1-cross and 4-cross
   don't work.

The calculator validates the spoke count (even, ≥ 8), each side's cross, the
grouping and the crow's-foot rules; for an infeasible combination it shows an
error and hides the (meaningless) diagram and spoke lengths rather than drawing a
wheel that can't exist.

Grouped and crow's-foot lacing are largely **cosmetic** choices: bunching the
spoke pull (or mixing radial with crossed spokes) leaves the rim less evenly
supported, so they're generally considered slightly less structurally even than
standard alternating lacing.

## Outputs

- Spoke lengths per side, shown as **count × length** rows (e.g. `18 × 292 mm`) so
  the totals double as a shopping list. Standard/grouped lacing is one row per
  side (every spoke equal); **crow's foot** splits into two rows — the crossed
  spokes and the (shorter) radial spokes. Front and rear, and the two sides of a
  dished wheel, usually differ.
- Whether the chosen pattern is geometrically buildable (otherwise a warning
  replaces the diagram).

## Formula

Standard spoke-length geometry:

```
θ  = 720° × k / n                 # spoke crossing angle (degrees)
d1 = R × sin(θ)
d2 = (ERD / 2) − R × cos(θ)
d3 = W                            # flange offset from centreline
L  = sqrt(d1² + d2² + d3²) − (spoke_hole_diameter / 2)
```

Where:

- `R` = flange radius = flange_diameter / 2.
- `k` = number of crosses (0 for radial → θ = 0).
- `n` = total spoke count; each side has `n/2` spokes, which is why the
  angle uses `720° × k / n` (= `360° × k / (n/2)`).
- Subtract `spoke_hole_diameter / 2` (≈ 1.3 mm for a 2.6 mm hole) because the
  effective attachment point is the inner edge of the flange hole.

Compute **left and right independently** using each side's `R` and `W`.

## Worked example

Rear hub, 32 spokes, 3-cross both sides. Flange diameter 45 mm (`R` = 22.5),
spoke hole 2.6 mm, ERD 602 mm.

- θ = 720 × 3 / 32 = 67.5°
- Drive side offset `W` = 17.5 mm:
  - d1 = 22.5 × sin 67.5° = 20.78
  - d2 = 301 − 22.5 × cos 67.5° = 301 − 8.61 = 292.39
  - d3 = 17.5
  - L = √(20.78² + 292.39² + 17.5²) − 1.3 = √(431.8 + 85_492 + 306.3) − 1.3
    = √86_230 − 1.3 ≈ 293.7 − 1.3 ≈ **292.4 mm**
- Non-drive offset `W` = 34 mm → recompute d3; longer spokes (≈ **294 mm**).

(Exact values depend on the real hub/rim numbers; use as a sanity check of the
formula, not as a spec for any particular wheel.)

## Notes & caveats

- **ERD definition varies.** Some manufacturers quote ERD to the end of a
  reference nipple, others to the nipple seat. State which convention the tool
  assumes and let the user adjust; a 1–2 mm error here is the usual cause of
  spokes that are too long/short.
- Round toward the length that leaves the nipple slightly not-fully-threaded
  rather than a spoke poking through; when between sizes, most builders prefer
  ~1 mm short over long.
- Consider building in a **hub/rim database** of common components so users can
  select rather than measure, but always allow manual entry.
- Straight-pull hubs and asymmetric rims change the geometry slightly; note
  these as future enhancements.

## Spoke tension converter

Most tensiometers read a **deflection number** on their own scale, which must be
converted to actual tension (kgf or N) using a table specific to that tool and
the spoke's shape/gauge. This is a natural companion to building the wheel.

### Inputs
- **Tensiometer model** (each brand/tool has its own conversion table).
- **Spoke type/gauge**: round (e.g. 2.0 / 1.8 / 1.6 mm) or bladed with its
  cross-section, since the conversion depends on spoke stiffness.

### Output — the conversion as a graph
Rather than typing a single deflection number and reading one tension out, the
converter draws the whole tool + spoke curve as a graph: **deflection reading on
the x-axis, tension (kgf) on the y-axis**. Hovering (or dragging, on touch)
snaps a crosshair onto the curve and shows the exact `reading → kgf · N` pair.

Because it's a graph it reads **both ways**: pick a deflection on the x-axis and
read up to its tension, or pick a target tension on the y-axis and read across
to the deflection you're aiming for. The curve spans only the readings that
spoke measures meaningfully, so out-of-range values simply aren't offered —
choose a spoke size that lands your build tension inside the curve. Tension is
shown in both kgf and N (`1 kgf ≈ 9.81 N`); compare against the rim
manufacturer's max spoke tension (rim-limited, typically ~100–120 kgf). On
dished (rear, or disc front) wheels the two sides sit at different tensions by
design.

### Notes
- The conversion tables are **tool- and spoke-specific data** — store them as
  cited data keyed by tool + spoke type; do not reproduce from memory. Let the
  user pick their tool, or enter a custom table/curve.
- Readings are nonlinear; the graph interpolates linearly between table points
  rather than assuming a single straight line across the whole range.
- Pairs with the spoke-length output above so a full build (lengths + target
  tension + balance) is covered in one calculator.
