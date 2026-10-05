import { useEffect, useState } from "react";
import { CALCULATORS } from "./registry";
import { useHashRoute, useHashConfigKey } from "./useHashRoute";
import { useIsMobile } from "./useIsMobile";
import { SettingsDrawerContext } from "./settingsDrawer";
import { UnitsProvider } from "./units-context";
import { UnitSwitcher } from "./components/UnitSwitcher";
import { CopyLinkButton } from "./components/CopyLinkButton";
import rueckenwindLogo from "./assets/rueckenwind-logo.png";
import rueckenwindMark from "./assets/rueckenwind-mark.png";

export function App() {
  const [route, navigate] = useHashRoute(CALCULATORS[0].id);
  const active = CALCULATORS.find((c) => c.id === route) ?? CALCULATORS[0];
  const Active = active.Component;
  // Shareable pages remount when a new link arrives (see useHashConfigKey) so they
  // re-read their config from the URL even without a full page reload.
  const hashKey = useHashConfigKey();

  // On mobile the per-page header actions ("Load an example" / "Copy link",
  // Frame Size's "Clear all") move up into the top bar instead of sitting in a
  // second row under it. Pages with their own header (Frame Size) portal their
  // action into #topbar-actions-slot.
  const isMobile = useIsMobile();
  const sharedActions = active.HeaderActions || active.shareable;
  const hasTopbarActions = Boolean(sharedActions || active.ownHeader);

  // Workbench pages (controls + visualization) show a left-edge "Settings" tab on
  // mobile that folds the controls drawer out over the visualization (rendered by
  // <Workbench>). The open state is shared via context so it can be reset here on
  // navigation.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Close the drawer whenever the page changes.
  useEffect(() => setSettingsOpen(false), [active.id]);

  // The sidebar can collapse to an icon rail to free up horizontal space for
  // the wider pages (e.g. wheel building's controls + visualization split).
  const [navCollapsed, setNavCollapsed] = useState(
    () => localStorage.getItem("nav-collapsed") === "1",
  );
  const toggleNav = () =>
    setNavCollapsed((c) => {
      localStorage.setItem("nav-collapsed", c ? "0" : "1");
      return !c;
    });

  // On narrow screens the sidebar is a slide-in drawer rather than a fixed rail,
  // so the nav doesn't push every page's content far down the screen.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Close the drawer on Escape, and never leave it stuck open when the layout
  // grows past the mobile breakpoint (the drawer only exists below it).
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileNavOpen(false);
    const mq = window.matchMedia("(min-width: 1200px)");
    const onWide = () => mq.matches && setMobileNavOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    document.body.classList.add("mobile-nav-lock");
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
      document.body.classList.remove("mobile-nav-lock");
    };
  }, [mobileNavOpen]);

  return (
    <UnitsProvider>
     <SettingsDrawerContext.Provider value={{ open: settingsOpen, setOpen: setSettingsOpen }}>
      <div
        className={
          "app" +
          (navCollapsed ? " app--nav-collapsed" : "") +
          (mobileNavOpen ? " app--mobile-nav-open" : "") +
          (settingsOpen ? " app--settings-open" : "")
        }
      >
        <header className="topbar">
          {/* Visual copy of the page title for the top bar. The real heading is the
              page's own <h1> (kept in the a11y tree, just visually hidden on mobile),
              so this one is aria-hidden to avoid a screen reader reading it twice. */}
          <span className="topbar-title" aria-hidden="true">
            {active.title}
          </span>
          {/* Right side: the page's header actions, when it has any. Only rendered
              on mobile — the top bar is hidden on wider screens, where actions live
              in the page header. */}
          {isMobile && hasTopbarActions && (
            <div className="topbar-actions">
              {active.HeaderActions && <active.HeaderActions />}
              {active.shareable && <CopyLinkButton />}
              {/* ownHeader pages (Frame Size) portal their action in here. */}
              <span className="topbar-actions-slot" id="topbar-actions-slot" />
            </div>
          )}
        </header>
        {mobileNavOpen && (
          <button
            type="button"
            className="nav-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <aside className="sidebar">
          {/* Compact-layout pull tab (peeks on the left edge, rides out with the
              drawer) — the nav counterpart to the workbench Settings tab. Hidden on
              desktop, where the sidebar is a fixed rail. */}
          <button
            type="button"
            className="edge-tab nav-handle"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
          >
            <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" fill="currentColor">
              <path d="M2 4h16v2H2V4zm0 5h16v2H2V9zm0 5h16v2H2v-2z" />
            </svg>
            <span className="wh-label">Menu</span>
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
          <div className="sidebar-head">
            <a
              className="brand"
              href="https://rueckenwind.berlin"
              target="_top"
              rel="noopener noreferrer"
              title="Rückenwind Berlin"
            >
              <img
                className="brand-logo brand-logo--full"
                src={rueckenwindLogo}
                alt="Rückenwind Berlin"
              />
              <img
                className="brand-logo brand-logo--mark"
                src={rueckenwindMark}
                alt="Rückenwind"
              />
            </a>
            <button
              type="button"
              className="nav-collapse"
              onClick={toggleNav}
              title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
                <path d="M2 2h1.5v12H2V2zm4.72 2.22 1.06 1.06L5.56 7.5H14v1H5.56l2.22 2.22-1.06 1.06L2.69 8l4.03-3.78z" />
              </svg>
            </button>
          </div>
          <nav className="nav">
            {CALCULATORS.filter((c) => !c.hidden).map((c) => (
              <button
                key={c.id}
                className={c.id === active.id ? "active" : ""}
                title={c.title}
                // Clicking the active tab is a no-op — otherwise it would strip the
                // config query from the hash and reset a shareable page.
                onClick={() => {
                  if (c.id !== active.id) navigate(c.id);
                  setMobileNavOpen(false);
                }}
              >
                <span className="icon">{c.icon}</span>
                <span>{c.title}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <UnitSwitcher />
            <a
              className="repo-link"
              href="https://github.com/jechter/bike-calculator"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                className="repo-icon"
                viewBox="0 0 16 16"
                width="14"
                height="14"
                aria-hidden="true"
                fill="currentColor"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </aside>

        <main className={`main main--${active.id}`}>
          {!active.ownHeader && (
            <div className="main-head">
              <div>
                <h1>{active.title}</h1>
                <p className="subtitle">{active.subtitle}</p>
              </div>
              {/* On mobile these move up into the top bar (see above). */}
              {!isMobile && sharedActions && (
                <div className="main-actions">
                  {active.HeaderActions && <active.HeaderActions />}
                  {active.shareable && <CopyLinkButton />}
                </div>
              )}
            </div>
          )}
          <Active key={active.shareable ? hashKey : active.id} />
        </main>
      </div>
     </SettingsDrawerContext.Provider>
    </UnitsProvider>
  );
}
