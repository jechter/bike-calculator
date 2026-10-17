import type { ReactNode } from "react";
import { useSettingsDrawer } from "../settingsDrawer";

/** Prominent compact-layout entry point in the bottom toolbar. */
export function SettingsButton({ icon, pageTitle }: { icon: ReactNode; pageTitle: string }) {
  const { open, setOpen } = useSettingsDrawer();
  return (
    <button
      type="button"
      className="botbar-menu settings-button"
      title={`${pageTitle} settings`}
      onClick={() => setOpen(!open)}
      aria-label={`${open ? "Close" : "Open"} ${pageTitle} settings`}
      aria-expanded={open}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
