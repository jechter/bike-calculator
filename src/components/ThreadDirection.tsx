import { THREAD_ITEMS, type ThreadItem } from "../lib/threadDirection";
import { Section } from "./ui";

const word = (d: "CW" | "CCW") => (d === "CW" ? "Clockwise ↻" : "Anti-clockwise ↺");

function DirCells({ it }: { it: ThreadItem }) {
  const tighten = it.loosenDirection === "CW" ? "CCW" : "CW";
  return (
    <>
      <td>
        <span className={"badge " + (it.thread === "LH" ? "lh" : "rh")}>{it.thread}</span>
      </td>
      <td className="turn">{word(it.loosenDirection)}</td>
      <td>{word(tighten)}</td>
      <td>
        {it.notes} <span style={{ color: "var(--muted)" }}>({it.viewpoint})</span>
      </td>
    </>
  );
}

export function ThreadDirection() {
  const pedals = THREAD_ITEMS.filter((i) => i.category === "pedal");
  const bbs = THREAD_ITEMS.filter((i) => i.category === "bottom-bracket");

  return (
    <>
      <p className="subtitle" style={{ marginTop: -12 }}>
        Pedals and bottom brackets are the only parts with left-hand threads —
        everything else on the bike is normal (right-hand) thread. Right-hand:
        clockwise to tighten. Left-hand: the opposite. “Clockwise” is as you face
        that side of the bike.
      </p>

      <Section
        title="Pedals"
        info={
          <>
            The <strong>left pedal</strong> is left-hand threaded (turn{" "}
            <strong>clockwise to loosen</strong>) — the classic gotcha. The right
            pedal is normal.
          </>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Side</th>
                <th>Thread</th>
                <th>To loosen</th>
                <th>To tighten</th>
                <th>Notes (viewpoint)</th>
              </tr>
            </thead>
            <tbody>
              {pedals.map((it, i) => (
                <tr key={i} className={it.highlight ? "highlight" : ""}>
                  <td>{it.side}</td>
                  <DirCells it={it} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Bottom brackets"
        info={
          <>
            The <strong>drive-side cup of an English/BSA</strong> BB is left-hand
            (clockwise to loosen). Italian and French are normal both sides; Swiss
            has a left-hand drive side. Verify regional standards when in doubt.
          </>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Standard</th>
                <th>Side</th>
                <th>Thread</th>
                <th>To loosen</th>
                <th>To tighten</th>
                <th>Notes (viewpoint)</th>
              </tr>
            </thead>
            <tbody>
              {bbs.map((it, i) => (
                <tr key={i} className={it.highlight ? "highlight" : ""}>
                  <td>{it.part}</td>
                  <td>{it.side}</td>
                  <DirCells it={it} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
