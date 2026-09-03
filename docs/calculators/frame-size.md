# Frame Size Calculator

Answers: when picking a bike for someone, what frame size should you look for?
Estimates ideal frame size (and a starting saddle height and crank length) from
**inseam** or **body height**, for different frame styles.

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

- **Recommended frame size**, given in the unit that style is usually sold in:
  - Road/gravel/touring: seat-tube length in **cm**, plus the nominal S/M/L etc.
  - MTB: usually **inches** or S/M/L.
  - Hybrid/city: cm or S/M/L.
- A **range** rather than a single number, plus the neighbouring sizes.
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

When only body height is known, **translate it to an approximate inseam**
(cycling inseam ≈ 47% of height) and then run the exact same inseam-based logic
above. This keeps the two methods **consistent** and makes height sizing
style-aware too (the old separate height→size table ignored frame style). Show
the estimated inseam and note that a measured inseam is more accurate.

```
inseam_cm ≈ height_cm × 0.47
```

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
