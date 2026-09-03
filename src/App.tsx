import { CALCULATORS } from "./registry";
import { useHashRoute } from "./useHashRoute";
import { UnitsProvider } from "./units-context";
import { UnitSwitcher } from "./components/UnitSwitcher";

export function App() {
  const [route, navigate] = useHashRoute(CALCULATORS[0].id);
  const active = CALCULATORS.find((c) => c.id === route) ?? CALCULATORS[0];
  const Active = active.Component;

  return (
    <UnitsProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <span className="dot">◉</span> Bike Workshop
          </div>
          <nav className="nav">
            {CALCULATORS.map((c) => (
              <button
                key={c.id}
                className={c.id === active.id ? "active" : ""}
                onClick={() => navigate(c.id)}
              >
                <span className="icon">{c.icon}</span>
                <span>{c.title}</span>
                {c.kind === "ref" && <span className="kind">ref</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <UnitSwitcher />
          </div>
        </aside>

        <main className="main">
          <h1>{active.title}</h1>
          <p className="subtitle">{active.subtitle}</p>
          <Active />
        </main>
      </div>
    </UnitsProvider>
  );
}
