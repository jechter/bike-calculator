import React from "react";
import { Drivetrain } from "./components/Drivetrain";
import { WheelBuilding } from "./components/WheelBuilding";
import { WheelExamplesMenu } from "./components/WheelExamplesMenu";
import { DrivetrainExamplesMenu } from "./components/DrivetrainExamplesMenu";
import { FrameSize } from "./components/FrameSize";
import { Tire } from "./components/Tire";
import { Derailleur, ComponentProposalButton } from "./components/Derailleur";
import { Power } from "./components/Power";
import { ThreadDirection } from "./components/ThreadDirection";
import {
  DrivetrainIcon,
  WheelIcon,
  FrameIcon,
  TireIcon,
  ComponentsIcon,
  PowerIcon,
  ThreadIcon,
} from "./icons";

export interface CalculatorDef {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  Component: React.ComponentType;
  /** Hidden from the sidebar nav, but still reachable directly by URL. */
  hidden?: boolean;
  /** Encodes its config in the URL query — show a "Copy link" button (see
   *  useUrlConfigSync in the page component). */
  shareable?: boolean;
  /** Optional extra control(s) rendered in the page header, left of "Copy link". */
  HeaderActions?: React.ComponentType;
  /** The page renders its own heading (App skips the shared .main-head). */
  ownHeader?: boolean;
  /** Settings-on-the-left + visualization layout (uses <Workbench>). On mobile
   *  App shows a "Settings" toggle in the top bar that opens the controls drawer. */
  workbench?: boolean;
}

export const CALCULATORS: CalculatorDef[] = [
  {
    id: "drivetrain",
    title: "Drivetrain",
    subtitle:
      "Try and compare different bicycle drivetrain setups and visualize the gear ratios. Check components for compatibility, and calculate the ideal chain/belt length.",
    icon: <ComponentsIcon />,
    Component: Drivetrain,
    shareable: true,
    workbench: true,
    HeaderActions: DrivetrainExamplesMenu,
  },
  {
    id: "wheel-building",
    title: "Wheel Building",
    subtitle: "Visualize different wheel lacing patterns and calculate required spoke lengths.",
    icon: <WheelIcon />,
    Component: WheelBuilding,
    shareable: true,
    workbench: true,
    HeaderActions: WheelExamplesMenu,
  },
  {
    id: "frame-size",
    title: "Frame Size",
    subtitle: "",
    icon: <FrameIcon />,
    Component: FrameSize,
    ownHeader: true,
    workbench: true,
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
    title: "Components",
    subtitle: "Look up any component used in these calculators and view its specifications.",
    icon: <DrivetrainIcon />,
    Component: Derailleur,
    HeaderActions: ComponentProposalButton,
  },
  {
    id: "power",
    title: "Cycling Power",
    subtitle: "Calculates the watts needed for a speed and gradient — and speed from watts. Also calculates energy used for a specific distance or duration.",
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
