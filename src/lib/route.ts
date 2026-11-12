/**
 * The road the visitor drives along. Pure math (no three.js) so the minimap can
 * use it without pulling the 3D library into the main bundle.
 *
 * Units are roughly metres. The road runs from z = +40 toward negative z, winding
 * gently left and right. Positions along it are given as u in [0, 1] by distance.
 */

export type P2 = { x: number; z: number };

export const STOP_IDS = [
  "top",
  "results",
  "about",
  "skills",
  "experience",
  "projects",
  "education",
  "contact",
] as const;

export const STOP_LABELS = [
  "Start",
  "Results",
  "About",
  "Skills",
  "Experience",
  "Project",
  "Education",
  "Contact",
] as const;

const N_STOPS = STOP_IDS.length;

/** Where each stop sits along the road. Leaves a little road before the first and after the last. */
export const STOP_U = STOP_IDS.map((_, i) => 0.04 + (i * 0.9) / (N_STOPS - 1));

export const ROAD_HALF = 5;

const CONTROL: P2[] = Array.from({ length: 14 }, (_, i) => ({
  x: i < 2 ? 0 : Math.round(24 * Math.sin((i - 1) * 0.9)),
  z: 40 - i * 62,
}));

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

const SAMPLES = 2400;
const xs = new Float32Array(SAMPLES + 1);
const zs = new Float32Array(SAMPLES + 1);
const cum = new Float32Array(SAMPLES + 1);

(() => {
  const segs = CONTROL.length - 1;
  for (let i = 0; i <= SAMPLES; i++) {
    const g = (i / SAMPLES) * segs;
    const s = Math.min(segs - 1, Math.floor(g));
    const t = g - s;
    const p0 = CONTROL[Math.max(0, s - 1)];
    const p1 = CONTROL[s];
    const p2 = CONTROL[s + 1];
    const p3 = CONTROL[Math.min(CONTROL.length - 1, s + 2)];
    xs[i] = catmull(p0.x, p1.x, p2.x, p3.x, t);
    zs[i] = catmull(p0.z, p1.z, p2.z, p3.z, t);
    if (i > 0) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
  }
})();

export const ROUTE_LENGTH = cum[SAMPLES];

/** Point on the road centre line at u (0..1 by distance). */
export function pointAt(u: number): P2 {
  const d = Math.min(1, Math.max(0, u)) * ROUTE_LENGTH;
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < d) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo] || 1;
  const f = (d - cum[lo]) / span;
  return { x: xs[lo] + (xs[hi] - xs[lo]) * f, z: zs[lo] + (zs[hi] - zs[lo]) * f };
}

/** Unit direction of travel at u. */
export function tangentAt(u: number): P2 {
  const e = 0.0015;
  const a = pointAt(u - e);
  const b = pointAt(u + e);
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
}

/** Unit vector pointing to the right-hand side of the road at u. */
export function rightAt(u: number): P2 {
  const t = tangentAt(u);
  return { x: -t.z, z: t.x };
}

/** Rotation about Y that turns +Z to face along the road at u. */
export function yawAt(u: number) {
  const t = tangentAt(u);
  return Math.atan2(t.x, t.z);
}

/** A point beside the road: `side` metres to the right (negative = left) of u. */
export function besideRoad(u: number, side: number): P2 {
  const p = pointAt(u);
  const r = rightAt(u);
  return { x: p.x + r.x * side, z: p.z + r.z * side };
}

/** Approximate distance from (x, z) to the road centre line. */
export function distanceToRoad(x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i <= SAMPLES; i += 6) {
    const d = (xs[i] - x) ** 2 + (zs[i] - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Map a fractional stop position (0 = first stop, N-1 = last) to u. */
export function uFromStopFloat(f: number) {
  const c = Math.min(N_STOPS - 1, Math.max(0, f));
  const i = Math.min(N_STOPS - 2, Math.floor(c));
  const t = c - i;
  return STOP_U[i] + (STOP_U[i + 1] - STOP_U[i]) * t;
}

/** Evenly spaced polyline of the road, for drawing the minimap. */
export function routePolyline(step = 8): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= SAMPLES; i += step) out.push({ x: xs[i], z: zs[i] });
  return out;
}
