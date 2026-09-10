# Bike Workshop Calculator

A single web page collecting the calculators most commonly needed when working
on bikes in a community workshop. Instead of googling for a different calculator
every time, everything lives in one place with a sidebar to pick the task.

## Motivation

Working on bikes in a community workshop, you repeatedly need small
calculations: what gear ratios a drivetrain gives, what spoke length a wheel
needs, what frame size fits a person, how to convert a tyre marking, whether a
derailleur is compatible, and so on. This project brings those together in one
tool that is trustworthy, consistent, and offline-capable.

## Goals

- **One page, many calculators.** A sidebar lists all calculators; selecting one
  shows its inputs and results in the main area.
- **Correct and transparent.** Every calculator documents the formula and
  reference data it uses (see [`docs/`](docs/)). Where results are approximate
  (frame sizing, tyre pressure), the tool says so.
- **Fast and offline.** No account, no server round-trips for a calculation.
  Should work on a shop laptop or phone with flaky wifi.
- **Metric and imperial.** The workshop is metric-first, but tyres, torque and
  frame sizes routinely appear in inches/psi, so support both.

## Calculators

| # | Calculator | What it answers | Spec |
|---|-----------|-----------------|------|
| 1 | Drivetrain | Gear ratios, speed at cadence, gear inches/development (cassette, single speed, or geared hub), chain length, chain wear | [drivetrain.md](docs/calculators/drivetrain.md) |
| 2 | Wheel building | Spoke lengths for a given hub + rim + lacing, plus spoke tension converter | [wheel-building.md](docs/calculators/wheel-building.md) |
| 3 | Frame size | Frame size / saddle height / crank length from inseam or body height | [frame-size.md](docs/calculators/frame-size.md) |
| 4 | Tyre | Convert tyre size formats; recommend pressure | [tire.md](docs/calculators/tire.md) |
| 5 | Derailleur compatibility | Pull ratios, capacity, max sprocket reference | [derailleur-compatibility.md](docs/calculators/derailleur-compatibility.md) |
| 6 | Cycling power | Watts needed for a speed/gradient, and speed from watts | [power.md](docs/calculators/power.md) |
| 7 | Thread direction | Reference: which parts are left-hand threaded, and which way to turn to loosen/tighten | [thread-direction.md](docs/calculators/thread-direction.md) |

See [docs/additional-ideas.md](docs/additional-ideas.md) for further calculators
and reference tools worth adding.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — page layout, navigation, and
  suggested tech approach.
- [`docs/calculators/`](docs/calculators/) — one spec per calculator with
  inputs, outputs, formulas, and reference data.
- [`docs/additional-ideas.md`](docs/additional-ideas.md) — ideas beyond the
  initial six.

## Running locally

Requires Node 18+.

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check and build the static site into dist/
npm run preview  # preview the production build
npm test         # run the calculation unit tests (Vitest)
```

For a quick visual check of a page (headless Chrome via `puppeteer-core`; set
`CHROME_PATH` to override the browser):

```bash
npm run build && npm run preview -- --port 4320 &
npm run screenshot -- '#/drivetrain' out.png '.gc-dot'   # route, output, optional hover selector
```

The build is a static site (`dist/`) that can be hosted anywhere or opened
offline; `vite.config.ts` uses a relative base so it works from any subpath.

## Tech

- **Vite + React + TypeScript**, all math client-side (no backend).
- Pure calculation modules live in [`src/lib/`](src/lib/) and are unit-tested
  against the worked examples in the calculator specs (`npm test`).
- UI components (one per calculator) live in [`src/components/`](src/components/);
  the sidebar/routing shell is [`src/App.tsx`](src/App.tsx) with a hash router so
  each calculator is bookmarkable (e.g. `#/drivetrain`).

## Status

All seven calculators implemented and building. Calculation functions are
covered by unit tests. Reference data flagged in the specs (IGH ratios,
tensiometer curves, derailleur actuation ratios) uses illustrative/placeholder
values that should be replaced with cited sources before relying on them.

## License

Released under the [MIT License](LICENSE).
