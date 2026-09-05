/**
 * Subtle, monochrome line-art icons for the calculators. They draw with
 * `currentColor` and no fills, so they inherit the nav text colour (muted,
 * or the accent when a page is active) and adapt to light/dark automatically.
 */

const SVG_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const polar = (cx: number, cy: number, angle: number, r: number): [number, number] => [
  cx + Math.cos(angle) * r,
  cy + Math.sin(angle) * r,
];

const fmt = (pts: [number, number][]) =>
  "M" + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L") + "Z";

/** A flat-topped gear / sprocket silhouette. */
function cogPath(cx: number, cy: number, teeth: number, rOut: number, rIn: number) {
  const step = (2 * Math.PI) / teeth;
  const g = step * 0.26; // half the angular width of a tooth top
  const pts: [number, number][] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    pts.push(polar(cx, cy, a - step / 2 + g, rIn));
    pts.push(polar(cx, cy, a - g, rOut));
    pts.push(polar(cx, cy, a + g, rOut));
    pts.push(polar(cx, cy, a + step / 2 - g, rIn));
  }
  return fmt(pts);
}

// Drivetrain — a chainring / sprocket.
export const DrivetrainIcon = () => (
  <svg {...SVG_PROPS}>
    <path d={cogPath(12, 12, 9, 9, 6.6)} />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

// Wheel Building — a spoked wheel.
export const WheelIcon = () => {
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const [x1, y1] = polar(12, 12, a, 2);
    const [x2, y2] = polar(12, 12, a, 8.4);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      {spokes}
      <circle cx="12" cy="12" r="1.8" />
    </svg>
  );
};

// Frame Size — a road-frame silhouette (diamond frame with fork + seatpost).
export const FrameIcon = () => (
  <svg {...SVG_PROPS}>
    {/* rear triangle: chainstay + seatstay + seat tube */}
    <path d="M3 16 L10.5 16 M3 16 L9 6.5 M9 6.5 L10.5 16" />
    {/* top tube + down tube */}
    <path d="M9 6.5 L19 7 M20 10 L10.5 16" />
    {/* head tube + fork */}
    <path d="M19 7 L20 10 M20 10 L21 16" />
    {/* seatpost */}
    <path d="M9 6.5 L8.5 4" />
  </svg>
);

// Tire — a thick tread ring.
export const TireIcon = () => (
  <svg {...SVG_PROPS}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5.4" />
  </svg>
);

// Derailleur — two jockey wheels in a cage hung from the hanger bolt.
export const DerailleurIcon = () => (
  <svg {...SVG_PROPS}>
    {/* hanger bolt + upper arm */}
    <circle cx="17.5" cy="4.5" r="1.1" />
    <path d="M16.8 5.4 L13.6 9.2" />
    {/* jockey wheels */}
    <circle cx="13" cy="11" r="2.3" />
    <circle cx="10.5" cy="17.2" r="2.3" />
    {/* cage plate */}
    <path d="M15 12 L12.4 18.2" />
  </svg>
);

// Cycling Power — a lightning bolt.
export const PowerIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M13.5 3 L5.5 13 H11 L10.5 21 L18.5 11 H13 Z" />
  </svg>
);

// Thread Direction — a clockwise rotation arrow.
export const ThreadIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);
