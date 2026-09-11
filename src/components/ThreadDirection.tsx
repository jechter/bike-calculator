import { useState } from "react";
import { THREAD_COMPONENTS, type ThreadComponent } from "../lib/threadDirection";
import { ThreadDiagram, type Selection } from "./ThreadDiagram";
import { Section } from "./ui";

const selFrom = (c: ThreadComponent, side: "left" | "right"): Selection => ({
  name: c.name,
  side,
  thread: c[side].thread,
  loosenDirection: c[side].loosenDirection,
});

export function ThreadDirection() {
  const [sel, setSel] = useState<Selection>(selFrom(THREAD_COMPONENTS[0], "left"));

  return (
    <>
      <p className="subtitle" style={{ marginTop: -12 }}>
        Pedals and bottom brackets are the only parts with left-hand threads —
        everything else on the bike is normal (right-hand) thread. Hover (or tap) a
        side to see which way to turn. Left-hand sides are highlighted.
      </p>

      <Section
        title="Thread direction"
        info={
          <>
            <strong>Right-hand (normal):</strong> clockwise to tighten, anti-clockwise
            to loosen. <strong>Left-hand (reverse):</strong> the opposite. “Clockwise”
            is always as you <em>face that side of the bike</em>. The two big gotchas:
            the <strong>left pedal</strong> and the <strong>drive-side cup of an
            English/BSA bottom bracket</strong>.
          </>
        }
      >
        <div className="td-layout">
          <div className="table-wrap td-table">
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Left / non-drive</th>
                  <th>Right / drive</th>
                </tr>
              </thead>
              <tbody>
                {THREAD_COMPONENTS.map((c) => (
                  <tr key={c.name}>
                    <td>
                      {c.name}
                      {c.note && <div className="td-cellnote">{c.note}</div>}
                    </td>
                    {(["left", "right"] as const).map((side) => {
                      const s = c[side];
                      const selected = sel.name === c.name && sel.side === side;
                      return (
                        <td
                          key={side}
                          className={
                            "td-cell" +
                            (s.thread === "LH" ? " lh" : "") +
                            (selected ? " sel" : "")
                          }
                          onMouseEnter={() => setSel(selFrom(c, side))}
                          onClick={() => setSel(selFrom(c, side))}
                        >
                          <span className={"badge " + (s.thread === "LH" ? "lh" : "rh")}>
                            {s.thread}
                          </span>
                          {s.note && <div className="td-cellnote">{s.note}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ThreadDiagram sel={sel} />
        </div>
      </Section>
    </>
  );
}
