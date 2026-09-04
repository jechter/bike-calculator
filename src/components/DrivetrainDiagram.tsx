// A schematic side view of the drivetrain: the chainring(s) up front and the
// cassette cogs at the rear, drawn to scale by tooth count, with the chain
// looped over the currently-selected gear. Hovering a gear in the chart moves
// the chain.

export interface DrivetrainDiagramProps {
  chainrings: number[];
  cogs: number[];
  activeChainring: number;
  activeCog: number;
}

export function DrivetrainDiagram({
  chainrings,
  cogs,
  activeChainring,
  activeCog,
}: DrivetrainDiagramProps) {
  const rings = [...new Set(chainrings)].filter((n) => n > 0).sort((a, b) => b - a);
  const cs = [...new Set(cogs)].filter((n) => n > 0).sort((a, b) => b - a);
  if (rings.length === 0 || cs.length === 0) return null;

  const maxTeeth = Math.max(...rings, ...cs);
  const scale = 68 / maxTeeth; // px per tooth (radius)
  const rfMax = Math.max(...rings) * scale;
  const rrMax = Math.max(...cs) * scale;
  const maxR = Math.max(rfMax, rrMax);
  const margin = 14;
  const cy = maxR + margin;
  const Fx = margin + rfMax;
  const gap = 64;
  const Rx = Fx + rfMax + rrMax + gap;
  const W = Rx + rrMax + margin;
  const H = 2 * maxR + 2 * margin;

  const rf = activeChainring * scale;
  const rr = activeCog * scale;
  const d = Rx - Fx;
  const gamma = Math.acos(Math.max(-1, Math.min(1, (rf - rr) / d)));
  const P = (cx: number, r: number, a: number): [number, number] => [
    cx + r * Math.cos(a),
    cy + r * Math.sin(a),
  ];
  const faTop = P(Fx, rf, -gamma);
  const rbTop = P(Rx, rr, -gamma);
  const faBot = P(Fx, rf, gamma);
  const rbBot = P(Rx, rr, gamma);
  const chain =
    `M ${faTop[0]} ${faTop[1]} L ${rbTop[0]} ${rbTop[1]} ` +
    `A ${rr} ${rr} 0 0 1 ${rbBot[0]} ${rbBot[1]} ` +
    `L ${faBot[0]} ${faBot[1]} ` +
    `A ${rf} ${rf} 0 1 1 ${faTop[0]} ${faTop[1]} Z`;

  return (
    <div className="dt-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Drivetrain view">
        {/* cassette cogs */}
        {cs.map((c) => (
          <circle
            key={"c" + c}
            cx={Rx}
            cy={cy}
            r={c * scale}
            className={c === activeCog ? "dt-gear-active" : "dt-gear"}
          />
        ))}
        {/* chainrings */}
        {rings.map((r) => (
          <circle
            key={"r" + r}
            cx={Fx}
            cy={cy}
            r={r * scale}
            className={r === activeChainring ? "dt-gear-active" : "dt-gear"}
          />
        ))}
        {/* chain over the active gear */}
        <path d={chain} className="dt-chain" />
        {/* crank spindle + rear axle */}
        <circle cx={Fx} cy={cy} r={3} className="dt-hub" />
        <circle cx={Rx} cy={cy} r={3} className="dt-hub" />
        {/* tooth-count labels */}
        <text x={Fx} y={cy - rfMax - 4} className="dt-label" textAnchor="middle">
          {activeChainring}T
        </text>
        <text x={Rx} y={cy - rrMax - 4} className="dt-label" textAnchor="middle">
          {activeCog}T
        </text>
      </svg>
      <div className="dt-cap">
        {activeChainring} × {activeCog} · ratio {(activeChainring / activeCog).toFixed(2)}
      </div>
    </div>
  );
}
