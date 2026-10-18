import { describe, it, expect } from 'vitest';
import { offsetAboutPivot, pivotPoint, pivotSegment2D, pivotSegment3D } from '../src/render/tiltPivot';
import { volumeHalfExtents } from '../src/render/resliceMath';

const half = volumeHalfExtents([1920, 1080, 120], 1.3);

describe('tilting around the pivot', () => {
  it('keeps the pivot line on the plane', () => {
    const prev = { azimuth: 20, elevation: 85, offset: 0.12 };
    for (const pivot of [0, 0.5, 1]) {
      const offset = offsetAboutPivot(prev, { azimuth: 20, elevation: 70 }, half, pivot);
      const before = pivotPoint(prev, half, pivot)!;
      const after = pivotPoint({ azimuth: 20, elevation: 70, offset }, half, pivot)!;
      for (let k = 0; k < 3; k++) expect(after[k]).toBeCloseTo(before[k]);
    }
  });

  it('falls back to the previous offset for planes along the time axis', () => {
    const prev = { azimuth: 0, elevation: 0, offset: 0.07 };
    expect(offsetAboutPivot(prev, { azimuth: 10, elevation: 5 }, half, 0.5)).toBe(0.07);
  });
});

describe('pivot line', () => {
  it('runs along the bottom edge at 100% and azimuth 0', () => {
    const seg = pivotSegment2D(0, 1, 0.5, 0.3)!;
    expect(seg[0][1]).toBeCloseTo(-0.3);
    expect(seg[1][1]).toBeCloseTo(-0.3);
    expect(Math.abs(seg[1][0] - seg[0][0])).toBeCloseTo(1);
  });

  it('is vertical through the centre at azimuth 90 and 50%', () => {
    const seg = pivotSegment2D(90, 0.5, 0.5, 0.3)!;
    expect(seg[0][0]).toBeCloseTo(0);
    expect(Math.abs(seg[1][1] - seg[0][1])).toBeCloseTo(0.6);
  });

  it('shrinks to a corner point at 100% for a diagonal direction', () => {
    const seg = pivotSegment2D(30, 1, 0.5, 0.3)!;
    expect(seg[0][0]).toBeCloseTo(seg[1][0]);
    expect(seg[0][1]).toBeCloseTo(seg[1][1]);
  });

  it('misses the frame when the pivot sits beyond an edge', () => {
    // azimuth 0 places the line at y = (0.5 - pivot) * 2 * hy; pivot 2 is a full frame below the box
    expect(pivotSegment2D(0, 2, 0.5, 0.3)).toBeNull();
    // at 100% the line runs exactly along the edge and still counts as inside
    expect(pivotSegment2D(0, 1, 0.5, 0.3)).not.toBeNull();
  });

  it('sits on the 3D plane at a single moment', () => {
    const plane = { azimuth: 15, elevation: 70, offset: 0.05 };
    const seg = pivotSegment3D(plane, half, 0.8)!;
    const n = [
      Math.cos((70 * Math.PI) / 180) * Math.sin((15 * Math.PI) / 180),
      Math.cos((70 * Math.PI) / 180) * Math.cos((15 * Math.PI) / 180),
      Math.sin((70 * Math.PI) / 180),
    ];
    for (const p of seg) expect(n[0] * p[0] + n[1] * p[1] + n[2] * p[2]).toBeCloseTo(0.05);
    expect(seg[0][2]).toBeCloseTo(seg[1][2]);
  });
});
