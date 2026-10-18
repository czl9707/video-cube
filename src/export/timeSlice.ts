/**
 * Time-slice animation model.
 *
 * The video volume has two spatial axes (x, y) and one time axis (z). A slice
 * plane that is perpendicular to the time axis shows one ordinary video frame.
 * Tilting the plane makes every row (or column) of the output image come from
 * a different moment: a time gradient across the picture.
 *
 * For export we describe a plane in time terms rather than 3D terms, so the
 * result does not depend on the viewer's "Spacing" setting:
 *
 *   - `time`    the moment shown at the tilt pivot (by default the centre of
 *               the frame), normalised to the clip: 0 = first frame,
 *               1 = last frame.
 *   - `span`    how much clip time the plane covers from one edge of the
 *               frame to the opposite edge, in the same normalised units.
 *               0 = an ordinary frame. Negative values reverse the gradient.
 *   - `azimuth` direction of the gradient in degrees, using the same
 *               convention as the viewer's Azimuth slider.
 *
 * For a pixel at aspect-preserving image coordinates (X, Y), centred on the
 * frame with Y pointing up, the sampled clip time is
 *
 *   tau(X, Y) = time - span * (sin(az) * X + cos(az) * Y) / R
 *   R         = |sin(az)| * aspectX + |cos(az)| * aspectY
 *
 * R is the extent of the frame along the gradient direction, so the earliest
 * and latest moments visible in one output frame are exactly `|span|` apart.
 *
 * The tilt pivot is the line across the frame that keeps its moment while the
 * span changes, given as a fraction along the gradient direction: 0 = the edge
 * the azimuth points to (the top for azimuth 0), 0.5 = the centre, 1 = the
 * opposite edge (the bottom for azimuth 0). Internally everything is
 * converted to the centre time, which is what the renderer uses.
 *
 * The pivot geometry itself (pivot point, pivot line, offsets) lives in
 * render/tiltPivot.ts; this module handles the time model.
 */
import type { ViewerPlane } from '@/render/tiltPivot';
import { gradientExtent } from '@/render/tiltPivot';
import type { Vec3 } from '@/render/linalg';

export interface SliceKeyframe {
  /** Clip time at the tilt pivot, 0..1. */
  time: number;
  /** Signed clip time covered edge to edge, in clip units (1 = whole clip). */
  span: number;
  /** Gradient direction in degrees (viewer azimuth convention). */
  azimuth: number;
}

export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export const EASINGS: { id: Easing; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'easeInOut', label: 'Ease in-out' },
  { id: 'easeIn', label: 'Ease in' },
  { id: 'easeOut', label: 'Ease out' },
];

export interface SliceAnimation {
  start: SliceKeyframe;
  end: SliceKeyframe;
  /** Easing for the tilt (span) and direction transition. Time always moves linearly. */
  easing: Easing;
  /** Tilt pivot along the gradient direction, 0..1 (0.5 = frame centre). */
  pivot: number;
}

/**
 * Resolved slice for one output frame. `time` is the clip time at the frame
 * centre and already includes the pivot shift.
 */
export interface SliceParams {
  time: number;
  span: number;
  azimuth: number;
}

export const DEFAULT_ANIMATION: SliceAnimation = {
  start: { time: 0, span: 0, azimuth: 0 },
  end: { time: 1, span: 0, azimuth: 0 },
  easing: 'linear',
  pivot: 0.5,
};

const DEG = Math.PI / 180;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function ease(kind: Easing, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (kind) {
    case 'easeIn':
      return x * x * x;
    case 'easeOut':
      return 1 - (1 - x) ** 3;
    case 'easeInOut':
      return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
    default:
      return x;
  }
}

/** Offset from the pivot time to the centre time:
 * centre = pivotTime + pivotShift(span, pivot). */
export function pivotShift(span: number, pivot: number): number {
  return span * (0.5 - pivot);
}

/** Wrap an angle into [-180, 180]. */
export function wrapDegrees(d: number): number {
  const w = ((((d + 180) % 360) + 360) % 360) - 180;
  return w === -180 && d > 0 ? 180 : w;
}

/** Slice parameters at animation progress `p` (0 = first frame, 1 = last). */
export function sliceAt(anim: SliceAnimation, p: number): SliceParams {
  const t = Math.min(1, Math.max(0, p));
  const shape = ease(anim.easing, t);
  const span = lerp(anim.start.span, anim.end.span, shape);
  // Interpolate the signed shortest turn so e.g. -170deg -> 170deg sweeps
  // 20deg through the wrap instead of 340deg the long way around.
  const azimuth = anim.start.azimuth + wrapDegrees(anim.end.azimuth - anim.start.azimuth) * shape;
  const time = lerp(anim.start.time, anim.end.time, t);
  return { time: time + pivotShift(span, anim.pivot), span, azimuth };
}

/** Progress value for output frame `i` of `count`. */
export function frameProgress(i: number, count: number): number {
  return count <= 1 ? 0 : i / (count - 1);
}

/** Earliest and latest clip time touched by one output frame (may exceed 0..1). */
export function sliceTimeRange(s: SliceParams): [number, number] {
  const h = Math.abs(s.span) / 2;
  return [s.time - h, s.time + h];
}

/**
 * Source frame indices (inclusive) needed to render the given output frames
 * from a stack of `sourceCount` frames. Frame k is centred at (k + 0.5) / N.
 */
export function sourceFrameRange(
  anim: SliceAnimation,
  outputFrames: number[],
  outputCount: number,
  sourceCount: number,
): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const i of outputFrames) {
    const [a, b] = sliceTimeRange(sliceAt(anim, frameProgress(i, outputCount)));
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  const k0 = Math.floor(lo * sourceCount - 0.5);
  const k1 = Math.ceil(hi * sourceCount - 0.5);
  const last = sourceCount - 1;
  return [Math.min(last, Math.max(0, k0)), Math.min(last, Math.max(0, k1))];
}

/**
 * Convert the viewer's slice plane into a keyframe whose time is measured at
 * `pivot`. `half` is the world-space half extent of the volume box (see
 * volumeHalfExtents). Returns null when the plane is (almost) parallel to the
 * time axis: such a plane does not map each pixel to a single moment.
 */
export function keyframeFromPlane(plane: ViewerPlane, half: Vec3, pivot = 0.5): SliceKeyframe | null {
  const el = plane.elevation * DEG;
  const nz = Math.sin(el);
  if (Math.abs(nz) < 0.02) return null;
  const zc = plane.offset / nz;
  const time = (zc + half[2]) / (2 * half[2]);
  const R = gradientExtent(plane.azimuth, 2 * half[0], 2 * half[1]);
  const span = ((Math.cos(el) / nz) * R) / (2 * half[2]);
  return { time: time - pivotShift(span, pivot), span, azimuth: plane.azimuth };
}

/**
 * Viewer plane for a resolved slice (centre time, as returned by sliceAt),
 * normalised to elevation in (0, 90].
 */
export function planeFromKeyframe(kf: SliceParams, half: Vec3): ViewerPlane {
  let { span, azimuth } = kf;
  if (span < 0) {
    span = -span;
    azimuth = wrapDegrees(azimuth + 180);
  }
  const R = gradientExtent(azimuth, 2 * half[0], 2 * half[1]);
  const el = Math.atan2(R, span * 2 * half[2]);
  const zc = kf.time * 2 * half[2] - half[2];
  return { azimuth, elevation: el / DEG, offset: zc * Math.sin(el) };
}

/** Tilt away from an ordinary frame, in degrees, as it appears in the 3D view. */
export function tiltDegrees(kf: SliceParams, half: Vec3): number {
  return 90 - planeFromKeyframe(kf, half).elevation;
}
