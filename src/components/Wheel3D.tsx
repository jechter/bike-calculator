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
import type { HubType } from "../lib/spokes";

// Two shades per side so outer-laced (heads-out) and inner-laced (heads-in)
// spokes are visually distinct: the lighter shade is outer, the darker is inner.
const DRIVE_OUT: [number, number, number] = [0.87, 0.32, 0.24];
const DRIVE_IN: [number, number, number] = [0.5, 0.11, 0.08];
const NDS_OUT: [number, number, number] = [0.28, 0.58, 0.93];
const NDS_IN: [number, number, number] = [0.02, 0.26, 0.58];
const METAL: [number, number, number] = [0.62, 0.66, 0.71];
const VALVE: [number, number, number] = [0.78, 0.62, 0.22]; // brass valve marker
const HOLE: [number, number, number] = [0.1, 0.11, 0.13]; // empty spoke hole
const BARREL: [number, number, number] = [0.5, 0.54, 0.6]; // plain hub shell
const AXLE: [number, number, number] = [0.44, 0.47, 0.52]; // axle through the locknuts
const LOCKNUT: [number, number, number] = [0.32, 0.34, 0.38]; // end lock-nut / cap
const SHELL: [number, number, number] = [0.4, 0.42, 0.47]; // fat dynamo / gear shell
const FREEHUB: [number, number, number] = [0.2, 0.21, 0.24]; // dark freehub driver body

// One spoke draws as: a body tube (nipple -> flange face), a short elbow tube
// through the flange, a round button head lying flat on the far face (a little
// disc parallel to the flange), and a nipple at the rim bed. The head sits on
// the outboard face for heads-out spokes and the inboard face for heads-in ones,
// so you can read inside vs outside lacing. Vert budget per spoke: body + elbow
// + nipple (SPOKE_SEG*6 each) + button disc (SPOKE_SEG*12) + nipple cap
// (SPOKE_SEG*3).
const SPOKE_SEG = 6;
const VERTS_PER_SPOKE = SPOKE_SEG * 33;

export interface Wheel3DProps {
  erdMm: number;
  spokeCount: number;
  leftFlangeDiaMm: number;
  rightFlangeDiaMm: number;
  leftOffsetMm: number;
  rightOffsetMm: number;
  leftCross: number;
  rightCross: number;
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
  const [rot, setRot] = useState({ x: 0, y: 0 }); // default: face-on view
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
    hubType,
    hubWidthMm,
    step,
    sequence,
  } = props;

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
    // (single-drilled); a future rim option could enable alternating drilling.
    const stagger = 0 * scale;

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
    for (let i = 0; i < spokeCount; i++) {
      const isDrive = i % 2 === 0;
      const fR = isDrive ? rfR : lfR;
      const zF = isDrive ? zR : zL;
      const k = isDrive ? rightCross : leftCross;
      const lead = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
      const rimA = (2 * Math.PI * i) / spokeCount;
      const flA = rimA + lead * ((4 * Math.PI * k) / spokeCount);
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
    // spoke: body (nipple -> flange), elbow through the flange, button head on
    // the far face, and a nipple seated in the rim bed.
    const n = spokeCount;
    const tube: Mesh = [];
    const rad = 0.005; // spoke radius (~1.5 mm at a 700C ERD)
    for (const i of sequence) {
      const isDrive = i % 2 === 0;
      const fR = isDrive ? rfR : lfR;
      const zF = isDrive ? zR : zL;
      const k = isDrive ? rightCross : leftCross;
      const lead = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
      const headsOut = lead === 1; // alternates per flange -> in/out lacing
      const col = isDrive ? (headsOut ? DRIVE_OUT : DRIVE_IN) : headsOut ? NDS_OUT : NDS_IN;
      const rimA = (2 * Math.PI * i) / n;
      const flA = rimA + lead * ((4 * Math.PI * k) / n);
      const zRim = isDrive ? stagger : -stagger;
      const hx = fR * Math.cos(flA);
      const hy = fR * Math.sin(flA);
      // Outboard is the direction away from the wheel centre for this flange.
      const outSign = isDrive ? 1 : -1;
      // headDir points along the axle toward the face the head rests on.
      const headDir = outSign * (headsOut ? 1 : -1);
      const headZ = zF + headDir * (flHalf + 0.003); // button sits on the far face
      const bodyZ = zF - headDir * flHalf; // body emerges from the opposite face
      const bodyP = [hx, hy, bodyZ];
      const headP = [hx, hy, headZ];
      // Spoke rises to the rim bed (ERD); the nipple seats there and its head sits
      // up inside the rim channel, in the spoke's colour.
      const ca = Math.cos(rimA), sa = Math.sin(rimA);
      const bed = [ca, sa, zRim]; // spoke bed at radius 1 (ERD)
      const nipHead = [1.045 * ca, 1.045 * sa, zRim]; // nipple head, up inside the rim
      addTube(tube, bodyP, bed, rad, SPOKE_SEG, col); // body
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
