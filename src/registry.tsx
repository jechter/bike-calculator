import React from "react";
import { Drivetrain } from "./components/Drivetrain";
import { WheelBuilding } from "./components/WheelBuilding";
import { FrameSize } from "./components/FrameSize";
import { Tire } from "./components/Tire";
import { Derailleur } from "./components/Derailleur";
import { Power } from "./components/Power";
import { ThreadDirection } from "./components/ThreadDirection";

export interface CalculatorDef {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  kind: "calc" | "ref";
  Component: React.ComponentType;
}

export const CALCULATORS: CalculatorDef[] = [
  {
    id: "drivetrain",
    title: "Drivetrain",
    subtitle:
      "Gear ratios, speed at cadence, chain length and chain wear — cassette, single speed or geared hub.",
    icon: "⚙️",
    kind: "calc",
    Component: Drivetrain,
  },
  {
    id: "wheel-building",
    title: "Wheel Building",
    subtitle: "Spoke lengths for a hub + rim + lacing, plus a spoke-tension converter.",
    icon: "🛞",
    kind: "calc",
    Component: WheelBuilding,
  },
  {
    id: "frame-size",
    title: "Frame Size",
    subtitle: "Frame size, saddle height and crank length from inseam or body height.",
    icon: "📏",
    kind: "calc",
    Component: FrameSize,
  },
  {
    id: "tire",
    title: "Tire",
    subtitle: "Convert tire size formats and recommend a pressure.",
    icon: "🔵",
    kind: "calc",
    Component: Tire,
  },
  {
    id: "derailleur",
    title: "Derailleur",
    subtitle: "Capacity / max-sprocket check and a compatibility reference chart.",
    icon: "🔗",
    kind: "calc",
    Component: Derailleur,
  },
  {
    id: "power",
    title: "Cycling Power",
    subtitle: "Watts needed for a speed and gradient — and speed from watts.",
    icon: "⚡",
    kind: "calc",
    Component: Power,
  },
  {
    id: "thread-direction",
    title: "Thread Direction",
    subtitle: "Which parts are left-hand threaded, and which way to turn.",
    icon: "🔩",
    kind: "ref",
    Component: ThreadDirection,
  },
];
