# Thread Direction Reference

Not a calculator — a quick-reference chart for **which way to turn** common
threaded bike parts to tighten or loosen, since several use **left-hand (LH /
reverse) threads** and getting it wrong rounds bolts or seizes parts. Kept handy
because it comes up constantly at the bench.

## The core rule

- **Right-hand (RH / normal) thread**: righty-tighty — turn **clockwise to
  tighten**, counter-clockwise to loosen. This is the default for almost
  everything.
- **Left-hand (LH / reverse) thread**: the opposite — turn **counter-clockwise
  to tighten**, clockwise to loosen.

"Clockwise" must always be stated **from a defined viewpoint** (e.g. "as you
face that side of the bike"), because the same part looks reversed from the other
side. The chart below fixes the viewpoint per item.

## Reference chart

Present as a filterable/searchable table. For each part: thread hand per side,
and the turn direction to **loosen/remove** (the thing people usually need).

| Part | Side | Thread | To LOOSEN, turn… | Notes |
|------|------|--------|------------------|-------|
| **Pedals** | Right / drive | RH (normal) | Counter-clockwise | Viewed from the drive side. |
| **Pedals** | Left / non-drive | **LH (reverse)** | **Clockwise** | The classic gotcha. |
| **Bottom bracket (English / BSA / BSC, 1.37"×24T)** | Right / drive (fixed cup) | **LH (reverse)** | **Clockwise** | Viewed from drive side. Drive-side cup is reverse-threaded. |
| **Bottom bracket (English / BSA)** | Left / non-drive (adjustable cup) | RH (normal) | Counter-clockwise | |
| **Bottom bracket (Italian, 36mm×24T)** | Both sides | RH (normal) | Counter-clockwise | *Both* cups are normal thread — a common mix-up vs English. |
| **Bottom bracket (French, Swiss, other)** | varies | varies | — | Rare; French = both RH, Swiss = drive side LH. Verify by standard. |
| **Cassette lockring** | — | RH (normal) | Counter-clockwise | Needs a chainwhip to hold the cassette. |
| **Freewheel (thread-on)** | — | RH (normal) | Counter-clockwise | It self-tightens when pedalling. |
| **Disc rotor lockring (Center Lock)** | — | RH (normal) | Counter-clockwise | Except Shimano external-spline lockrings, which loosen counter-clockwise like a cassette lockring. |
| **Right (drive) crank / non-square fixing bolts** | — | RH (normal) | Counter-clockwise | Self-extracting bolts vary; check. |
| **Left pedal spindle on some track/BMX** | left | LH | Clockwise | Same as normal pedals. |
| **Freehub body bolt / thru-axle / most bolts** | — | RH (normal) | Counter-clockwise | Default assumption when unlisted. |

> The two you'll reach for most: **left pedal** and the **drive-side cup of an
> English bottom bracket** are both **left-hand** (turn clockwise to loosen).

## Why LH threads exist here (worth a note in the UI)

Left-hand threads are used where normal rotation/precession would otherwise
**unscrew** a RH thread — the left pedal and the English BB drive-side cup are
reverse-threaded so pedalling forces tighten rather than loosen them. Knowing the
*reason* helps volunteers remember which parts are reversed.

## UI suggestions

- **Big, unambiguous arrows** and the words "to loosen / to tighten", plus the
  viewpoint ("as you look at this side of the bike").
- Let the user tap a part to expand notes and the *tighten* direction too.
- A prominent search/filter — at the bench you want the answer in one tap.
- Optional torque cross-link: if a **torque calculator / spec reference** is
  added (see [additional-ideas.md](../additional-ideas.md)), link each part to
  its torque spec.
- Keep the data in a single **cited, dated data module** and let items be
  corrected — thread standards (especially older BB/pedal variants) have
  exceptions, and marketing/regional differences exist.
