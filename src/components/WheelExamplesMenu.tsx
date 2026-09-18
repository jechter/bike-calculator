import { ExamplesMenu, type ExampleGroup } from "./ExamplesMenu";

// Ready-made wheel builds for the "Load an example" header menu. Each is the set
// of URL params it differs from the defaults by; see ExamplesMenu.
const EXAMPLE_PRESETS: ExampleGroup[] = [
  {
    label: "Common lacings",
    presets: [
      { label: "36-spoke standard wheel", params: { n: "36" } },
      { label: "24-spoke road rear wheel", params: { n: "24" } },
      {
        label: "16-spoke radial front (rim brake)",
        params: {
          n: "16",
          lf: "39.8",
          lo: "34.8",
          ll: "radial",
          rf: "39.8",
          ro: "34.8",
          hub: "Chris King~R45 Front",
          hst: "front",
          hsw: "100",
        },
      },
    ],
  },
  {
    label: "Uncommon lacings",
    presets: [
      {
        label: "21-spoke Campagnolo G3",
        params: { rhg: "3", rgap: "6", n: "21", ratio: "2:1", ndsc: "1", xph: "1", ll: "radial", rl: "2x" },
      },
      {
        label: "36-spoke G4 lacing",
        params: { rhg: "4", rgap: "5", n: "36", xph: "1" },
      },
      {
        label: "12-spoke vintage Campagnolo Shamal",
        params: { n: "12", il: "0", lf: "30", ll: "radial", rf: "45", rl: "1x", hub: "none" },
      },
      {
        label: "64-spoke Yamaha XS650 Heritage",
        params: {
          erd: "502", n: "64", lf: "90", lo: "50", ll: "2l2t-4x", rf: "90", ro: "50",
          hub: "none", hst: "front", hsw: "110",
        },
      },
      {
        label: "140-spoke Bonanza",
        params: { erd: "502", rho: "5", n: "140", lf: "70", ll: "radial", rf: "70", hub: "none" },
      },
      {
        label: "Vintage Shimano paired spokes",
        params: {
          rho: "-15", rhg: "2", rgap: "6", rhp: "1", n: "16", il: "0", lf: "87.4", lo: "26.9",
          ll: "1x", rf: "87.4", ro: "26.9", hub: "none", hst: "front", hsw: "110",
        },
      },
      {
        label: "Rolf paired spokes",
        params: { rhg: "2", rgap: "6", n: "20", il: "0", lf: "65", ll: "2x", rf: "65", hub: "none" },
      },
      {
        label: "Crow's foot",
        params: { n: "36", lf: "70", ll: "cf-3x", rf: "70", hub: "none" },
      },
    ],
  },
];

export function WheelExamplesMenu() {
  return <ExamplesMenu route="wheel-building" groups={EXAMPLE_PRESETS} />;
}
