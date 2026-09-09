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

const DRIVE: [number, number, number] = [0.753, 0.224, 0.169]; // #c0392b
const NDS: [number, number, number] = [0.043, 0.42, 0.796]; // #0b6bcb
const METAL: [number, number, number] = [0.62, 0.66, 0.71];
const VALVE: [number, number, number] = [0.78, 0.62, 0.22]; // brass valve marker

// One spoke draws as three line segments so the elbow and head are visible:
// the main body (flange face -> rim), a short axial segment through the flange,
// and the head nub lying on the far face. Heads-out spokes sit on the outboard
// face, heads-in on the inboard face — so you can see inside vs outside lacing.
const VERTS_PER_SPOKE = 6;

export interface Wheel3DProps {
  erdMm: number;
  spokeCount: number;
  leftFlangeDiaMm: number;
  rightFlangeDiaMm: number;
  leftOffsetMm: number;
  rightOffsetMm: number;
  leftCross: number;
  rightCross: number;
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

function addTorus(m: Mesh, R: number, r: number, maj: number, min: number, col: number[]) {
  const v = (phi: number, psi: number) => {
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const cs = Math.cos(psi), ss = Math.sin(psi);
    const px = (R + r * cs) * cp;
    const py = (R + r * cs) * sp;
    const pz = r * ss;
    // normal points out of the tube surface
    const nx = cs * cp, ny = cs * sp, nz = ss;
    m.push(px, py, pz, nx, ny, nz, col[0], col[1], col[2]);
  };
  for (let i = 0; i < maj; i++) {
    const p0 = (2 * Math.PI * i) / maj;
    const p1 = (2 * Math.PI * (i + 1)) / maj;
    for (let j = 0; j < min; j++) {
      const q0 = (2 * Math.PI * j) / min;
      const q1 = (2 * Math.PI * (j + 1)) / min;
      v(p0, q0); v(p1, q0); v(p1, q1);
      v(p0, q0); v(p1, q1); v(p0, q1);
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

// A flat radial flag at the rim marking the valve hole (points inward, like a
// presta valve). Built into the shaded mesh so it's always shown, at any build
// step, as a lacing reference. Double-sided so it lights from either face.
function addValve(m: Mesh, angle: number, col: number[]) {
  const rx = Math.cos(angle), ry = Math.sin(angle);
  const nx = -Math.sin(angle), ny = Math.cos(angle); // flag-plane normal (tangential)
  const w = 0.035; // half-width along the axle
  const rOut = 1.0, rIn = 0.85;
  const P = (r: number, z: number) => [r * rx, r * ry, z];
  const p0 = P(rOut, w), p1 = P(rOut, -w), p2 = P(rIn, -w), p3 = P(rIn, w);
  const tri = (a: number[], b: number[], c: number[], n: number[]) => {
    for (const p of [a, b, c]) m.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2]);
  };
  tri(p0, p1, p2, [nx, ny, 0]); tri(p0, p2, p3, [nx, ny, 0]);
  tri(p0, p3, p2, [-nx, -ny, 0]); tri(p0, p2, p1, [-nx, -ny, 0]);
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
  const [rot, setRot] = useState({ x: 0.5, y: -0.6 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const {
    erdMm,
    spokeCount,
    leftFlangeDiaMm,
    rightFlangeDiaMm,
    leftOffsetMm,
    rightOffsetMm,
    leftCross,
    rightCross,
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
    const rimR = 1;
    const lfR = (leftFlangeDiaMm / 2) * scale;
    const rfR = (rightFlangeDiaMm / 2) * scale;
    const zL = -leftOffsetMm * scale;
    const zR = rightOffsetMm * scale;
    const stagger = 2 * scale; // rim holes drilled toward their flange

    const flHalf = 0.008; // flange half-thickness
    const face = 0.009; // where a spoke sits, just proud of the flange face

    // Shaded mesh: rim torus + hub barrel + two flanges + valve marker.
    const mesh: Mesh = [];
    addTorus(mesh, rimR, 0.045, 96, 12, METAL);
    addCoin(mesh, (zL + zR) / 2, 0.05, Math.abs(zR - zL) / 2 + 0.03, 24, [0.5, 0.54, 0.6]);
    addCoin(mesh, zL, lfR, flHalf, 48, METAL);
    addCoin(mesh, zR, rfR, flHalf, 48, METAL);
    addValve(mesh, -Math.PI / spokeCount, VALVE);
    gl.bindBuffer(gl.ARRAY_BUFFER, s.mesh);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.STATIC_DRAW);
    s.meshVerts = mesh.length / 9;

    // Spoke lines, ordered by the build sequence so drawing the first `step`
    // spokes reveals them in build order (matches the 2D scrubber exactly).
    // Each spoke is three segments: body (flange face -> rim), the elbow through
    // the flange, and the head nub on the far face.
    const n = spokeCount;
    const line: Mesh = [];
    const seg = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number[]) => {
      line.push(x0, y0, z0, 0, 0, 0, c[0], c[1], c[2]);
      line.push(x1, y1, z1, 0, 0, 0, c[0], c[1], c[2]);
    };
    for (const i of sequence) {
      const isDrive = i % 2 === 0;
      const fR = isDrive ? rfR : lfR;
      const zF = isDrive ? zR : zL;
      const k = isDrive ? rightCross : leftCross;
      const col = isDrive ? DRIVE : NDS;
      const lead = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
      const rimA = (2 * Math.PI * i) / n;
      const flA = rimA + lead * ((4 * Math.PI * k) / n);
      const zRim = isDrive ? stagger : -stagger;
      const hx = fR * Math.cos(flA);
      const hy = fR * Math.sin(flA);
      // Outboard is the direction away from the wheel centre for this flange.
      const outSign = isDrive ? 1 : -1;
      const headsOut = lead === 1; // alternates per flange -> in/out lacing
      const bodyZ = zF - outSign * face * (headsOut ? 1 : -1); // body leaves the near face
      const headZ = zF + outSign * face * (headsOut ? 1 : -1); // head sits on the far face
      // head nub direction: tangent to the flange, trailing the elbow
      const tx = -Math.sin(flA) * -lead;
      const ty = Math.cos(flA) * -lead;
      const headLen = 0.045;
      seg(hx, hy, bodyZ, rimR * Math.cos(rimA), rimR * Math.sin(rimA), zRim, col); // body
      seg(hx, hy, bodyZ, hx, hy, headZ, col); // elbow through flange
      seg(hx, hy, headZ, hx + tx * headLen, hy + ty * headLen, headZ, col); // head
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, s.spokes);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW);
  }, [
    erdMm,
    spokeCount,
    leftFlangeDiaMm,
    rightFlangeDiaMm,
    leftOffsetMm,
    rightOffsetMm,
    leftCross,
    rightCross,
    sequence,
  ]);

  // Draw on rotation / step / geometry change.
  useEffect(() => {
    const s = glRef.current;
    if (!s) return;
    const { gl, loc } = s;
    const canvas = gl.canvas as HTMLCanvasElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth || 300;
    const px = Math.round(size * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const model = multiply(rotateX(rot.x), rotateY(rot.y));
    const view = translateZ(-3.4);
    const proj = perspective(0.74, 1, 0.1, 20);
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
    gl.drawArrays(gl.LINES, 0, Math.max(0, step) * VERTS_PER_SPOKE);
  });

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
      <div className="wd-caption">3D · drag to rotate</div>
    </div>
  );
}
