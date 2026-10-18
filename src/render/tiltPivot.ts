/**
 * Tilt-pivot geometry for the viewer's slice plane.
 *
 * The tilt pivot is the line across the cut face that keeps its position in
 * time while the plane tilts, given as a fraction along the gradient
 * direction: 0 = the edge the azimuth points to (the top for azimuth 0),
 * 0.5 = the centre, 1 = the opposite edge (the bottom for azimuth 0). The
 * gradient extent R below is the extent of the frame along the gradient
 * direction, so the pivot sits a distance (0.5 - pivot) * R from the centre.
 *
 * All coordinates are world-space with the volume box centred on the origin
 * (see volumeHalfExtents); plane offsets follow the viewer convention.
 */
import type { Vec3 } from './linalg';

const DEG = Math.PI / 180;

/** A plane as the viewer describes it (degrees, world-space offset). */
export interface ViewerPlane {
  azimuth: number;
  elevation: number;
  offset: number;
}

/** Aspect-preserving frame extent along the gradient direction (R above). */
export function gradientExtent(azimuthDeg: number, aspectX: number, aspectY: number): number {
  const a = azimuthDeg * DEG;
  return Math.abs(Math.sin(a)) * aspectX + Math.abs(Math.cos(a)) * aspectY;
}

/**
 * World-space point on the viewer plane that lies on the tilt pivot line, or
 * null when the plane is parallel to the time axis.
 */
export function pivotPoint(plane: ViewerPlane, half: Vec3, pivot: number): Vec3 | null {
  const az = plane.azimuth * DEG;
  const el = plane.elevation * DEG;
  const n: Vec3 = [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
  if (Math.abs(n[2]) < 1e-3) return null;
  const proj = (0.5 - pivot) * gradientExtent(plane.azimuth, 2 * half[0], 2 * half[1]);
  const px = proj * Math.sin(az);
  const py = proj * Math.cos(az);
  return [px, py, (plane.offset - n[0] * px - n[1] * py) / n[2]];
}

/**
 * Offset that keeps the tilt pivot of `prev` on the plane after its angles
 * change to `next`, so tilting rotates the plane around the pivot line instead
 * of around the centre of the cube.
 */
export function offsetAboutPivot(
  prev: ViewerPlane,
  next: { azimuth: number; elevation: number },
  half: Vec3,
  pivot: number,
): number {
  const p = pivotPoint(prev, half, pivot);
  if (!p) return prev.offset;
  const az = next.azimuth * DEG;
  const el = next.elevation * DEG;
  return Math.cos(el) * Math.sin(az) * p[0] + Math.cos(el) * Math.cos(az) * p[1] + Math.sin(el) * p[2];
}

type Point2 = [number, number];

/**
 * The tilt pivot line clipped to a frame with half extents (hx, hy), in the
 * same centred, Y-up units as the gradient extent. Null when the line
 * misses the frame.
 */
export function pivotSegment2D(azimuthDeg: number, pivot: number, hx: number, hy: number): [Point2, Point2] | null {
  const a = azimuthDeg * DEG;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const proj = (0.5 - pivot) * gradientExtent(azimuthDeg, 2 * hx, 2 * hy);
  const base: Point2 = [proj * sa, proj * ca];
  const dir: Point2 = [ca, -sa]; // along the pivot line, perpendicular to the gradient
  let t0 = -Infinity;
  let t1 = Infinity;
  const lim = [hx, hy];
  for (let k = 0; k < 2; k++) {
    if (Math.abs(dir[k]) < 1e-9) {
      if (Math.abs(base[k]) > lim[k] + 1e-9) return null;
      continue;
    }
    let u = (-lim[k] - base[k]) / dir[k];
    let v = (lim[k] - base[k]) / dir[k];
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
  }
  if (!(t1 >= t0 - 1e-9)) return null;
  if (t1 < t0) t1 = t0; // touches a corner: degenerate segment
  return [
    [base[0] + t0 * dir[0], base[1] + t0 * dir[1]],
    [base[0] + t1 * dir[0], base[1] + t1 * dir[1]],
  ];
}

/** The tilt pivot line on the viewer's slice plane, clipped to the volume box. */
export function pivotSegment3D(plane: ViewerPlane, half: Vec3, pivot: number): [Vec3, Vec3] | null {
  const p = pivotPoint(plane, half, pivot);
  if (!p || Math.abs(p[2]) > half[2]) return null;
  const seg = pivotSegment2D(plane.azimuth, pivot, half[0], half[1]);
  if (!seg) return null;
  return [
    [seg[0][0], seg[0][1], p[2]],
    [seg[1][0], seg[1][1], p[2]],
  ];
}
