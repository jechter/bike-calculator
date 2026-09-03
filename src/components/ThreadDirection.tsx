import { useState } from "react";
import { THREAD_ITEMS } from "../lib/threadDirection";
import { Note, Section } from "./ui";

export function ThreadDirection() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const items = THREAD_ITEMS.filter(
    (it) =>
      !q ||
      it.part.toLowerCase().includes(q) ||
      it.side.toLowerCase().includes(q) ||
      it.notes.toLowerCase().includes(q),
  );

  return (
    <>
      <Note>
        <strong>Right-hand (normal):</strong> clockwise to tighten, anti-clockwise
        to loosen. <strong>Left-hand (reverse):</strong> the opposite. “Clockwise”
        is always as you <em>face that side of the bike</em>. The two big gotchas:
        the <strong>left pedal</strong> and the <strong>drive-side cup of an
        English/BSA bottom bracket</strong> are both left-hand (turn clockwise to
        loosen).
      </Note>

      <Section title="Reference chart">
        <input
          type="text"
          placeholder="Search parts… (pedal, bottom bracket, cassette…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Side</th>
                <th>Thread</th>
                <th>To loosen</th>
                <th>To tighten</th>
                <th>Notes (viewpoint)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const tighten = it.loosenDirection === "CW" ? "CCW" : "CW";
                const word = (d: string) => (d === "CW" ? "Clockwise ↻" : "Anti-clockwise ↺");
                return (
                  <tr key={i} className={it.highlight ? "highlight" : ""}>
                    <td>{it.part}</td>
                    <td>{it.side}</td>
                    <td>
                      <span className={"badge " + (it.thread === "LH" ? "lh" : "rh")}>
                        {it.thread}
                      </span>
                    </td>
                    <td className="turn">{word(it.loosenDirection)}</td>
                    <td>{word(tighten)}</td>
                    <td>
                      {it.notes} <span style={{ color: "var(--muted)" }}>({it.viewpoint})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Note tone="warn">
          Older/regional bottom-bracket and pedal variants have exceptions
          (French, Swiss, some Center Lock lockrings). Verify against the specific
          standard when in doubt.
        </Note>
      </Section>
    </>
  );
}
