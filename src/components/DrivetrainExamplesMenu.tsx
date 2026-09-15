import { ExamplesMenu, type ExampleGroup } from "./ExamplesMenu";

// Ready-made drivetrains for the "Load an example" header menu. Each is the set
// of URL params it differs from the defaults by; see ExamplesMenu. `shf` is the
// paired shifter, encoded as "family~speeds".
const EXAMPLE_PRESETS: ExampleGroup[] = [
  {
    label: "Derailleur gears",
    presets: [
      {
        label: "Ultegra 2×11 road",
        params: {
          cog: "11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28",
          cix: "547",
          der: "shimano-rd-r8000-ss-11s",
          shf: "Shimano road 1.4 (11-speed & Tiagra 4700)~11",
        },
      },
      {
        label: "XT 3×9 MTB",
        params: {
          cr: "48, 36, 26",
          cog: "11, 13, 15, 17, 20, 23, 26, 30, 34",
          cix: "518",
          der: "shimano-rd-m770-sgs-9s",
          shf: "Shimano MTB 6/7/8/9-speed~9",
          circ: "2091",
          tire: "26x2.1",
        },
      },
      {
        label: "GRX 1×12 gravel",
        params: {
          cr: "40",
          cog: "10, 12, 14, 16, 18, 21, 24, 28, 33, 39, 45, 51",
          cix: "487",
          der: "shimano-rd-rx822-sgs-12s",
          shf: "Shimano road 12-speed~12",
          circ: "2237",
          tire: "45-622",
        },
      },
    ],
  },
  {
    label: "Single speed & hub gears",
    presets: [
      {
        label: "Single speed 42×16",
        params: { mode: "single", sc: "16" },
      },
      {
        label: "Nexus 8 city",
        params: { mode: "hub", sr: "46", sc: "22", hub: "2", circ: "2249", tire: "47-622" },
      },
      {
        label: "Pinion trekking",
        params: { mode: "hub", sr: "39", sc: "28", hub: "5", circ: "2205", tire: "40-622" },
      },
    ],
  },
];

export function DrivetrainExamplesMenu() {
  return <ExamplesMenu route="drivetrain" groups={EXAMPLE_PRESETS} />;
}
