# Derailleur

Two things: a **searchable derailleur database** (look up the specs of a given
derailleur) and a **compatibility reference** chart of actuation families.

The **capacity / max-sprocket fit check** lives in the
[drivetrain calculator](drivetrain.md) instead — that's where you have a
cassette and crankset to check against. There you can pick a derailleur from the
database and it tells you whether your largest cog and total capacity are within
its limits.

> **All the spec data is approximate / sourced** (and actuation ratios are
> marketing-obscured). Each row cites a source; verify against the manufacturer
> before relying on it. The database is extendable — add rows to the JSON.

## Part 1 — Derailleur database

A searchable, filterable table of ~550 rear derailleurs. Search by brand /
model / series / discipline / speeds, and narrow with the **brand / type /
speeds** filters; each row shows the specs the tool knows: **brand + model**
(+ series), discipline, speeds, **cage length**, **max sprocket**, **total
capacity**, **actuation family**, **pull ratio**, **years** (introduced–
discontinued), and a **source link**. Unknown fields show "—"/"unknown". Raw
fields per entry (optional ones omitted when unknown):
`{ brand, model, series?, type, nominalSpeeds, cage?, maxLow?, minLow?, capacity?, pullRatio?, electronic?, introduced?, discontinued?, source }`.
The load step (`src/lib/derailleur.ts`) maps these to a `DerailleurSpec`,
generates a stable `key`, and **derives** the actuation family.

**Pull ratio** (actuation ratio ≈ derailleur lateral movement per unit of cable
pull): the display prefers the **sourced numeric `pullRatio`** on the row, and
falls back to a per-**family** estimate (`PULL_RATIOS`, via `pullRatioFor`) when
a row has none. The estimates are **disputed between sources and definitions** —
a rough guide, not gospel (≈1.7:1 old Shimano, ≈1.4:1 Shimano 11-sp road, ≈1.1:1
SRAM Exact Actuation, electronic groups have none). Verify before relying on it.

The **actuation family** is *derived* from brand + type + speeds + electronic,
so each row links to the compatibility chart. It's best-effort: third-party
brands (Microshift, Sunrace, L-TWOO, …) and ambiguous cases are left "unknown"
rather than guessed.

## Part 2 — Compatibility reference

A browsable table of rear derailleur (and shifter) families with:

- **Actuation / cable-pull ratio** — how much cog-lateral movement per unit of
  cable pulled. Shifter and derailleur must share a system for indexing to work.
- **Total capacity** (teeth) — the wrap the cage can take up.
- **Max sprocket** (largest cog the cage clears).
- **Min sprocket** where relevant.
- **Speeds** (8/9/10/11/12) and road vs MTB.

Systems that must match (indexing depends on it):

| System / family | Notes |
|---|---|
| Shimano road 1.7 (classic) | ≈1.7:1 — cross-compatible 6–10 incl. Dura-Ace 7700–7900 |
| Shimano road 1.9 (Dura-Ace 7400) | ≈1.9:1 — old Dura-Ace 7400-series only (6–8), own pull |
| Shimano road 1.4 (11-speed & Tiagra 4700) | ≈1.4:1 — 11-speed road **and** Tiagra RD-4700 (10s); not compatible with classic 1.7 |
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

## Capacity / range check (lives in the drivetrain calculator)

This part **is** exact and worth automating — and it needs a cassette + crankset,
so it's implemented on the [drivetrain page](drivetrain.md), where you pick a
derailleur from the database and it checks the fit. Kept here for reference.

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

### Speed-count compatibility
Alongside the capacity/max-cog fit, the drivetrain page judges the derailleur's
nominal speed count against the cassette's cog count by **actuation**
(`speedCompatibility` in `src/lib/derailleur.ts`). Each actuation family in
`DERAILLEUR_SYSTEMS` declares the speed counts it can drive (its `speeds` label,
e.g. `8/9/10`) — a family shares one cable-pull ratio, so a derailleur in it
indexes at any of those counts given the matching shifter. The verdict:
- **match** — nominal count equals the cassette's.
- **family** — a different count the family still covers → works with the
  matching same-family shifter (shown as info, not a warning).
- **friction** — mechanical, outside the family's counts → no indexed shifter
  lines up, but a friction shifter can (indexing lives in the shifter).
- **incompatible** — **electronic** groups shift in fixed pre-programmed steps
  and can't be re-indexed for another cog count (no friction fallback), so a
  mismatch is a hard no, not a "might work".
- **unknown** — third-party / underived family: can't judge from actuation.

### Cassette cog-pitch (spacing) compatibility
Matching the cog *count* isn't enough: the cassette must also be cut to the
**cog pitch** (centre-to-centre sprocket spacing) the drivetrain indexes to. An
11-speed Shimano/SRAM shifter+derailleur and an 11-speed **Campagnolo** cassette
share a cog count but have different pitch, so the indexed clicks don't line up
— it won't shift. Each cassette therefore carries a **spacing** standard
(`CassetteSpacing` in `src/lib/drivetrain.ts`), *derived* like the actuation
family (no per-row hand-editing; an explicit `spacing` in the JSON overrides):
- **shimano-sram** — the shared Shimano/SRAM HG pitch (7–12sp, road + MTB); what
  most cassettes use. (Shimano-12 and SRAM-12 differ only slightly and cross-work
  with a matched drivetrain, so they're one family here — the actuation-family
  check separates them where it matters.)
- **campagnolo** — Campagnolo's own pitch (distinct at each speed count). Third-
  party Campagnolo-compatible cassettes fall here too — they ship on a
  **Campagnolo freehub**, which is the derivation's strongest signal.
- **linkglide** — Shimano LinkGlide / CUES; its parts must be used together and
  are not interchangeable with Hyperglide (tagged via `special: "LinkGlide"`).
- **proprietary** — closed systems (Classified, Rotor 13…) that ship their own
  cassette; left unjudged so they never show a false "incompatible".

`fitCassette` compares the cassette's standard against the one the drivetrain's
actuation family expects (`expectedCassetteSpacing`) — from the shifter's family
when set, else the derailleur's. A clash is a hard **incompatible** with reason
`spacing`. It's skipped (unjudged) for custom cog lists, friction shifters
(which index nothing, so any pitch works), and proprietary cassettes.

## Notes
- Also useful: front derailleur compatibility (clamp diameter, pull direction,
  top/down swing, max chainring, capacity) — a future addition.
- Link out to reputable compatibility references and keep the data file dated so
  it is clear when it was last verified.
