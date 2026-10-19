import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ANIMATION,
  ease,
  sliceAt,
  sourceFrameRange,
  frameProgress,
  keyframeFromPlane,
  planeFromKeyframe,
  tiltDegrees,
  wrapDegrees,
} from '../src/export/timeSlice';
import type { SliceAnimation } from '../src/export/timeSlice';
import { volumeHalfExtents } from '../src/render/resliceMath';

const half = volumeHalfExtents([1920, 1080, 120], 1.3);

describe('ease', () => {
  it('maps endpoints to 0 and 1 for every curve', () => {
    for (const kind of ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const) {
      expect(ease(kind, 0)).toBe(0);
      expect(ease(kind, 1)).toBe(1);
    }
  });
});

describe('sliceAt', () => {
  it('hits the keyframes at both ends', () => {
    const anim: SliceAnimation = {
      start: { time: 0.1, span: 0.2, azimuth: 30 },
      end: { time: 0.9, span: 0.6, azimuth: 70 },
      easing: 'linear',
    };
    expect(sliceAt(anim, 0)).toEqual({ time: 0.1, span: 0.2, azimuth: 30 });
    expect(sliceAt(anim, 1)).toEqual({ time: 0.9, span: 0.6, azimuth: 70 });
  });

  it('moves time linearly even when the shape is eased', () => {
    const anim: SliceAnimation = {
      start: { time: 0, span: 0.4, azimuth: 0 },
      end: { time: 1, span: 0.4, azimuth: 0 },
      easing: 'easeInOut',
    };
    expect(sliceAt(anim, 0.5).time).toBeCloseTo(0.5);
    expect(sliceAt(anim, 0.25).time).toBeCloseTo(0.25);
  });

  it('takes the short way around the azimuth wrap', () => {
    const anim: SliceAnimation = {
      start: { time: 0.5, span: 0.4, azimuth: -170 },
      end: { time: 0.5, span: 0.4, azimuth: 170 },
      easing: 'linear',
    };
    // +20deg through +-180, not 340deg through 0
    expect(sliceAt(anim, 0.25).azimuth).toBeCloseTo(-175);
    expect(sliceAt(anim, 0.5).azimuth).toBeCloseTo(-180);
  });

  it('default animation replays the source clip', () => {
    expect(sliceAt(DEFAULT_ANIMATION, 0.3)).toEqual({ time: 0.3, span: 0, azimuth: 0 });
  });
});

describe('sourceFrameRange', () => {
  it('covers every frame of a plain replay', () => {
    const [a, b] = sourceFrameRange(DEFAULT_ANIMATION, [0, 1, 2, 3, 4], 5, 10);
    expect(a).toBe(0);
    expect(b).toBe(9);
  });

  it('only needs the neighbourhood of a single still', () => {
    const anim: SliceAnimation = { ...DEFAULT_ANIMATION, start: { time: 0.5, span: 0, azimuth: 0 }, end: { time: 0.5, span: 0, azimuth: 0 } };
    const [a, b] = sourceFrameRange(anim, [2], 5, 10);
    expect(a).toBeLessThanOrEqual(5);
    expect(b).toBeGreaterThanOrEqual(4);
    expect(b - a).toBeLessThan(3);
  });

  it('widens with the span', () => {
    const narrow: SliceAnimation = {
      start: { time: 0.5, span: 0.1, azimuth: 0 },
      end: { time: 0.5, span: 0.1, azimuth: 0 },
      easing: 'linear',
    };
    const wide: SliceAnimation = { ...narrow, start: { ...narrow.start, span: 0.6 }, end: { ...narrow.end, span: 0.6 } };
    const [, bn] = sourceFrameRange(narrow, [0, 1, 2, 3, 4], 5, 10);
    const [, bw] = sourceFrameRange(wide, [0, 1, 2, 3, 4], 5, 10);
    expect(bw).toBeGreaterThan(bn);
  });
});

describe('helpers', () => {
  it('wraps degrees', () => {
    expect(wrapDegrees(0)).toBe(0);
    expect(wrapDegrees(180)).toBe(180);
    expect(wrapDegrees(-180)).toBe(-180);
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-190)).toBe(170);
    expect(wrapDegrees(540)).toBe(180);
  });

  it('spreads progress across frames', () => {
    expect(frameProgress(0, 5)).toBe(0);
    expect(frameProgress(4, 5)).toBe(1);
    expect(frameProgress(2, 1)).toBe(0);
  });
});

describe('plane <-> keyframe', () => {
  it('round-trips a tilted viewer plane', () => {
    const plane = { azimuth: 30, elevation: 80, offset: 0.1 };
    const kf = keyframeFromPlane(plane, half)!;
    const back = planeFromKeyframe(kf, half);
    expect(back.azimuth).toBeCloseTo(30);
    expect(back.elevation).toBeCloseTo(80);
    expect(back.offset).toBeCloseTo(0.1);
  });

  it('a frame-aligned plane is an ordinary frame at the right time', () => {
    // offset 0 is the middle of the stack
    const kf = keyframeFromPlane({ azimuth: 0, elevation: 90, offset: 0 }, half)!;
    expect(kf.span).toBeCloseTo(0);
    expect(kf.time).toBeCloseTo(0.5);
  });

  it('negative elevation flips the span sign but describes the same slice', () => {
    const a = keyframeFromPlane({ azimuth: 10, elevation: 70, offset: 0.05 }, half)!;
    const b = keyframeFromPlane({ azimuth: -170, elevation: -70, offset: -0.05 }, half)!;
    expect(b.time).toBeCloseTo(a.time);
    expect(b.span).toBeCloseTo(-a.span);
    // -span at azimuth+180 is the same gradient
    const pa = planeFromKeyframe(a, half);
    const pb = planeFromKeyframe(b, half);
    expect(pb.elevation).toBeCloseTo(pa.elevation);
    expect(wrapDegrees(pb.azimuth - pa.azimuth)).toBeCloseTo(0);
  });

  it('rejects planes along the time axis', () => {
    expect(keyframeFromPlane({ azimuth: 0, elevation: 0, offset: 0 }, half)).toBeNull();
  });

  it('reports tilt in degrees', () => {
    const kf = keyframeFromPlane({ azimuth: 0, elevation: 85, offset: 0 }, half)!;
    expect(tiltDegrees(kf, half)).toBeCloseTo(5);
  });
});
