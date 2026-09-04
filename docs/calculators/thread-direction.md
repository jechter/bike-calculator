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

## Scope: only pedals and bottom brackets

**Everything else on a bike is normal (right-hand) thread** — cassette lockrings,
freewheels, rotor lockrings, freehub bolts, crank bolts, etc. all loosen
anti-clockwise. So the page lists only the parts that actually have left-hand
threads: **pedals** and **bottom brackets**.

### Layout

**One row per component**, with a **Left / non-drive** and **Right / drive**
column showing each side's thread hand (RH/LH). Left-hand cells are highlighted.
Hovering (or tapping) a side updates a **big rotation diagram** that shows, from
the correct viewpoint, which way to turn **to loosen** (green) and **to tighten**
(grey).

| Component | Left / non-drive | Right / drive |
|-----------|------------------|---------------|
| Pedal | **LH** (fixed side is the gotcha) | RH |
| English / BSA (1.37"×24T) | RH (adjustable cup) | **LH** (fixed cup) |
| Italian (36mm×24T) | RH | RH |
| Swiss | RH | **LH** |
| French | RH | RH |

(LH = clockwise to loosen; RH = anti-clockwise to loosen, from the side you face.)

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
- Highlight the left-hand gotchas (left pedal, English drive-side cup, Italian
  mix-up). No search — the list is short enough to scan.
- Optional torque cross-link: if a **torque calculator / spec reference** is
  added (see [additional-ideas.md](../additional-ideas.md)), link each part to
  its torque spec.
- Keep the data in a single **cited, dated data module** and let items be
  corrected — thread standards (especially older BB/pedal variants) have
  exceptions, and marketing/regional differences exist.
