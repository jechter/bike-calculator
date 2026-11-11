import type { ReactNode } from "react";
import { useSettingsDrawer } from "../settingsDrawer";

/** Prominent compact-layout entry point in the bottom toolbar. */
export function SettingsButton({ icon, pageTitle, label }: { icon: ReactNode; pageTitle: string; label?: string }) {
  const { open, setOpen } = useSettingsDrawer();
  const title = label ?? `${pageTitle} settings`;
  return (
    <button
      type="button"
      className="botbar-menu settings-button"
      title={title}
      onClick={() => setOpen(!open)}
      aria-label={`${open ? "Close" : "Open"} ${title}`}
      aria-expanded={open}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
