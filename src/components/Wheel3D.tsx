// A WebGL 3D rendering of the laced wheel that you can drag to rotate. Shares
// the build scrubber with the 2D views (via `step`/`sequence`), so spokes
// appear in build order here too. Raw WebGL — no 3D library dependency.
//
// Coordinates: the axle runs along +Z, the wheel lies in the X-Y plane. Rim
// radius is normalised to 1 unit; every mm is scaled by 2/ERD. The rim is a
// torus, hub barrel and flanges are capped cylinders (shaded), and spokes are
// GL lines coloured by side. Depth-testing lets the hub occlude far spokes, so
// dish and cross pattern read as real 3D.

import { useEffect, useRef, useState } from "react";
import {
  spokePlan,
  wheelLayout,
  rimHoleAngle,
  type HubType,
  type HubRatio,
  type LacingPattern,
} from "../lib/spokes";

// Three shades per side, by weave role: light = leading, medium = radial (crow's
// foot's centre spokes), dark = trailing. Kept in step with the 2D legend colours
// in WheelDiagram.
const DRIVE_OUT: [number, number, number] = [0.97, 0.5, 0.4];
const DRIVE_MID: [number, number, number] = [0.85, 0.27, 0.19];
const DRIVE_IN: [number, number, number] = [0.62, 0.14, 0.1];
const NDS_OUT: [number, number, number] = [0.46, 0.72, 1.0];
const NDS_MID: [number, number, number] = [0.2, 0.5, 0.9];
const NDS_IN: [number, number, number] = [0.1, 0.34, 0.7];
const METAL: [number, number, number] = [0.62, 0.66, 0.71];
const VALVE: [number, number, number] = [0.78, 0.62, 0.22]; // brass valve marker
const HOLE: [number, number, number] = [0.1, 0.11, 0.13]; // empty spoke hole
const BARREL: [number, number, number] = [0.5, 0.54, 0.6]; // plain hub shell
const AXLE: [number, number, number] = [0.44, 0.47, 0.52]; // axle through the locknuts
const LOCKNUT: [number, number, number] = [0.32, 0.34, 0.38]; // end lock-nut / cap
const SHELL: [number, number, number] = [0.4, 0.42, 0.47]; // fat dynamo / gear shell
const FREEHUB: [number, number, number] = [0.2, 0.21, 0.24]; // dark freehub driver body

// One spoke draws as: a body of four tubes (so it can bend once), a short elbow
// tube through the flange, a round button head lying flat on the far face, and a
// nipple at the rim bed. A crossing pair each kink once at their shared outermost
// crossing — the leading spoke a hair inboard so it passes behind, the trailing a
// hair outboard so it passes in front — leaving a small axial gap there so which
// spoke is in front reads clearly. Vert budget per spoke: body (SPOKE_SEG*6 * 4) +
// elbow + nipple (SPOKE_SEG*6 each) + button disc (SPOKE_SEG*12) + nipple cap
// (SPOKE_SEG*3) = SPOKE_SEG*51.
const SPOKE_SEG = 6;
const VERTS_PER_SPOKE = SPOKE_SEG * 51;

export interface Wheel3DProps {
  erdMm: number;
  spokeCount: number;
  leftFlangeDiaMm: number;
  rightFlangeDiaMm: number;
  leftOffsetMm: number;
  rightOffsetMm: number;
  leftCross: number;
  rightCross: number;
  /** Grouped-lacing run length per side: 1 = standard 1L1T, 2 = 2L2T, 3 = 3L3T… */
  leftGroup: number;
  rightGroup: number;
  /** Lacing pattern per side: 'standard' (incl. grouped) or 'crowsfoot'. */
  leftPattern: LacingPattern;
  rightPattern: LacingPattern;
  /** Flange spoke split: '1:1' (even) or '2:1' (drive-doubled). */
  ratio: HubRatio;
  /** 2:1 only: put the non-drive hole in the centre of each triplet (D-N-D). */
  ndsCentre?: boolean;
  /** Flip the leading/trailing phase so clustered pairs cross the neighbouring
   *  group instead of each other (G3-style). No effect on an evenly-spaced flange. */
  crossPhase?: boolean;
  /** Rim drilled in groups of this many holes (1 = evenly drilled). */
  rimHoleGroup?: number;
  /** Between-group gap as a multiple of the in-group hole spacing. */
  rimHoleGap?: number;
  /** Alternating rim drilling: each hole nudged this many mm toward the flange it
   *  serves (0 = centred / single-drilled). Purely the rim-bed hole position. */
  rimHoleOffsetMm?: number;
  /** Selected hub's type / over-locknut width (mm), when a hub is chosen. */
  hubType?: HubType;
  hubWidthMm?: number;
  /** How many spokes are laced (from the shared build scrubber). */
  step: number;
  /** Rim indices in build order; sequence[k] is the k-th spoke placed. */
  sequence: number[];
}

// --- Small column-major mat4 helpers (WebGL order) --------------------------

function perspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  // prettier-ignore
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function translateZ(z: number): Float32Array {
  // prettier-ignore
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,z,1]);
}
function rotateX(a: number): Float32Array {
  const c = Math.cos(a), s = Math.sin(a);
  // prettier-ignore
  return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
}
function rotateY(a: number): Float32Array {
  const c = Math.cos(a), s = Math.sin(a);
  // prettier-ignore
  return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
}

// --- Geometry builders (push interleaved pos[3], normal[3], colour[3]) ------

type Mesh = number[];

// The rim, built by revolving a closed cross-section profile around the axle.
// Each profile point is [dr, z]: dr is the radial offset out from the spoke bed
// (radius R = ERD/2), z is axial. Outward normals are derived per profile edge
// (flat across the section, smooth around the ring). The profile's outer face
// dips inward at the centre, giving the concave tyre channel.
function addRim(m: Mesh, R: number, profile: number[][], maj: number, col: number[]) {
  let cdr = 0, cz = 0;
  for (const p of profile) { cdr += p[0]; cz += p[1]; }
  cdr /= profile.length; cz /= profile.length;
  const P = profile.length;
  const pos = (phi: number, dr: number, z: number) => [(R + dr) * Math.cos(phi), (R + dr) * Math.sin(phi), z];
  for (let j = 0; j < P; j++) {
    const a2 = profile[j], b2 = profile[(j + 1) % P];
    const edr = b2[0] - a2[0], ez = b2[1] - a2[1];
    // 2-D outward normal in the (dr, z) plane, flipped to point away from centroid
    let ndr = ez, nz = -edr;
    const nl = Math.hypot(ndr, nz) || 1; ndr /= nl; nz /= nl;
    const mdr = (a2[0] + b2[0]) / 2 - cdr, mz = (a2[1] + b2[1]) / 2 - cz;
    if (ndr * mdr + nz * mz < 0) { ndr = -ndr; nz = -nz; }
    const nrm = (phi: number) => [ndr * Math.cos(phi), ndr * Math.sin(phi), nz];
    for (let i = 0; i < maj; i++) {
      const f0 = (2 * Math.PI * i) / maj, f1 = (2 * Math.PI * (i + 1)) / maj;
      const n0 = nrm(f0), n1 = nrm(f1);
      const A = pos(f0, a2[0], a2[1]), B = pos(f1, a2[0], a2[1]);
      const C = pos(f1, b2[0], b2[1]), D = pos(f0, b2[0], b2[1]);
      const push = (p: number[], n: number[]) => m.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2]);
      push(A, n0); push(B, n1); push(C, n1);
      push(A, n0); push(C, n1); push(D, n0);
    }
  }
}

// A capped cylinder centred at z=zc along the Z axis. Used for flanges (thin,
// wide) and the hub barrel (thick, narrow).
function addCoin(m: Mesh, zc: number, rad: number, half: number, seg: number, col: number[]) {
  const zf = zc + half, zb = zc - half;
  const ring = (t: number) => [rad * Math.cos(t), rad * Math.sin(t)];
  for (let i = 0; i < seg; i++) {
    const t0 = (2 * Math.PI * i) / seg;
    const t1 = (2 * Math.PI * (i + 1)) / seg;
    const [x0, y0] = ring(t0);
    const [x1, y1] = ring(t1);
    const n0 = [Math.cos(t0), Math.sin(t0), 0];
    const n1 = [Math.cos(t1), Math.sin(t1), 0];
    // side quad
    m.push(x0, y0, zb, n0[0], n0[1], 0, col[0], col[1], col[2]);
    m.push(x1, y1, zb, n1[0], n1[1], 0, col[0], col[1], col[2]);
    m.push(x1, y1, zf, n1[0], n1[1], 0, col[0], col[1], col[2]);
    m.push(x0, y0, zb, n0[0], n0[1], 0, col[0], col[1], col[2]);
    m.push(x1, y1, zf, n1[0], n1[1], 0, col[0], col[1], col[2]);
    m.push(x0, y0, zf, n0[0], n0[1], 0, col[0], col[1], col[2]);
    // front cap (+Z) and back cap (-Z) fans
    m.push(0, 0, zf, 0, 0, 1, col[0], col[1], col[2]);
    m.push(x0, y0, zf, 0, 0, 1, col[0], col[1], col[2]);
    m.push(x1, y1, zf, 0, 0, 1, col[0], col[1], col[2]);
    m.push(0, 0, zb, 0, 0, -1, col[0], col[1], col[2]);
    m.push(x1, y1, zb, 0, 0, -1, col[0], col[1], col[2]);
    m.push(x0, y0, zb, 0, 0, -1, col[0], col[1], col[2]);
  }
}

// A capsule (cylinder + hemispherical caps) between two points. Used for the
// valve marker so it's solid from every viewing angle.
function addCapsule(m: Mesh, a: number[], b: number[], rad: number, seg: number, col: number[]) {
  let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  // orthonormal basis (u, v) perpendicular to the axis d
  let rx = 1, ry = 0, rz = 0;
  if (Math.abs(dx) > 0.9) { rx = 0; ry = 1; rz = 0; }
  let ux = ry * dz - rz * dy, uy = rz * dx - rx * dz, uz = rx * dy - ry * dx;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;
  const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
  const push = (p: number[], nrm: number[]) =>
    m.push(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], col[0], col[1], col[2]);
  const rings = 6;
  // body: ring point at fraction s along the axis, angle θ
  const body = (s: number, ct: number, st: number) => {
    const nx = ct * ux + st * vx, ny = ct * uy + st * vy, nz = ct * uz + st * vz;
    const cx = a[0] + dx * len * s, cy = a[1] + dy * len * s, cz = a[2] + dz * len * s;
    return { p: [cx + nx * rad, cy + ny * rad, cz + nz * rad], n: [nx, ny, nz] };
  };
  // hemisphere point: latitude φ, longitude θ, around a cap centre / direction
  const capV = (c: number[], sign: number, sf: number, cf: number, ct: number, st: number) => {
    const rx2 = ct * ux + st * vx, ry2 = ct * uy + st * vy, rz2 = ct * uz + st * vz;
    const nx = sf * rx2 + cf * sign * dx, ny = sf * ry2 + cf * sign * dy, nz = sf * rz2 + cf * sign * dz;
    return { p: [c[0] + nx * rad, c[1] + ny * rad, c[2] + nz * rad], n: [nx, ny, nz] };
  };
  const quad = (q0: any, q1: any, q2: any, q3: any) => {
    push(q0.p, q0.n); push(q1.p, q1.n); push(q2.p, q2.n);
    push(q0.p, q0.n); push(q2.p, q2.n); push(q3.p, q3.n);
  };
  for (let i = 0; i < seg; i++) {
    const t0 = (2 * Math.PI * i) / seg, t1 = (2 * Math.PI * (i + 1)) / seg;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    quad(body(0, c0, s0), body(1, c0, s0), body(1, c1, s1), body(0, c1, s1));
    for (let j = 0; j < rings; j++) {
      const f0 = (Math.PI / 2) * (j / rings), f1 = (Math.PI / 2) * ((j + 1) / rings);
      const sf0 = Math.cos(f0), cf0 = Math.sin(f0), sf1 = Math.cos(f1), cf1 = Math.sin(f1);
      // cap at b (+d)
      quad(capV(b, 1, sf0, cf0, c0, s0), capV(b, 1, sf1, cf1, c0, s0),
        capV(b, 1, sf1, cf1, c1, s1), capV(b, 1, sf0, cf0, c1, s1));
      // cap at a (-d)
      quad(capV(a, -1, sf0, cf0, c1, s1), capV(a, -1, sf1, cf1, c1, s1),
        capV(a, -1, sf1, cf1, c0, s0), capV(a, -1, sf0, cf0, c0, s0));
    }
  }
}

// Valve marker: a slim capsule at the rim pointing inward (like a presta
// valve). Built into the mesh so it's always shown as a lacing reference.
function addValve(m: Mesh, angle: number, col: number[]) {
  const rx = Math.cos(angle), ry = Math.sin(angle);
  addCapsule(m, [1.02 * rx, 1.02 * ry, 0], [0.85 * rx, 0.85 * ry, 0], 0.017, 14, col);
}

// A thin open cylinder (no caps) between two points — used for spoke segments.
function addTube(m: Mesh, a: number[], b: number[], rad: number, seg: number, col: number[]) {
  let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  let rx = 1, ry = 0, rz = 0;
  if (Math.abs(dx) > 0.9) { rx = 0; ry = 1; rz = 0; }
  let ux = ry * dz - rz * dy, uy = rz * dx - rx * dz, uz = rx * dy - ry * dx;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;
  const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
  const push = (p: number[], n: number[]) =>
    m.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2]);
  const ring = (e: number[], ct: number, st: number) => {
    const nx = ct * ux + st * vx, ny = ct * uy + st * vy, nz = ct * uz + st * vz;
    return { p: [e[0] + nx * rad, e[1] + ny * rad, e[2] + nz * rad], n: [nx, ny, nz] };
  };
  for (let i = 0; i < seg; i++) {
    const t0 = (2 * Math.PI * i) / seg, t1 = (2 * Math.PI * (i + 1)) / seg;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    const a0 = ring(a, c0, s0), b0 = ring(b, c0, s0), b1 = ring(b, c1, s1), a1 = ring(a, c1, s1);
    push(a0.p, a0.n); push(b0.p, b0.n); push(b1.p, b1.n);
    push(a0.p, a0.n); push(b1.p, b1.n); push(a1.p, a1.n);
  }
}

// A flat disc closing one end of a tube: centre c, facing along unit dir d.
function addCap(m: Mesh, c: number[], d: number[], rad: number, seg: number, col: number[]) {
  let rx = 1, ry = 0, rz = 0;
  if (Math.abs(d[0]) > 0.9) { rx = 0; ry = 1; rz = 0; }
  let ux = ry * d[2] - rz * d[1], uy = rz * d[0] - rx * d[2], uz = rx * d[1] - ry * d[0];
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;
  const vx = d[1] * uz - d[2] * uy, vy = d[2] * ux - d[0] * uz, vz = d[0] * uy - d[1] * ux;
  const push = (p: number[]) => m.push(p[0], p[1], p[2], d[0], d[1], d[2], col[0], col[1], col[2]);
  const rim = (ct: number, st: number) => [
    c[0] + (ct * ux + st * vx) * rad,
    c[1] + (ct * uy + st * vy) * rad,
    c[2] + (ct * uz + st * vz) * rad,
  ];
  for (let i = 0; i < seg; i++) {
    const t0 = (2 * Math.PI * i) / seg, t1 = (2 * Math.PI * (i + 1)) / seg;
    push(c); push(rim(Math.cos(t0), Math.sin(t0))); push(rim(Math.cos(t1), Math.sin(t1)));
  }
}

// A thin disc (short capped cylinder along Z) centred at (cx, cy, cz), lying in
// a plane parallel to the flange — the spoke's round button head.
function addButton(m: Mesh, cx: number, cy: number, cz: number, r: number, half: number, seg: number, col: number[]) {
  const zf = cz + half, zb = cz - half;
  const p = (x: number, y: number, z: number, n: number[]) =>
    m.push(x, y, z, n[0], n[1], n[2], col[0], col[1], col[2]);
  for (let i = 0; i < seg; i++) {
    const t0 = (2 * Math.PI * i) / seg, t1 = (2 * Math.PI * (i + 1)) / seg;
    const x0 = cx + r * Math.cos(t0), y0 = cy + r * Math.sin(t0);
    const x1 = cx + r * Math.cos(t1), y1 = cy + r * Math.sin(t1);
    const n0 = [Math.cos(t0), Math.sin(t0), 0], n1 = [Math.cos(t1), Math.sin(t1), 0];
    // rim
    p(x0, y0, zb, n0); p(x1, y1, zb, n1); p(x1, y1, zf, n1);
    p(x0, y0, zb, n0); p(x1, y1, zf, n1); p(x0, y0, zf, n0);
    // front cap (+Z) and back cap (-Z)
    p(cx, cy, zf, [0, 0, 1]); p(x0, y0, zf, [0, 0, 1]); p(x1, y1, zf, [0, 0, 1]);
    p(cx, cy, zb, [0, 0, -1]); p(x1, y1, zb, [0, 0, -1]); p(x0, y0, zb, [0, 0, -1]);
  }
}

// A bent spoke: a chain of straight tubes through the given points. Lets a spoke
// weave (the small z-bend where it dives under a crossing spoke) rather than run
// dead straight. Point count is fixed so every spoke has the same vertex count.
function addPolyTube(m: Mesh, pts: number[][], rad: number, seg: number, col: number[]) {
  for (let i = 0; i < pts.length - 1; i++) addTube(m, pts[i], pts[i + 1], rad, seg, col);
}

// Where two spoke chords cross in the wheel plane. Returns the crossing point and
// its parameter t along the first chord (0 = hub, 1 = rim), or null if the
// straight segments don't meet away from their ends. Used to find a leading
// spoke's outermost crossing — the one it must dive under.
function chordCross(a: number[], b: number[], c: number[], d: number[]) {
  const rx = b[0] - a[0], ry = b[1] - a[1];
  const sx = d[0] - c[0], sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = c[0] - a[0], qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
  return { x: a[0] + t * rx, y: a[1] + t * ry, t };
}

const VERT_SRC = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uMVP;
uniform mat4 uModel;
varying vec3 vColor;
varying float vLit;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  vColor = aColor;
  if (dot(aNormal, aNormal) < 0.0001) {
    vLit = 1.0; // unlit line (spoke)
  } else {
    vec3 n = normalize(mat3(uModel) * aNormal);
    vec3 L = normalize(vec3(0.35, 0.5, 0.8));
    vLit = 0.4 + 0.6 * max(dot(n, L), 0.0);
  }
}`;

const FRAG_SRC = `
precision mediump float;
varying vec3 vColor;
varying float vLit;
void main() { gl_FragColor = vec4(vColor * vLit, 1.0); }`;

interface GLState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  loc: {
    aPos: number;
    aNormal: number;
    aColor: number;
    uMVP: WebGLUniformLocation | null;
    uModel: WebGLUniformLocation | null;
  };
  mesh: WebGLBuffer;
  spokes: WebGLBuffer;
  meshVerts: number;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
  return s;
}

export function Wheel3D(props: Wheel3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<GLState | null>(null);
  const [failed, setFailed] = useState(false);
  const [rot, setRot] = useState({ x: 0, y: Math.PI / 4 }); // default: 45° three-quarter view
  const [zoom, setZoom] = useState(1); // 1 = whole wheel, higher = closer to hub
  const [, force] = useState(0); // bump to redraw (e.g. on resize)
  const drag = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);

  // Redraw when the canvas (which fills the panel) is resized.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => force((v) => v + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Trackpad pinch-zoom: macOS delivers it as a wheel event with ctrlKey set.
  // Plain two-finger scroll (no ctrlKey) is left alone so the page still scrolls.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      cancelAnimationFrame(raf.current);
      setZoom((z) => Math.max(1, Math.min(3.2, z * Math.exp(-e.deltaY * 0.01))));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Animate the camera to a preset orientation (Face / Side) and whole-wheel zoom.
  const animateTo = (tx: number, ty: number) => {
    cancelAnimationFrame(raf.current);
    const from = { x: rot.x, y: rot.y, z: zoom };
    // shortest angular path for the yaw
    const toY = ty + 2 * Math.PI * Math.round((from.y - ty) / (2 * Math.PI));
    const start = performance.now();
    const dur = 420;
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = ease(t);
      setRot({ x: from.x + (tx - from.x) * e, y: from.y + (toY - from.y) * e });
      setZoom(from.z + (1 - from.z) * e);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const {
    erdMm,
    spokeCount,
    leftFlangeDiaMm,
    rightFlangeDiaMm,
    leftOffsetMm,
    rightOffsetMm,
    leftCross,
    rightCross,
    leftGroup,
    rightGroup,
    leftPattern,
    rightPattern,
    ratio,
    ndsCentre = false,
    crossPhase = false,
    rimHoleGroup = 1,
    rimHoleGap = 1,
    rimHoleOffsetMm,
    hubType,
    hubWidthMm,
    step,
    sequence,
  } = props;
  const phase = crossPhase ? 1 : 0;

  // Init GL + program once the canvas exists.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) {
      setFailed(true);
      return;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      setFailed(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    const mesh = gl.createBuffer();
    const spokes = gl.createBuffer();
    if (!mesh || !spokes) {
      setFailed(true);
      return;
    }
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    glRef.current = {
      gl,
      program,
      loc: {
        aPos: gl.getAttribLocation(program, "aPos"),
        aNormal: gl.getAttribLocation(program, "aNormal"),
        aColor: gl.getAttribLocation(program, "aColor"),
        uMVP: gl.getUniformLocation(program, "uMVP"),
        uModel: gl.getUniformLocation(program, "uModel"),
      },
      mesh,
      spokes,
      meshVerts: 0,
    };
    return () => {
      gl.deleteBuffer(mesh);
      gl.deleteBuffer(spokes);
      gl.deleteProgram(program);
      glRef.current = null;
    };
  }, []);

  // Rebuild geometry buffers whenever the wheel dimensions change.
  useEffect(() => {
    const s = glRef.current;
    if (!s) return;
    const { gl } = s;
    const scale = 2 / erdMm; // rim radius -> 1 unit
    const lfR = (leftFlangeDiaMm / 2) * scale;
    const rfR = (rightFlangeDiaMm / 2) * scale;
    const zL = -leftOffsetMm * scale;
    const zR = rightOffsetMm * scale;
    // Axial offset of each rim hole toward the flange it serves. 0 = centred
    // (single-drilled); a positive value models alternating (staggered) drilling.
    // Clamped to the rim's half-width so the hole always lands on the spoke bed.
    const stagger = Math.max(0, Math.min((rimHoleOffsetMm ?? 0) * scale, 0.04));

    const flHalf = 0.008; // flange half-thickness
    // The flange diameter is the spoke-hole circle (PCD); the flange disc extends
    // a few mm beyond it so the holes sit inside the edge, not on it.
    const flEdge = 4 * scale;
    const bedR = 1; // spoke bed sits at ERD/2; the rim body extends outward

    // Rim cross-section [dr, z]: inner wall (spoke bed) at dr=0, sidewalls out to
    // the shoulders, and a concave outer channel that dips inward at the centre.
    const depth = 0.06, halfW = 0.045;
    const rimProfile = [
      [0, -halfW],           // inner wall (spoke bed), left
      [0, halfW],            // inner wall, right
      [depth, halfW],        // outer-right shoulder
      [depth * 0.4, 0],      // concave tyre channel (dips inward)
      [depth, -halfW],       // outer-left shoulder
    ];

    // Shaded mesh: rim + hub (axle, shell, flanges) + valve marker.
    const mesh: Mesh = [];
    addRim(mesh, bedR, rimProfile, 120, METAL);

    // --- Hub -----------------------------------------------------------------
    // The shell spans between the flanges; the axle runs the full over-locknut
    // width to a lock-nut at each end (when a hub with a known width is chosen).
    // Different hub types get a distinct silhouette: a fat shell for dynamo and
    // internal-gear hubs (the latter bulging toward the drive side), and a
    // freehub driver body outboard of the drive flange for cassette hubs.
    const zMid = (zL + zR) / 2;
    const shellHalf = Math.abs(zR - zL) / 2 + 0.03;
    const flMin = Math.min(lfR, rfR);
    // Drive side is +Z (the right / drive flange sits at zR ≥ zL for a dished
    // rear wheel); the freehub and gear bulge live out there.
    const driveZ = Math.max(zL, zR);

    if (hubWidthMm) {
      const axleHalf = (hubWidthMm / 2) * scale;
      addCoin(mesh, 0, 0.016, axleHalf, 18, AXLE); // axle across the locknuts
      addCoin(mesh, axleHalf - 0.006, 0.03, 0.007, 18, LOCKNUT); // drive lock-nut
      addCoin(mesh, -(axleHalf - 0.006), 0.03, 0.007, 18, LOCKNUT); // non-drive lock-nut
    }

    if (hubType === "front-dynamo") {
      // Fat cylindrical dynamo shell nearly reaching the flanges.
      addCoin(mesh, zMid, Math.max(0.085, 0.92 * flMin), shellHalf, 40, SHELL);
    } else if (hubType === "rear-internal") {
      // Fat gear shell, with an extra drum biased to the drive side (the gears).
      const r = Math.max(0.085, 0.74 * flMin);
      addCoin(mesh, zMid, r, shellHalf, 40, SHELL);
      const bulgeOut = hubWidthMm ? (hubWidthMm / 2) * scale * 0.66 : driveZ + 0.06;
      if (bulgeOut > zMid) {
        addCoin(mesh, (zMid + bulgeOut) / 2, r * 1.16, (bulgeOut - zMid) / 2, 40, SHELL);
      }
    } else {
      addCoin(mesh, zMid, 0.05, shellHalf, 24, BARREL); // slim barrel
    }

    // Freehub driver body: a dark splined drum outboard of the drive flange.
    if (hubType === "rear-cassette" && hubWidthMm) {
      const fhStart = driveZ + flHalf;
      const fhEnd = (hubWidthMm / 2) * scale - 0.02;
      if (fhEnd > fhStart + 0.01) {
        addCoin(mesh, (fhStart + fhEnd) / 2, 0.036, (fhEnd - fhStart) / 2, 24, FREEHUB);
      }
    }

    addCoin(mesh, zL, lfR + flEdge, flHalf, 48, METAL);
    addCoin(mesh, zR, rfR + flEdge, flHalf, 48, METAL);
    addValve(mesh, -Math.PI / spokeCount, VALVE);

    // Empty spoke holes drilled in the flanges and the rim (bed + tyre channel).
    // Static, so they show through the lacing animation until a spoke/nipple
    // fills each one.
    const holeR = 0.008;
    const outerHoleR = 0.007;
    // The tyre channel is a concave valley in z, so a flat outward-facing disc
    // gets clipped by the rising walls unless it sits proud of the floor across
    // its whole width. Place it just past the floor at its outermost z edge.
    const zEdge = Math.min(Math.abs(stagger) + outerHoleR, halfW);
    const outerR = 1 + depth * (0.4 + (0.6 * zEdge) / halfW) + 0.0015;
    // Which flange each rim hole feeds (1:1 alternates, 2:1 is drive-doubled),
    // plus its per-flange index and that flange's spoke count.
    const holes = wheelLayout(spokeCount, ratio, ndsCentre);
    for (let i = 0; i < spokeCount; i++) {
      const { isDrive, flangeIndex, flangeSpokes } = holes[i];
      const fR = isDrive ? rfR : lfR;
      const zF = isDrive ? zR : zL;
      const plan = spokePlan(flangeIndex, {
        cross: isDrive ? rightCross : leftCross,
        group: isDrive ? rightGroup : leftGroup,
        pattern: isDrive ? rightPattern : leftPattern,
        phase,
      });
      // The flange stays evenly drilled (even angle); only the rim hole clusters.
      const evenA = (2 * Math.PI * i) / spokeCount;
      const flA = evenA + plan.offset * ((2 * Math.PI) / flangeSpokes);
      const rimA = rimHoleAngle(i, spokeCount, rimHoleGroup, rimHoleGap);
      // flange hole: a dark disc set through the flange thickness
      addButton(mesh, fR * Math.cos(flA), fR * Math.sin(flA), zF, holeR, flHalf + 0.001, SPOKE_SEG, HOLE);
      const ca = Math.cos(rimA), sa = Math.sin(rimA);
      const zRim = isDrive ? stagger : -stagger;
      // rim-bed hole: a dark disc on the inner wall, facing the hub
      addCap(mesh, [0.999 * ca, 0.999 * sa, zRim], [-ca, -sa, 0], holeR, SPOKE_SEG, HOLE);
      // outer hole: a dark disc on the tyre-channel floor, facing outward
      addCap(mesh, [outerR * ca, outerR * sa, zRim], [ca, sa, 0], outerHoleR, SPOKE_SEG, HOLE);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, s.mesh);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.STATIC_DRAW);
    s.meshVerts = mesh.length / 9;

    // Spoke tubes, ordered by the build sequence so drawing the first `step`
    // spokes reveals them in build order (matches the 2D scrubber exactly). Each
    // spoke: a four-segment body (so it can weave), an elbow through the flange, a
    // button head on the far face, and a nipple seated in the rim bed.
    const n = spokeCount;
    const tube: Mesh = [];
    const rad = 0.005; // spoke radius (~1.5 mm at a 700C ERD)

    // Every spoke's flange hole and rim hole in the wheel plane (radius 1 = ERD),
    // plus its lead/flange, so we can find where leading and trailing spokes cross.
    const chords = Array.from({ length: n }, (_, i) => {
      const { isDrive, flangeIndex, flangeSpokes } = holes[i];
      const fR = isDrive ? rfR : lfR;
      const plan = spokePlan(flangeIndex, {
        cross: isDrive ? rightCross : leftCross,
        group: isDrive ? rightGroup : leftGroup,
        pattern: isDrive ? rightPattern : leftPattern,
        phase,
      });
      const evenA = (2 * Math.PI * i) / n;
      const flA = evenA + plan.offset * ((2 * Math.PI) / flangeSpokes);
      const rimA = rimHoleAngle(i, n, rimHoleGroup, rimHoleGap);
      return {
        isDrive,
        lead: plan.lead,
        hub: [fR * Math.cos(flA), fR * Math.sin(flA)],
        rim: [Math.cos(rimA), Math.sin(rimA)],
      };
    });
    // A leading spoke's outermost crossing (largest radius) with a trailing spoke
    // on the same flange — the one it dives inboard of. null for radial / uncrossed.
    const outermostCross = (idx: number) => {
      const L = chords[idx];
      if (L.lead === 0) return null; // radial spokes never weave
      let best: { x: number; y: number; t: number } | null = null;
      let bestR = -1;
      for (let j = 0; j < n; j++) {
        const T = chords[j];
        if (T.isDrive !== L.isDrive || T.lead === L.lead || T.lead === 0) continue;
        const x = chordCross(L.hub, L.rim, T.hub, T.rim);
        if (x) {
          const r = Math.hypot(x.x, x.y);
          if (r > bestR) { bestR = r; best = x; }
        }
      }
      return best;
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    for (const i of sequence) {
      const { isDrive, flangeIndex, flangeSpokes } = holes[i];
      const fR = isDrive ? rfR : lfR;
      const zF = isDrive ? zR : zL;
      const plan = spokePlan(flangeIndex, {
        cross: isDrive ? rightCross : leftCross,
        group: isDrive ? rightGroup : leftGroup,
        pattern: isDrive ? rightPattern : leftPattern,
        phase,
      });
      const lead = plan.lead;
      const leading = lead === 1; // the group laced last, woven under at the last cross
      // Shade by role: 0 = leading (light), 1 = radial (mid), 2 = trailing (dark).
      const shade = lead === 1 ? 0 : lead === 0 ? 1 : 2;
      const col = (isDrive ? [DRIVE_OUT, DRIVE_MID, DRIVE_IN] : [NDS_OUT, NDS_MID, NDS_IN])[shade];
      const evenA = (2 * Math.PI * i) / n;
      const flA = evenA + plan.offset * ((2 * Math.PI) / flangeSpokes);
      const rimA = rimHoleAngle(i, n, rimHoleGroup, rimHoleGap);
      const zRim = isDrive ? stagger : -stagger;
      const hx = fR * Math.cos(flA);
      const hy = fR * Math.sin(flA);
      const ca = Math.cos(rimA), sa = Math.sin(rimA);
      const bed = [ca, sa, zRim]; // spoke bed at radius 1 (ERD)

      // Outboard is away from the wheel centre for this flange. The body leaves the
      // flange centre and the elbow/head sit on one face for the J-bend look.
      const outSign = isDrive ? 1 : -1;
      const headZ = zF + (leading ? 1 : -1) * outSign * (flHalf + 0.003);

      // Straight body point at chord fraction t (0 = hub, 1 = rim), z on the
      // undished line from the flange centre to the rim bed, plus a nudge dz.
      const at = (t: number, dz: number) => [
        lerp(hx, ca, t),
        lerp(hy, sa, t),
        lerp(zF, zRim, t) + dz,
      ];
      // A crossing pair each bend once, near their shared outermost crossing: the
      // leading spoke kinks a hair inboard (so it passes behind), the trailing spoke
      // a hair outboard (in front). Each then runs dead straight to its nipple. The
      // small axial gap at the crossing is what makes which-is-in-front readable.
      const cross = outermostCross(i);
      let pts: number[][];
      if (cross) {
        const tc = cross.t;
        const gap = 0.005; // half the axial separation at the crossing (~5 mm)
        const s = leading ? -1 : 1; // leading dips inboard, trailing lifts outboard
        const bend = at(tc, -outSign * gap * s);
        const hubGap = 0.01; // half the axial separation at the flange (try 0.006–0.012); 0 = both start centred
        const flange = [hx, hy, zF + outSign * hubGap * s];
        const mid = (p: number[], q: number[]) => [
          (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2,
        ];
        // Two straight legs (flange -> bend -> nipple), each split to keep the
        // vertex count fixed; the only kink is at the crossing.
        pts = [flange, mid(flange, bend), bend, mid(bend, bed), bed];
      } else {
        // Radial / uncrossed: straight (collinear points keep the vertex count fixed).
        pts = [at(0, 0), at(0.25, 0), at(0.5, 0), at(0.75, 0), bed];
      }
      addPolyTube(tube, pts, rad, SPOKE_SEG, col); // bent body

      const bodyP = [hx, hy, zF];
      const headP = [hx, hy, headZ];
      const nipHead = [1.045 * ca, 1.045 * sa, zRim]; // nipple head, up inside the rim
      addTube(tube, bodyP, headP, rad, SPOKE_SEG, col); // elbow through the flange
      addButton(tube, hx, hy, headZ, 0.014, 0.004, SPOKE_SEG, col); // round button head
      addTube(tube, bed, nipHead, 0.009, SPOKE_SEG, col); // nipple seated in the rim
      addCap(tube, nipHead, [ca, sa, 0], 0.009, SPOKE_SEG, col); // closed nipple end
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, s.spokes);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tube), gl.STATIC_DRAW);
  }, [
    erdMm,
    spokeCount,
    leftFlangeDiaMm,
    rightFlangeDiaMm,
    leftOffsetMm,
    rightOffsetMm,
    leftCross,
    rightCross,
    leftGroup,
    rightGroup,
    leftPattern,
    rightPattern,
    ratio,
    ndsCentre,
    crossPhase,
    rimHoleGroup,
    rimHoleGap,
    rimHoleOffsetMm,
    hubType,
    hubWidthMm,
    sequence,
  ]);

  // Draw on rotation / step / geometry change.
  useEffect(() => {
    const s = glRef.current;
    if (!s) return;
    const { gl, loc } = s;
    const canvas = gl.canvas as HTMLCanvasElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round((canvas.clientWidth || 300) * dpr));
    const ch = Math.max(1, Math.round((canvas.clientHeight || 300) * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Keep the wheel circular whatever the panel's shape: widen the vertical FOV
    // when the canvas is taller than wide so the wheel always fits.
    const aspect = cw / ch;
    let fovy = 0.74;
    if (aspect < 1) fovy = 2 * Math.atan(Math.tan(fovy / 2) / aspect);
    const model = multiply(rotateX(rot.x), rotateY(rot.y));
    const view = translateZ(-3.4 / zoom); // zoom in by moving the camera closer
    const proj = perspective(fovy, aspect, 0.05, 20);
    const mvp = multiply(proj, multiply(view, model));

    gl.useProgram(s.program);
    gl.uniformMatrix4fv(loc.uMVP, false, mvp);
    gl.uniformMatrix4fv(loc.uModel, false, model);

    const bind = (buf: WebGLBuffer) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const stride = 9 * 4;
      gl.enableVertexAttribArray(loc.aPos);
      gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(loc.aNormal);
      gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(loc.aColor);
      gl.vertexAttribPointer(loc.aColor, 3, gl.FLOAT, false, stride, 24);
    };

    bind(s.mesh);
    gl.drawArrays(gl.TRIANGLES, 0, s.meshVerts);
    bind(s.spokes);
    gl.drawArrays(gl.TRIANGLES, 0, Math.max(0, step) * VERTS_PER_SPOKE);
  });

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    cancelAnimationFrame(raf.current); // grabbing cancels any align animation
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setRot((r) => ({
      x: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, r.x + dy * 0.01)),
      y: r.y + dx * 0.01,
    }));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (failed) {
    return <p className="field-hint">3D view needs WebGL, which isn't available here.</p>;
  }

  return (
    <div className="wd-view">
      <canvas
        ref={canvasRef}
        className="wd-canvas"
        role="img"
        aria-label="Rotatable 3D wheel — drag to turn"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="wd-align">
        <button type="button" className="wd-align-btn" onClick={() => animateTo(0, 0)}>
          Face
        </button>
        <button type="button" className="wd-align-btn" onClick={() => animateTo(0, Math.PI / 2)}>
          Side
        </button>
      </div>
      <div className="wd-zoomcol">
        <span className="wd-zoom-ico" aria-hidden="true">🔍</span>
        <input
          className="wd-zoom-v"
          type="range"
          min={1}
          max={3.2}
          step={0.05}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </div>
      <div className="wd-caption wd-hint">3D · drag to rotate</div>
    </div>
  );
}
