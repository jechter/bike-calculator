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
        {/* Pull tab on the drawer's outer edge: always visible (peeks at the screen
            edge when closed) and slides out with the drawer, toggling it. */}
        <button
          type="button"
          className="edge-tab workbench-handle"
          onClick={() => setOpen(!open)}
          aria-label={open ? `Close ${label} settings` : `Open ${label} settings`}
          aria-expanded={open}
        >
          <svg
            className="wh-icon"
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="4" y1="8" x2="20" y2="8" />
            <circle cx="9" cy="8" r="2.6" fill="currentColor" />
            <line x1="4" y1="16" x2="20" y2="16" />
            <circle cx="15" cy="16" r="2.6" fill="currentColor" />
          </svg>
          <span className="wh-label">{label} settings</span>
          <svg
            className="wh-chevron"
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
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
