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

**Hub** section (spoke count, hole diameter, and per side L/R):

- **Spoke count** `n` (e.g. 32, 36, 28, 24) and **spoke hole diameter** on the
  flange (usually 2.6 mm).
- Per side (left/non-drive and right/drive):
  - **Flange diameter** — the diameter of the circle through the spoke holes on
    the flange (mm), a.k.a. PCD. Use radius `R = flange_diameter / 2`.
  - **Flange offset / centre-to-flange** (`W`, mm) — distance from the wheel
    centreline to the flange. Drive and non-drive differ on a dished wheel.
  - **Cross pattern** `k` (e.g. 3-cross, 2-cross, radial = 0).
- The **hub preset** fills flange diameters, offsets and hole size for common
  hub types (road/MTB, front/rear, QR/Boost) — approximate; measure to confirm.

### Wheel diagram

The page renders the wheel as a **rotatable 3D view** — a WebGL rendering (a
box-section rim with a concave tyre channel and nipples seated in the bed, hub
barrel + flanges, and spokes with button heads on the flange faces) so you can
see how the inputs affect the spokes. Spokes are coloured by side, with a
lighter shade for outer-laced (heads-out) and a darker shade for inner-laced
(heads-in) spokes; nipples match their spoke's colour.

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

The calculator validates the spoke count (even, ≥ 8) and each side's cross; for an
infeasible combination it shows an error and hides the (meaningless) diagram and
spoke lengths rather than drawing a wheel that can't exist.

## Outputs

- Spoke length per side, rounded to the nearest mm (or nearest even mm depending
  on availability). Typically report left and right separately.
- Optionally: whether the pattern is geometrically valid (e.g. radial lacing on
  a disc/drive flange is discouraged).

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
