export type P = { x: number; y: number };
// Bike space has y up; SVG has y down, so flip as we place points.
export const flip = (p: P): P => ({ x: p.x, y: -p.y });
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const vadd = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
export const vsub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
export const vscale = (a: P, s: number): P => ({ x: a.x * s, y: a.y * s });
export const vlen = (a: P): number => Math.hypot(a.x, a.y);
export const vnorm = (a: P): P => vscale(a, 1 / (vlen(a) || 1));

// Two-bone IK: joint J with |A→J|=l1, |J→B|=l2, bending to the side `bend`
// (+1/−1). If A and B are too far apart the limb straightens.
export function ik2(a: P, b: P, l1: number, l2: number, bend: number): P {
  const d = vlen(vsub(b, a));
  const u = vnorm(vsub(b, a));
  if (d >= l1 + l2) return vadd(a, vscale(u, (l1 / (l1 + l2)) * d));
  const a1 = (d * d + l1 * l1 - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a1 * a1));
  const base = vadd(a, vscale(u, a1));
  return vadd(base, vscale({ x: -u.y, y: u.x }, h * bend));
}

