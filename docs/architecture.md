# Architecture

## Page layout

A two-pane layout:

```
+----------------------+-------------------------------------------+
|  Sidebar             |  Calculator view                          |
|                      |                                           |
|  • Drivetrain        |   <title of selected calculator>          |
|  • Wheel building    |                                           |
|  • Frame size        |   [ inputs ]                              |
|  • Tyre              |                                           |
|  • Derailleur compat |   [ results ]                            |
|  • Cycling power     |                                           |
|  • Thread direction  |   [ notes / formula reference ]           |
|                      |                                           |
+----------------------+-------------------------------------------+
```

- **Sidebar**: fixed list of entries. Selecting one swaps the main view. Most
  entries are calculators; some are **reference pages** (e.g. thread direction)
  that show a chart rather than take inputs. On narrow screens the sidebar
  collapses to a top menu / hamburger.
- **Main view**: the inputs and live results for the selected calculator, or the
  chart for a reference page. Results update as inputs change (no explicit
  "calculate" button needed).
- **Section info**: each section can carry the formula/caveats behind a small
  **ⓘ icon** next to its title, revealed in a popover on hover or click. This
  keeps results auditable without cluttering the page with permanent note boxes.
  (Live validation messages — e.g. "height outside the table range" — stay inline
  rather than hiding in a popover.)

## Navigation & state

- The selected calculator should be reflected in the URL (e.g. hash route
  `#/drivetrain`) so a specific calculator can be bookmarked and shared.
- Inputs can persist in `localStorage` so the shop's common setups
  (e.g. 700c wheel size, typical rider weight) survive reloads.

## Cross-cutting concerns

- **Units.** A shared units helper handles mm↔inch, kg↔lb, km/h↔mph, bar↔psi,
  Nm↔in·lbf. Each calculator picks sensible defaults but lets the user switch.
- **Shared reference data.** Wheel/tyre ISO (ETRTO) sizes, tyre circumferences,
  and component tables are shared modules used across calculators (the
  drivetrain, tyre, and wheel calculators all need wheel dimensions).
- **Validation.** Guard against divide-by-zero and nonsensical inputs; show a
  clear message rather than `NaN`.
- **Precision.** Show results to a practical precision (e.g. spoke lengths to
  the nearest mm, pressures to the nearest 0.1 bar) and state rounding rules
  (e.g. chain length rounds to an even number of inches / whole links).

## Suggested tech approach

Kept deliberately simple so it is easy to host and maintain:

- **Static site**, no backend required. All math runs client-side.
- A lightweight framework (e.g. React/Vue/Svelte) or even vanilla + a small
  router is fine; the app is mostly forms and formulas.
- Deployable to any static host (GitHub Pages, Netlify, or a file on a shop
  machine). Should function fully offline; consider a service worker / PWA so it
  can be "installed" on the shop tablet.
- Pure calculation functions kept separate from UI and **unit-tested** against
  the worked examples in each calculator's spec. The physics/geometry is the
  part worth getting demonstrably right.

## Repository layout (proposed)

```
/                     project root
  README.md
  docs/               these specs
  src/
    lib/              pure calculation + reference-data modules (tested)
    components/       UI per calculator
    App                shell + sidebar routing
  test/               unit tests referencing worked examples in docs/
```
