import { createContext, useContext } from "react";

// Shares the mobile settings-drawer open state between the top bar (the trigger
// button lives in App, next to the hamburger) and the Workbench that renders the
// drawer on a given page.
export interface SettingsDrawerApi {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const SettingsDrawerContext = createContext<SettingsDrawerApi>({
  open: false,
  setOpen: () => {},
});

export const useSettingsDrawer = () => useContext(SettingsDrawerContext);
