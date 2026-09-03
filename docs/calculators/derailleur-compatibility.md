# Derailleur Compatibility

A reference chart plus a small compatibility check. Answers: will this shifter,
derailleur, and cassette work together, and can the derailleur handle this gear
range?

> **Actuation/pull ratios are notoriously fiddly and marketing-obscured.** The
> tool must cite sources and let the user override values, rather than present
> them as gospel. Treat the numbers below as a starting reference to verify, not
> a final authority.

## Part 1 — Reference chart

A browsable/filterable table of rear derailleur (and shifter) families with:

- **Actuation / cable-pull ratio** — how much cog-lateral movement per unit of
  cable pulled. Shifter and derailleur must share a system for indexing to work.
- **Total capacity** (teeth) — the wrap the cage can take up.
- **Max sprocket** (largest cog the cage clears).
- **Min sprocket** where relevant.
- **Speeds** (8/9/10/11/12) and road vs MTB.

Systems that must match (indexing depends on it):

| System / family | Notes |
|---|---|
| Shimano road 8/9/10-speed | "old" road pull ratio (pre-2016-ish) |
| Shimano road 11-speed | different pull ratio again — not cross-compatible with 10sp |
| Shimano MTB 8/9-speed | shares the older ratio with road of the same era |
| Shimano MTB 10-speed Dynasys | changed ratio — not compatible with road 10sp |
| Shimano MTB 11/12-speed (Hyperglide+ / Micro Spline) | own standards |
| SRAM "Exact Actuation" (road 10/11, older MTB) | ~1.1:1 family |
| SRAM 1:1 (older MTB) | 1:1 pull |
| SRAM road 12-speed (eTap/AXS, mechanical) | own standard |
| SRAM Eagle (MTB 12-speed, X-Actuation) | own standard |
| Campagnolo 9/10/11/12-speed | Campagnolo-specific; generally not interchangeable with Shimano/SRAM |

**Do not hardcode exact pull-ratio numbers from memory.** Populate the table from
a cited, maintained source and store it as data. The safe, universally-true rule
to lead with: *shifter and rear derailleur must be from the same actuation
family, and the cassette speed-count must match the shifter.* Cross-brand
"mullet"/hacked combos exist but should be flagged as non-standard.

## Part 2 — Capacity / range check

This part **is** exact and worth automating.

### Inputs
- Chainrings: largest & smallest tooth count (1× → both equal).
- Cassette: largest & smallest cog.
- Derailleur's rated **total capacity** and **max sprocket** (from the chart or
  entered manually).

### Formula
```
total_capacity_required = (largest_chainring − smallest_chainring)
                        + (largest_cog − smallest_cog)
```

### Checks / outputs
- `total_capacity_required ≤ derailleur_rated_capacity` → OK, else the chain
  will be too slack in small-small or too tight in big-big.
- `largest_cog ≤ derailleur_max_sprocket` → the cage clears the biggest cog.
- For 1× a short-cage may suffice despite a wide cassette because there is no
  front difference — the formula shows this naturally.
- Report the numbers so the user sees the margin, not just pass/fail.

### Worked example
2×, 50/34 rings, 11–32 cassette:
`(50−34) + (32−11) = 16 + 21 = 37T` capacity required → needs a medium/long
cage (≥37T capacity), and max sprocket ≥ 32T.

## Notes
- Also useful: front derailleur compatibility (clamp diameter, pull direction,
  top/down swing, max chainring, capacity) — a future addition.
- Link out to reputable compatibility references and keep the data file dated so
  it is clear when it was last verified.
