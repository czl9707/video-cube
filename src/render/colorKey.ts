/**
 * Colour key for the 3D viewer: hide (or keep only) voxels whose colour is
 * close to a picked colour, e.g. hide the blue sky to see the shape of the
 * clouds over time. Viewer only; exports are never keyed.
 *
 * Closeness is measured in HSV. Each channel has its own tolerance and the
 * largest normalised difference decides: a voxel matches when
 *   max(dHue / hueTol, dSat / satTol, dVal / valTol) <= 1,
 * with a soft edge of width `softness` around 1. Hue is weighted down for
 * greyish colours, where it carries no meaning.
 *
 * The same maths runs in the fragment shader (see shaders.ts, keepByKey);
 * this module is the reference implementation and feeds the uniforms.
 */

export type ColorKeyMode = 'hide' | 'isolate';

export interface ColorKey {
  enabled: boolean;
  mode: ColorKeyMode;
  /** Key colour, sRGB 0..1. */
  color: [number, number, number];
  /** Hue tolerance in degrees (0..180). */
  hueTol: number;
  /** Saturation tolerance, 0..1. */
  satTol: number;
  /** Brightness (HSV value) tolerance, 0..1. */
  valTol: number;
  /** Edge softness, 0 (hard) .. 1 (very soft). */
  softness: number;
}

export const DEFAULT_COLOR_KEY: ColorKey = {
  enabled: false,
  mode: 'hide',
  color: [0.35, 0.6, 0.9],
  hueTol: 25,
  satTol: 0.45,
  valTol: 0.5,
  softness: 0.3,
};

/** sRGB 0..1 to HSV with hue in 0..1. */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max > 1e-6 ? d / max : 0, max];
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** How strongly a colour matches the key, 0..1. Mirrors the shader. */
export function keyMatch(key: ColorKey, rgb: [number, number, number]): number {
  const [h, s, v] = rgbToHsv(...rgb);
  const [kh, ks, kv] = rgbToHsv(...key.color);
  let dh = Math.abs(h - kh);
  dh = Math.min(dh, 1 - dh) * Math.min(1, Math.min(s, ks) * 5);
  const d = Math.max(
    dh / Math.max(1e-3, key.hueTol / 360),
    Math.abs(s - ks) / Math.max(1e-3, key.satTol),
    Math.abs(v - kv) / Math.max(1e-3, key.valTol),
  );
  const soft = Math.max(1e-3, key.softness);
  return 1 - smoothstep(1 - soft, 1 + soft, d);
}

/** Opacity multiplier for a voxel: 1 = untouched, 0 = keyed out. */
export function keyKeep(key: ColorKey, rgb: [number, number, number]): number {
  if (!key.enabled) return 1;
  const m = keyMatch(key, rgb);
  return key.mode === 'hide' ? 1 - m : m;
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const h = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}
