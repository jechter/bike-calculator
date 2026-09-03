import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  const [speed, setSpeed] = useState<SpeedUnit>(() => {
    try {
      return (localStorage.getItem(KEY) as SpeedUnit) || "kmh";
    } catch {
      return "kmh";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, speed);
    } catch {
      /* ignore */
    }
  }, [speed]);

  return <UnitsContext.Provider value={{ speed, setSpeed }}>{children}</UnitsContext.Provider>;
}

export const useUnits = () => useContext(UnitsContext);

export const speedUnitLabel = (u: SpeedUnit) => (u === "mph" ? "mph" : "km/h");
