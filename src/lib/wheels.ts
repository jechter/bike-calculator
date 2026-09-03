// Wheel / tyre size reference data, shared by the tyre and drivetrain
// calculators. ISO/ETRTO bead diameter is the source of truth for what fits
// what; everything else is a naming convention that maps onto it.
//
// Rolling circumferences below are approximate reference values (mm). A measured
// roll-out is always more accurate and should be preferred where it matters.
// Values are in the same ballpark as commonly published bike-computer tables.

export interface BeadStandard {
  iso: number; // ISO/ETRTO bead seat diameter, mm
  names: string[]; // common names for this bead diameter
}

// ISO bead diameters and the names people use for them. Two tyres sharing a
// popular name (e.g. "20") can have different ISO diameters and NOT be
// interchangeable — hence listing names per exact ISO value.
export const BEAD_STANDARDS: BeadStandard[] = [
  { iso: 622, names: ['700C', '28"', '29er (29in)'] },
  { iso: 635, names: ['28 x 1 1/2', '700B'] },
  { iso: 630, names: ['27" (old road)'] },
  { iso: 584, names: ['650B', '27.5"'] },
  { iso: 571, names: ['650C', '26 x 1" (tubular-ish)'] },
  { iso: 559, names: ['26" (MTB)'] },
  { iso: 590, names: ['26 x 1 3/8 (590)'] },
  { iso: 597, names: ['26 x 1 3/8 (597, S-6)'] },
  { iso: 507, names: ['24" (MTB)'] },
  { iso: 540, names: ['24 x 1 3/8 (wheelchair/junior)'] },
  { iso: 451, names: ['20" (451, BMX race / folders)'] },
  { iso: 406, names: ['20" (406, BMX / folders)'] },
  { iso: 349, names: ['16" (Brompton, 349)'] },
  { iso: 305, names: ['16" (305)'] },
];

export interface TirePreset {
  label: string;
  iso: number; // bead diameter
  widthMm: number;
  /** Approximate rolling circumference in mm (reference / rider-loaded roll-out ~). */
  circumferenceMm: number;
}

// A handful of common presets with reference rolling circumferences. Users can
// always enter a measured roll-out instead.
export const TIRE_PRESETS: TirePreset[] = [
  { label: '700 x 23C', iso: 622, widthMm: 23, circumferenceMm: 2096 },
  { label: '700 x 25C', iso: 622, widthMm: 25, circumferenceMm: 2111 },
  { label: '700 x 28C', iso: 622, widthMm: 28, circumferenceMm: 2136 },
  { label: '700 x 32C', iso: 622, widthMm: 32, circumferenceMm: 2155 },
  { label: '700 x 35C', iso: 622, widthMm: 35, circumferenceMm: 2168 },
  { label: '700 x 38C', iso: 622, widthMm: 38, circumferenceMm: 2180 },
  { label: '650B x 47 (27.5 x 1.9)', iso: 584, widthMm: 47, circumferenceMm: 2079 },
  { label: '27.5 x 2.1', iso: 584, widthMm: 53, circumferenceMm: 2148 },
  { label: '27.5 x 2.4', iso: 584, widthMm: 61, circumferenceMm: 2182 },
  { label: '29 x 2.1', iso: 622, widthMm: 53, circumferenceMm: 2288 },
  { label: '29 x 2.3', iso: 622, widthMm: 58, circumferenceMm: 2314 },
  { label: '26 x 1.5', iso: 559, widthMm: 38, circumferenceMm: 1985 },
  { label: '26 x 1.9', iso: 559, widthMm: 48, circumferenceMm: 2026 },
  { label: '26 x 2.1', iso: 559, widthMm: 53, circumferenceMm: 2055 },
  { label: '20 x 1.75 (406)', iso: 406, widthMm: 44, circumferenceMm: 1515 },
  { label: '16 x 1 3/8 (349, Brompton)', iso: 349, widthMm: 35, circumferenceMm: 1290 },
];

/**
 * Approximate outer diameter (mm) from bead diameter and tyre width, assuming a
 * roughly round casing (section height ~= width). Rough; a measured value is
 * better.
 */
export function estimatedOuterDiameterMm(isoBead: number, widthMm: number): number {
  return isoBead + 2 * widthMm;
}

/** Approximate rolling circumference (mm) from bead diameter and width. */
export function estimatedCircumferenceMm(isoBead: number, widthMm: number): number {
  return Math.PI * estimatedOuterDiameterMm(isoBead, widthMm);
}

/** Find bead standards whose names loosely match a query like "26" or "700c". */
export function findBeadStandardsByName(query: string): BeadStandard[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return BEAD_STANDARDS.filter((s) =>
    s.names.some((n) => n.toLowerCase().includes(q)),
  );
}
