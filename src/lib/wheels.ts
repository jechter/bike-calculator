// Wheel / tire size reference data, shared by the tire and drivetrain
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

// ISO bead diameters and the names people use for them. Two tires sharing a
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

/**
 * Approximate outer diameter (mm) from bead diameter and tire width, assuming a
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
