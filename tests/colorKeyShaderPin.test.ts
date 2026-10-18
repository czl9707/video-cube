/**
 * The colour key exists twice: the reference maths in TypeScript
 * (render/colorKey.ts) and the same formula in GLSL (keepByKey in
 * render/shaders.ts). GLSL cannot run in vitest, so these pins hold the two
 * sides together: when one side changes, the matching pin fails and both
 * must be updated in step.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const shader = read('../src/render/shaders.ts');
const renderer = read('../src/render/cubeRenderer.ts');

describe('keepByKey mirrors keyMatch', () => {
  it('reads the same hue grey-weighting as the TypeScript (s below 0.2 contributes no hue error)', () => {
    expect(shader).toContain('min(1.0, min(hsv.y, uKeyHsv.y) * 5.0)');
  });

  it('floors the tolerances at the same epsilon before dividing', () => {
    expect(shader).toContain('max(uKeyTol, vec3(1e-3))');
  });

  it('uses the same soft-edge window around match distance 1', () => {
    expect(shader).toContain('smoothstep(1.0 - soft, 1.0 + soft, d)');
  });

  it('decides with the max normalised channel difference', () => {
    expect(shader).toContain('max(dd.x, max(dd.y, dd.z))');
  });

  it('keeps the isolate/hide polarity of keyKeep', () => {
    expect(shader).toContain('uKeyIsolate ? match : 1.0 - match');
  });
});

describe('shader and uniforms stay in step with colorKey.ts', () => {
  it('declares every uniform setColorKey writes', () => {
    const decls: [string, string][] = [
      ['uKeyOn', 'uniform bool uKeyOn'],
      ['uKeyIsolate', 'uniform bool uKeyIsolate'],
      ['uKeyHsv', 'uniform vec3 uKeyHsv'],
      ['uKeyTol', 'uniform vec3 uKeyTol'],
      ['uKeySoft', 'uniform float uKeySoft'],
    ];
    for (const [name, decl] of decls) {
      expect(shader, `${decl} missing`).toContain(decl);
      expect(renderer, `setColorKey no longer writes ${name}`).toContain(`u.${name}.value`);
    }
  });

  it('defaults the uniforms from DEFAULT_COLOR_KEY, not re-typed constants', () => {
    expect(renderer).toContain('DEFAULT_COLOR_KEY.hueTol / 360');
    expect(renderer).toContain('DEFAULT_COLOR_KEY.softness');
  });

  it('keys both the volume sheets and the cut face', () => {
    expect(shader).toContain('sa *= keepByKey(c);');
    expect(shader).toContain('keepByKey(pc)');
  });
});
