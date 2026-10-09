import { Children, useEffect, type ReactNode } from "react";
import { useIsMobile } from "../useIsMobile";
import { useSettingsDrawer } from "../settingsDrawer";

/**
 * Shared layout for the "settings on the left, visualization on the right" pages
 * (Drivetrain, Wheel Building, Frame Size). Expects exactly two children: the
 * controls column first, the visualization second.
 *
 * On wide screens it just renders them in the page's own grid/flex container
 * (via `className`), so the existing desktop CSS is untouched. On mobile the
 * visualization becomes the base view and the controls slide out over it as a
 * drawer — opened from the "Settings" toggle App renders in the top bar (open
 * state shared via SettingsDrawerContext) — so you're not scrolling past the
 * whole form to see the result it drives.
 */
export function Workbench({
  className,
  label,
  children,
}: {
  className: string;
  /** Page name, so the tab/header read e.g. "Drivetrain settings". */
  label: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const { open, setOpen } = useSettingsDrawer();

  // Close on Escape and lock the page scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.classList.add("mobile-nav-lock");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("mobile-nav-lock");
    };
  }, [open]);
  // Never leave the drawer "open" when we grow back to the desktop layout.
  useEffect(() => {
    if (!isMobile && open) setOpen(false);
  }, [isMobile, open]);

  if (!isMobile) return <div className={className}>{children}</div>;

  const [controls, viz] = Children.toArray(children);
  return (
    <div className={className + " workbench-mobile"}>
      {viz}
      {open && (
        <button
          type="button"
          className="workbench-backdrop"
          aria-label="Close settings"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        className={"workbench-drawer" + (open ? " workbench-drawer--open" : "")}
        role="dialog"
        aria-modal={open}
        aria-label={`${label} settings`}
      >
        <div className="workbench-drawer-head">
          <strong>{label} settings</strong>
          <button
            type="button"
            className="workbench-drawer-close"
            aria-label="Close settings"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>
        <div className="workbench-drawer-body">{controls}</div>
      </div>
    </div>
  );
}
