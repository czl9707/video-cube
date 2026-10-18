import { describe, it, expect } from 'vitest';
import { DEFAULT_COLOR_KEY, hexToRgb, keyKeep, keyMatch, rgbToHex, rgbToHsv } from '../src/render/colorKey';
import type { ColorKey } from '../src/render/colorKey';

const sky: ColorKey = { ...DEFAULT_COLOR_KEY, enabled: true, color: [0.35, 0.6, 0.9] };

describe('rgbToHsv', () => {
  it('converts primaries and greys', () => {
    expect(rgbToHsv(1, 0, 0)).toEqual([0, 1, 1]);
    const [h] = rgbToHsv(0, 0, 1);
    expect(h).toBeCloseTo(2 / 3);
    expect(rgbToHsv(0.5, 0.5, 0.5)).toEqual([0, 0, 0.5]);
  });
});

describe('colour key', () => {
  it('matches the key colour and similar blues', () => {
    expect(keyMatch(sky, [0.35, 0.6, 0.9])).toBeCloseTo(1);
    expect(keyMatch(sky, [0.3, 0.55, 0.85])).toBeGreaterThan(0.9);
  });

  it('does not match white clouds or warm colours', () => {
    expect(keyMatch(sky, [0.95, 0.95, 0.97])).toBeLessThan(0.05);
    expect(keyMatch(sky, [0.9, 0.5, 0.2])).toBeLessThan(0.05);
  });

  it('hide removes matches, isolate keeps only matches', () => {
    expect(keyKeep(sky, [0.35, 0.6, 0.9])).toBeCloseTo(0);
    expect(keyKeep(sky, [0.95, 0.95, 0.97])).toBeCloseTo(1);
    const iso = { ...sky, mode: 'isolate' as const };
    expect(keyKeep(iso, [0.35, 0.6, 0.9])).toBeCloseTo(1);
    expect(keyKeep(iso, [0.95, 0.95, 0.97])).toBeCloseTo(0);
  });

  it('is a no-op when disabled', () => {
    expect(keyKeep({ ...sky, enabled: false }, [0.35, 0.6, 0.9])).toBe(1);
  });

  it('wider tolerance catches more', () => {
    const c: [number, number, number] = [0.2, 0.75, 0.8]; // cyan-ish
    expect(keyMatch({ ...sky, hueTol: 60 }, c)).toBeGreaterThan(keyMatch(sky, c));
  });
});

describe('hex helpers', () => {
  it('round-trip', () => {
    expect(rgbToHex(hexToRgb('#5a99e6'))).toBe('#5a99e6');
  });
});
