import { createContext, useContext, useState, type ReactNode } from "react";

// Global unit preferences, shared across calculators (currently the speed unit,
// used by the drivetrain gear chart and the cycling-power calculator).

export type SpeedUnit = "kmh" | "mph";

interface UnitsValue {
  speed: SpeedUnit;
  setSpeed: (u: SpeedUnit) => void;
}

const UnitsContext = createContext<UnitsValue>({ speed: "kmh", setSpeed: () => {} });

const KEY = "bwc.speedUnit";

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [speed, updateSpeed] = useState<SpeedUnit>(() => {
    try {
      return localStorage.getItem(KEY) === "mph" ? "mph" : "kmh";
    } catch {
      return "kmh";
    }
  });

  // Persist only an explicit choice, never the default on initial mount.
  const setSpeed = (value: SpeedUnit) => {
    updateSpeed(value);
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* The selected unit still works for the current page. */
    }
  };

  return <UnitsContext.Provider value={{ speed, setSpeed }}>{children}</UnitsContext.Provider>;
}

export const useUnits = () => useContext(UnitsContext);

export const speedUnitLabel = (u: SpeedUnit) => (u === "mph" ? "mph" : "km/h");
