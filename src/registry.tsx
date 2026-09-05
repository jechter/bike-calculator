import React from "react";
import { Drivetrain } from "./components/Drivetrain";
import { WheelBuilding } from "./components/WheelBuilding";
import { FrameSize } from "./components/FrameSize";
import { Tire } from "./components/Tire";
import { Derailleur } from "./components/Derailleur";
import { Power } from "./components/Power";
import { ThreadDirection } from "./components/ThreadDirection";
import {
  DrivetrainIcon,
  WheelIcon,
  FrameIcon,
  TireIcon,
  DerailleurIcon,
  PowerIcon,
  ThreadIcon,
} from "./icons";

export interface CalculatorDef {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  Component: React.ComponentType;
}

export const CALCULATORS: CalculatorDef[] = [
  {
    id: "drivetrain",
    title: "Drivetrain",
    subtitle:
      "Gear ratios, speed at cadence, chain length and chain wear — cassette, single speed or geared hub.",
    icon: <DrivetrainIcon />,
    Component: Drivetrain,
  },
  {
    id: "wheel-building",
    title: "Wheel Building",
    subtitle: "Spoke lengths for a hub + rim + lacing, plus a spoke-tension converter.",
    icon: <WheelIcon />,
    Component: WheelBuilding,
  },
  {
    id: "frame-size",
    title: "Frame Size",
    subtitle: "Frame size, saddle height and crank length from inseam or body height.",
    icon: <FrameIcon />,
    Component: FrameSize,
  },
  {
    id: "tire",
    title: "Tire",
    subtitle: "Convert tire size formats and recommend a pressure.",
    icon: <TireIcon />,
    Component: Tire,
  },
  {
    id: "derailleur",
    title: "Derailleur",
    subtitle: "Look up derailleur specs, plus a compatibility reference.",
    icon: <DerailleurIcon />,
    Component: Derailleur,
  },
  {
    id: "power",
    title: "Cycling Power",
    subtitle: "Watts needed for a speed and gradient — and speed from watts.",
    icon: <PowerIcon />,
    Component: Power,
  },
  {
    id: "thread-direction",
    title: "Thread Direction",
    subtitle: "Which parts are left-hand threaded, and which way to turn.",
    icon: <ThreadIcon />,
    Component: ThreadDirection,
  },
];
