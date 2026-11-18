/**
 * Subtle, monochrome line-art icons for the calculators. They draw with
 * `currentColor` and no fills, so they inherit the nav text color (muted,
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

// Components — a compact crankset with chainring, crank arm, and pedal.
export const ComponentsIcon = () => (
  <svg {...SVG_PROPS}>
    <circle cx="10" cy="10" r="6.6" />
    <circle cx="10" cy="10" r="2.2" />
    <path d="M11.7 11.7 L18.2 18.2 M17 18.2 H20.5" />
    <circle cx="10" cy="10" r="0.8" />
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

// Maintenance Log — an outlined calendar with a grid of days.
export const MaintenanceIcon = () => (
  <svg {...SVG_PROPS}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M7 3v4M17 3v4M3 10h18" />
    {[7, 12, 17].map((x) =>
      [14, 18].map((y) => (
        <rect key={`${x}-${y}`} x={x - 0.8} y={y - 0.8} width="1.6" height="1.6" rx="0.2" fill="currentColor" stroke="none" />
      )),
    )}
  </svg>
);

// Thread Direction — a clockwise rotation arrow.
export const ThreadIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

// Maintenance entry actions — repeat, pencil, and trash can.
export const RepeatIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M20 7H7a4 4 0 0 0-4 4M16 3l4 4-4 4M4 17h13a4 4 0 0 0 4-4M8 13l-4 4 4 4" />
  </svg>
);

export const EditIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z" />
  </svg>
);

export const DeleteIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
  </svg>
);

export const BikeIcon = () => (
  <svg {...SVG_PROPS}>
    <circle cx="5" cy="16" r="4" /><circle cx="19" cy="16" r="4" />
    <path d="m5 16 5-9 5 9H5l4-7h7M7 6h5M19 16 15 4h3" />
  </svg>
);

/** Bicycle chain side plate with two rivet heads and a narrowed waist. */
export const ChainIcon = () => (
  <svg {...SVG_PROPS}>
    <g transform="rotate(-35 12 12)">
      <path d="M6 7.5C8.5 7.5 9 9 12 9s3.5-1.5 6-1.5a4.5 4.5 0 0 1 0 9c-2.5 0-3-1.5-6-1.5s-3.5 1.5-6 1.5a4.5 4.5 0 0 1 0-9Z" />
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </g>
  </svg>
);

export const CassetteIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M5 5v14M9 6v12M13 8v8M17 9v6M21 11v2M3 12h20" />
  </svg>
);

export const BrakePadsIcon = () => (
  <svg {...SVG_PROPS}>
    <rect x="3" y="7" width="7" height="13" rx="2" /><rect x="14" y="7" width="7" height="13" rx="2" />
    <path d="M5 7V4h3v3M16 7V4h3v3M7 11v5M17 11v5" />
  </svg>
);

export const BottomBracketIcon = () => (
  <svg {...SVG_PROPS}>
    <rect x="5" y="6" width="14" height="12" rx="2" />
    <path d="M3 12h18M8 6v12M16 6v12M3 9v6M21 9v6" />
  </svg>
);

export const HeadsetIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M9 3h6v18H9zM5 6h14v3H5zM5 15h14v3H5z" />
  </svg>
);

export const HubIcon = () => (
  <svg {...SVG_PROPS}>
    <rect x="7" y="8" width="10" height="8" rx="2" />
    <path d="M2 12h20M6 5v14M18 5v14M4 7h4M4 17h4M16 7h4M16 17h4" />
  </svg>
);

export const ForkIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M12 2v6M7 8h10M7 6v15M17 6v15M5 21h4M15 21h4M7 12h10" />
  </svg>
);

export const ShockIcon = () => (
  <svg {...SVG_PROPS}>
    <circle cx="12" cy="3" r="2" /><circle cx="12" cy="21" r="2" />
    <path d="M12 5v2M12 17v2M8 7h8l-8 3 8 3-8 4h8M9 7v10M15 7v10" />
  </svg>
);

export const GenericComponentIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9" />
  </svg>
);

export const BatteryIcon = () => (
  <svg {...SVG_PROPS}>
    <rect x="3" y="6" width="17" height="12" rx="2" />
    <path d="M20 10h2v4h-2M12 8l-4 5h4l-1 3 5-5h-4l1-3" />
  </svg>
);

export const BrakeDiscIcon = () => (
  <svg {...SVG_PROPS}>
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" />
    <path d="M12 3v7M21 12h-7M12 21v-7M3 12h7M6 5.5l2 2M18 5.5l-2 2M18 18.5l-2-2M6 18.5l2-2" />
  </svg>
);

export const CableIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M5 3v4a7 7 0 0 0 7 7h1a4 4 0 0 1 4 4v3M8 3v4a4 4 0 0 0 4 4h1a7 7 0 0 1 7 7v3M4 3h5M16 21h5" />
  </svg>
);

export const WrenchIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8l-3.8 3.8Z" />
  </svg>
);
