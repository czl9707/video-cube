export const CUBE_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CUBE_FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
in vec3 vWorld;
uniform sampler3D uVolume;
uniform float uDensity;
uniform float uFrames;
uniform float uSliceThick;
uniform vec3 uHalf;
uniform vec3 uPlaneNormal;
uniform float uPlaneOffset;
uniform bool uPlaneOn;
uniform bool uPlaneFlip;
uniform bool uPlaneClip;
uniform float uPlaneImgAlpha;
// Colour key (viewer only), see colorKey.ts for the reference maths.
uniform bool uKeyOn;
uniform bool uKeyIsolate;
uniform vec3 uKeyHsv;
uniform vec3 uKeyTol; // hue (fraction of a turn), saturation, value
uniform float uKeySoft;
out vec4 outColor;

vec3 rgb2hsv(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float d = mx - mn;
  float h = 0.0;
  if (d > 1e-6) {
    if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, mx > 1e-6 ? d / mx : 0.0, mx);
}

// Opacity multiplier from the colour key: 1 keeps the voxel, 0 removes it.
float keepByKey(vec3 rgb) {
  if (!uKeyOn) return 1.0;
  vec3 hsv = rgb2hsv(rgb);
  float dh = abs(hsv.x - uKeyHsv.x);
  dh = min(dh, 1.0 - dh) * min(1.0, min(hsv.y, uKeyHsv.y) * 5.0);
  vec3 dd = vec3(dh, abs(hsv.y - uKeyHsv.y), abs(hsv.z - uKeyHsv.z)) / max(uKeyTol, vec3(1e-3));
  float d = max(dd.x, max(dd.y, dd.z));
  float soft = max(uKeySoft, 1e-3);
  float match = 1.0 - smoothstep(1.0 - soft, 1.0 + soft, d);
  return uKeyIsolate ? match : 1.0 - match;
}

bool rayBox(vec3 ro, vec3 rd, out float t0, out float t1) {
  vec3 inv = 1.0 / rd;
  vec3 a = (-uHalf - ro) * inv;
  vec3 b = (uHalf - ro) * inv;
  vec3 mn = min(a, b);
  vec3 mx = max(a, b);
  t0 = max(max(mn.x, mn.y), mn.z);
  t1 = min(min(mx.x, mx.y), mx.z);
  return t1 > max(t0, 0.0);
}

// Composite the cut-plane image into the front-to-back accumulation at its
// true depth along the ray, so cube sheets in front occlude it and it dims
// the sheets behind.
void applyPlane(vec3 ro, vec3 rd, float tc, inout vec3 acc, inout float accA) {
  if (tc < 0.0) return;
  vec3 p = ro + rd * tc;
  vec3 uvw = vec3(p.x / (2.0 * uHalf.x) + 0.5, 0.5 - p.y / (2.0 * uHalf.y), p.z / (2.0 * uHalf.z) + 0.5);
  if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) return;
  vec3 pc = texture(uVolume, uvw).rgb;
  float ap = uPlaneImgAlpha * keepByKey(pc);
  acc += (1.0 - accA) * ap * pc;
  accA += (1.0 - accA) * ap;
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float t0, t1;
  if (!rayBox(ro, rd, t0, t1)) discard;
  t0 = max(t0, 0.0);
  if (uPlaneOn && uPlaneClip) {
    // section cut: keep { dot(p, n) >= d }, or the other side when flipped
    bool keepPos = !uPlaneFlip;
    float dn = dot(rd, uPlaneNormal);
    float f0 = dot(ro, uPlaneNormal) - uPlaneOffset;
    if (abs(dn) < 1e-6) {
      if ((f0 >= 0.0) != keepPos) discard;
    } else {
      // f0 = dot(ro, n) - d  =>  plane crossing at t = -f0 / dn
      float tc = -f0 / dn;
      if ((dn > 0.0) == keepPos) t0 = max(t0, tc);
      else t1 = min(t1, tc);
    }
  }
  if (t1 <= t0) discard;
  // Cut-plane image crossing; -1 when the ray misses it. When the cube is
  // clipped the crossing sits exactly on the clipped interval edge, so the
  // face still shows at full strength.
  float tc = -1.0;
  if (uPlaneOn && abs(dot(rd, uPlaneNormal)) > 1e-6) {
    float t = -(dot(ro, uPlaneNormal) - uPlaneOffset) / dot(rd, uPlaneNormal);
    if (t >= t0 && t <= t1) tc = t;
  }
  // March sheet by sheet: each frame is a thin slab around its z center.
  float pitch = 2.0 * uHalf.z / uFrames;
  float ht = 0.5 * min(uSliceThick, pitch); // sheet half-thickness (never overlaps neighbor)
  vec3 acc = vec3(0.0);
  float accA = 0.0;
  bool planeDone = tc < 0.0;
  for (int i = 0; i < 192; i++) {
    if (i >= int(uFrames)) break;
    // march in ray order (near -> far) so the nearest sheet composites last-in-weight
    int k = rd.z >= 0.0 ? i : (int(uFrames) - 1 - i);
    float zc = -uHalf.z + (float(k) + 0.5) * pitch;
    float ta = (zc - ht - ro.z) / rd.z;
    float tb = (zc + ht - ro.z) / rd.z;
    float s0 = max(min(ta, tb), t0);
    float s1 = min(max(ta, tb), t1);
    if (s1 <= s0) continue;
    if (!planeDone && tc <= s1) {
      // plane at or in front of this sheet's far edge: it comes first
      applyPlane(ro, rd, tc, acc, accA);
      planeDone = true;
    }
    // uDensity = per-sheet opacity; thin chords (grazing clip) scale proportionally
    float sa = uDensity * clamp((s1 - s0) / uSliceThick, 0.0, 1.0);
    vec3 p = ro + rd * (0.5 * (s0 + s1));
    vec3 uvw = vec3(p.x / (2.0 * uHalf.x) + 0.5, 0.5 - p.y / (2.0 * uHalf.y), (float(k) + 0.5) / uFrames);
    vec3 c = texture(uVolume, uvw).rgb;
    sa *= keepByKey(c);
    acc += (1.0 - accA) * sa * c;
    accA += (1.0 - accA) * sa;
    if (accA > 0.99) break;
  }
  if (!planeDone) applyPlane(ro, rd, tc, acc, accA);
  if (accA < 0.004) discard;
  outColor = vec4(acc, accA);
}
`;
