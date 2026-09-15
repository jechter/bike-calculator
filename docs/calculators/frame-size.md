# Frame Size Calculator

Answers, in **either direction**:

- **Rider → size**: when picking a bike for someone, what frame size should you
  look for? Estimates ideal frame size (and a starting saddle height and crank
  length) from **inseam** or **body height**, for different frame styles.
- **Size → rider** (reverse): a bike lands on the bench — who does it fit? Enter
  the frame size and get back the rider **height** and **inseam** band to match
  against the waiting list. This is the same rules of thumb run backwards (see
  [Reverse](#reverse-size--who-it-fits)).

> These are **starting estimates**, not prescriptions. Fit depends on torso/arm
> length, riding style, and geometry that varies between brands. Always confirm
> with a test ride and adjust. The tool should say this clearly.

## Inputs

- **Measurement**: inseam (cycling inseam, measured barefoot crotch-to-floor,
  ideally with a book pulled up firmly) — most reliable — **or** body height.
- **Frame style**: Road / Endurance, Mountain (hardtail/full-sus), Gravel/Cross,
  Hybrid/City, Touring. Different styles size differently.
- **Units**: cm/inches.

## Outputs

- **Recommended frame size** as seat-tube length, always in **cm** (that's how we
  measure a frame at the bench), plus the nominal S/M/L. For **MTB** the inch size
  (how MTB frames are usually labelled) is shown small underneath the cm value in
  the same box.
- A **range** rather than a single number, plus the neighbouring sizes.
- **Nominal size** (XS/S/M/L/XL) is derived from the **rider's inseam**, not the
  style-scaled frame cm — so a given rider gets the same nominal label on a road
  bike or an MTB (their seat-tube numbers differ, but "Medium" means the same
  rider). Deriving it from the frame cm was a bug: MTB's smaller multiplier
  pushed tall riders into XS.
- **Starting saddle height** (LeMond method): `inseam × 0.883` measured from the
  centre of the bottom bracket to the top of the saddle, along the seat tube.
- **Standover guidance**: note minimum standover clearance (a few cm below
  inseam for road, more for MTB).
- **Suggested crank length** (see below), since it follows from leg length and
  pairs with the drivetrain gain-ratio calc.

## Formulas (inseam-based, approximate)

Let `I` = inseam in cm.

```
Road frame size (cm, seat tube c–t)   ≈ I × 0.665
MTB frame size (cm)                    ≈ I × 0.57   (or ×0.226 for inches)
Saddle height (BB to saddle top, cm)   = I × 0.883   (LeMond)
```

These constants are the widely-used rules of thumb (Hinault/LeMond lineage).
Sources differ by a few percent; present the result as a small range
(e.g. ±1 size).

## From body height

When only body height is known, **translate it to an approximate inseam** and
then run the exact same inseam-based logic above. This keeps the two methods
**consistent** and makes height sizing style-aware too (the old separate
height→size table ignored frame style). The estimated inseam is shown next to
the height input; a measured inseam is more accurate.

```
inseam_cm ≈ height_cm × leg_proportion   (leg_proportion default ≈ 0.47)
```

### Gender / leg proportion

Gender isn't asked directly, because it doesn't change the geometry — frame size
follows from **leg length**. What differs on average is **proportion**: for a
given height women tend to have proportionally longer legs (and shorter
torso/reach). So the only place it matters here is the **height → inseam**
estimate, offered as a *leg proportion* selector (Average ≈47%, Longer legs ≈49%,
Shorter legs ≈45%) — the swing is large (a full frame size across the range), so
it's worth setting. It has **no effect** once an inseam is measured. Torso/reach
(the other "women's-specific" fit difference) isn't modelled here — this tool
sizes the frame and saddle height, not reach/stack.

## Reverse: size → who it fits

The workshop case: you have a frame (often a donation) and a waiting list, and
want to know who to call. Every forward formula is a straight multiply, so the
reverse is a divide — the two directions stay perfectly consistent.

```
inseam_cm  = frame_cm ÷ style_multiplier        (e.g. road ÷ 0.665)
inseam band = (frame_cm ± 1.5) ÷ style_multiplier   (forward ±1.5 cm range, inverted)
height_cm  = inseam_cm ÷ leg_proportion          (default ≈ 0.47)
```

- **Input**: frame size read at the bench — seat-tube cm for most bikes, or
  **inches** for MTB frames (converted × 2.54 before dividing). Frame style still
  matters: the same seat-tube cm belongs to a longer leg on an MTB than on a road
  bike, because the MTB multiplier is smaller.
- **Output**: a rider **height** band and **inseam** band, plus the nominal
  S/M/L and the starting saddle height for the central inseam. Match the list on
  **inseam** — it's the reliable figure. The height band is inseam ÷ leg
  proportion, so it slides if the rider's legs are longer/shorter than average;
  the leg-proportion selector shifts the height band only (the inseam band is
  unchanged), same as the height→inseam estimate in the forward direction.
- Riders near a size boundary can go either way (smaller = nimbler, larger =
  roomier), so the band edges are soft.

## Crank length suggestion

Crank length scales with leg length; there's no consensus formula, so present a
**range** and lean toward what's actually available (cranks come in ~2.5 mm
steps, commonly 165/170/172.5/175 mm). Recent fitting trends favour **shorter**
cranks than these rules of thumb suggest.

### From inseam `I` (cm) — common rules of thumb
```
crank_mm ≈ I × 1.25 mm            (Machine Head / "×1.25")
crank_mm ≈ (I × 10 × 0.216)       (another common factor, ~0.21–0.22 × inseam_mm)
```
Both land in a similar range; show the range and round to the nearest available
size. Example: inseam 84 cm → ~1.25 × 84 ≈ 105… (these factors diverge — treat
the output as a **starting suggestion**, not a spec, and note the shorter-crank
trend).

> Because published crank-sizing formulas disagree noticeably, the tool should
> show a suggested range with the neighbouring available sizes and a clear
> "personal preference / fit dominates" caveat, rather than a single number.
> Also note practical limits: pedal/ground clearance and knee comfort. Feeds the
> [drivetrain gain-ratio calc](drivetrain.md), which uses crank length.

## Notes

- Prefer **inseam** over height when available — height alone hides big
  differences in leg length.
- Output should explain what the number means (seat tube c–t vs c–t-of-top-tube
  vs "size label"), since brands are inconsistent.
- Consider also outputting a rough **reach/stack** hint or "between two sizes →
  choose smaller for agility / larger for comfort" guidance.
