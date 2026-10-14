/** Row-major slots shared by the double-file schematic and drag model. */
export function doubleFileSlot(index: number) {
  return { row: Math.floor(index / 2), column: index % 2 };
}
