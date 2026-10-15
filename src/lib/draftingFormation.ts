import { doubleFileSlot } from "./doubleFile";
import { DRAFT_RIDERS_MAX, type CdaFixedFormation } from "./cda";

export interface FormationRider { x: number; y: number; you: boolean }

/** Static schematic. Single file counts riders ahead; wider formations count other riders, including neighbours. */
export function fixedFormationLayout(formation: CdaFixedFormation, value: number) {
  const ahead = Number.isFinite(value) ? Math.max(0, Math.min(DRAFT_RIDERS_MAX, Math.round(value))) : 0;
  const riders: FormationRider[] = [];
  let row = 0;
  if (formation === "bunch") {
    // Blocken et al. (2018), section 2.2 / Fig. 3: staggered rows widening
    // 1, 2, ... 10, then 9/10 alternately, constrained by road width.
    // This illustrates the shape, not the paper's position-specific CFD results.
    let remaining = ahead + 1;
    while (remaining > 0) {
      const capacity = row < 10 ? row + 1 : row % 2 === 0 ? 9 : 10;
      const size = Math.min(remaining, capacity);
      const lastRow = remaining === size;
      for (let column = 0; column < size; column++) {
        riders.push({ x: (column - (size - 1) / 2) * 38, y: row * 36, you: lastRow && column === Math.floor((size - 1) / 2) });
      }
      remaining -= size;
      row++;
    }
  } else {
    const columns = formation === "double" ? 2 : 1;
    for (let i = 0; i < ahead; i++) {
      const slot = formation === "double" ? doubleFileSlot(i) : { row: i, column: 0 };
      riders.push({ x: (slot.column - (columns - 1) / 2) * 42, y: slot.row * 38, you: false });
    }
    // You occupy the next slot in the row, not a separate trailing row.
    const slot = formation === "double" ? doubleFileSlot(ahead) : { row: ahead, column: 0 };
    riders.push({ x: ahead === 0 ? 0 : (slot.column - (columns - 1) / 2) * 42, y: slot.row * 38, you: true });
  }
  const width = Math.max(320, ...riders.map(r => Math.abs(r.x) * 2 + 90));
  const height = Math.max(140, ...riders.map(r => r.y + 92));
  return { riders, width, height, ahead, total: ahead + 1 };
}
