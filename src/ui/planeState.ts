import type { Vec3 } from '@/render/linalg';

export type Axis = 'x' | 'y' | 'z';

export interface PlaneState {
  azimuth: number;
  elevation: number;
  offset: number;
  flip: boolean;
  axis: Axis | null;
}

/** Cut faces the time axis so it slices frames, parked a few frames into the
 *  stack (offset is refined once the volume extent is known). */
export const INITIAL_PLANE: PlaneState = {
  azimuth: 0,
  elevation: 90,
  offset: 0,
  flip: false,
  axis: 'z',
};

export function planeNormal(azimuth: number, elevation: number): Vec3 {
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  return [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
}
