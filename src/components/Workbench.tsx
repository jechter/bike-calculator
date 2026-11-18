import { Children, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
 * drawer — opened from the page-icon Settings toggle in the bottom bar (open
 * state shared via SettingsDrawerContext) — so you're not scrolling past the
 * whole form to see the result it drives.
 */
export function Workbench({
  className,
  label,
  children,
  drawerTitle,
  portalDrawer = false,
  drawerContentClassName = "",
}: {
  className: string;
  /** Page name, so the tab/header read e.g. "Drivetrain settings". */
  label: string;
  children: ReactNode;
  /** Optional non-settings wording, e.g. a bike/component selector. */
  drawerTitle?: string;
  /** Escape a containing page's size/layout containment for fixed drawers. */
  portalDrawer?: boolean;
  drawerContentClassName?: string;
}) {
  const isMobile = useIsMobile();
  const { open, setOpen } = useSettingsDrawer();
  const title = drawerTitle ?? `${label} settings`;
  const closeLabel = drawerTitle ? `Close ${drawerTitle}` : 'Close settings';
  const layoutRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isMobile || !open || !drawerRef.current) return;
    const drawer = drawerRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...drawer.querySelectorAll<HTMLElement>(':is(button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"])')].filter(el => !el.closest('[hidden]'));
    focusable()[0]?.focus({ preventScroll: true });
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapTab);
    return () => { document.removeEventListener('keydown', trapTab); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, [isMobile, open]);

  if (!isMobile) return <div className={className} ref={layoutRef}>{children}</div>;

  const [controls, viz] = Children.toArray(children);
  const drawer = <>
      {open && <button type="button" className="workbench-backdrop" aria-label={closeLabel} onClick={() => setOpen(false)} />}
      <div
        ref={drawerRef}
        className={"workbench-drawer" + (open ? " workbench-drawer--open" : "")}
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        aria-label={title}
      >
        <div className="workbench-drawer-head">
          <strong>{title}</strong>
          <button type="button" className="workbench-drawer-close" aria-label={closeLabel} onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className={"workbench-drawer-body " + drawerContentClassName}>{controls}</div>
      </div>
    </>;
  return <div className={className + " workbench-mobile"} ref={layoutRef}>
    {viz}
    {portalDrawer ? createPortal(drawer, layoutRef.current?.closest('.app') ?? document.body) : drawer}
  </div>;
}
