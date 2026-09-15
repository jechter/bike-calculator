import { useState } from "react";
import { CALCULATORS } from "./registry";
import { useHashRoute, useHashConfigKey } from "./useHashRoute";
import { UnitsProvider } from "./units-context";
import { UnitSwitcher } from "./components/UnitSwitcher";
import { CopyLinkButton } from "./components/CopyLinkButton";

export function App() {
  const [route, navigate] = useHashRoute(CALCULATORS[0].id);
  const active = CALCULATORS.find((c) => c.id === route) ?? CALCULATORS[0];
  const Active = active.Component;
  // Shareable pages remount when a new link arrives (see useHashConfigKey) so they
  // re-read their config from the URL even without a full page reload.
  const hashKey = useHashConfigKey();

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

  return (
    <UnitsProvider>
      <div className={"app" + (navCollapsed ? " app--nav-collapsed" : "")}>
        <aside className="sidebar">
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
          <nav className="nav">
            {CALCULATORS.filter((c) => !c.hidden).map((c) => (
              <button
                key={c.id}
                className={c.id === active.id ? "active" : ""}
                title={c.title}
                // Clicking the active tab is a no-op — otherwise it would strip the
                // config query from the hash and reset a shareable page.
                onClick={() => c.id !== active.id && navigate(c.id)}
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
          <div className="main-head">
            <div>
              <h1>{active.title}</h1>
              <p className="subtitle">{active.subtitle}</p>
            </div>
            {(active.HeaderActions || active.shareable) && (
              <div className="main-actions">
                {active.HeaderActions && <active.HeaderActions />}
                {active.shareable && <CopyLinkButton />}
              </div>
            )}
          </div>
          <Active key={active.shareable ? hashKey : active.id} />
        </main>
      </div>
    </UnitsProvider>
  );
}
