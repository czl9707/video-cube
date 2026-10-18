import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createVolumeTexture } from './texture3d';
import { CUBE_VERT, CUBE_FRAG } from './shaders';
import { planeCubePolygon, volumeHalfExtents } from './resliceMath';
import { rgbToHsv } from './colorKey';
import { DEFAULT_COLOR_KEY } from './colorKey';
import type { ColorKey } from './colorKey';
import type { Vec3 } from './linalg';

export class CubeRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
  private uniforms: Record<string, THREE.IUniform>;
  private line: THREE.Line;
  private linePositions: THREE.BufferAttribute;
  private pivotLine: THREE.Line;
  private pivotSegment: [Vec3, Vec3] | null = null;
  private showGuides = true;
  private controls: OrbitControls;
  private box: THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>;
  private half: Vec3;
  private plane: { normal: Vec3; offset: number; on: boolean; flip: boolean } = {
    normal: [0, 0, 1],
    offset: 0,
    on: false,
    flip: false,
  };

  constructor(canvas: HTMLCanvasElement, data: Uint8Array, dims: Vec3) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);

    const tex = createVolumeTexture(data, dims);
    this.half = volumeHalfExtents(dims, 1);
    // mostly-frontal so the video face reads at its true aspect; orbit free
    const dist = Math.hypot(...this.half) * 3.4;
    this.camera.position.set(0.45, 0.35, 1).normalize().multiplyScalar(dist);
    this.camera.lookAt(0, 0, 0);
    this.controls = new OrbitControls(this.camera, canvas);
    this.uniforms = {
      uVolume: { value: tex },
      uDensity: { value: 0.08 }, // per-sheet opacity fraction
      uFrames: { value: dims[2] },
      // one frame sheet = half the frame pitch at spacing 1; spacing only widens gaps
      uSliceThick: { value: 0.5 / dims[2] },
      uHalf: { value: new THREE.Vector3(...this.half) },
      uPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
      uPlaneOffset: { value: 0 },
      uPlaneOn: { value: false },
      uPlaneFlip: { value: false },
      uPlaneClip: { value: true },
      uPlaneImgAlpha: { value: 1 },
      uKeyOn: { value: false },
      uKeyIsolate: { value: false },
      uKeyHsv: { value: new THREE.Vector3() },
      uKeyTol: {
        value: new THREE.Vector3(DEFAULT_COLOR_KEY.hueTol / 360, DEFAULT_COLOR_KEY.satTol, DEFAULT_COLOR_KEY.valTol),
      },
      uKeySoft: { value: DEFAULT_COLOR_KEY.softness },
    };
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: CUBE_VERT,
      fragmentShader: CUBE_FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    this.box.scale.set(this.half[0] * 2, this.half[1] * 2, this.half[2] * 2);
    this.scene.add(this.box);
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__vcCube = this;
    }

    // Slice-plane cross-section outline; resized per updatePlane.
    this.linePositions = new THREE.BufferAttribute(new Float32Array(8 * 3), 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', this.linePositions);
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x55ffcc }));
    this.line.visible = false;
    this.line.renderOrder = 2; // keep the outline over the cube pass
    this.scene.add(this.line);

    // Tilt pivot marker: the line on the cut face the plane rotates around.
    const pivotGeo = new THREE.BufferGeometry();
    pivotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    this.pivotLine = new THREE.Line(pivotGeo, new THREE.LineBasicMaterial({ color: 0xffa630 }));
    this.pivotLine.visible = false;
    this.pivotLine.renderOrder = 3;
    this.scene.add(this.pivotLine);

    this.resize();
  }

  /** Slider value (0.5-100) maps to per-sheet opacity fraction. */
  setDensity(v: number): void {
    this.uniforms.uDensity.value = v / 100;
  }

  /** Slider value (0-100) maps to cut-plane image opacity. */
  setPlaneImageAlpha(v: number): void {
    this.uniforms.uPlaneImgAlpha.value = v / 100;
  }

  /** When true the cut side of the cube is hidden; false keeps the full cube. */
  setClipCube(clip: boolean): void {
    this.uniforms.uPlaneClip.value = clip;
  }

  /** Reshape the volume box (video aspect + time-axis spacing). */
  setSpacing(half: Vec3): void {
    this.half = half;
    (this.uniforms.uHalf.value as THREE.Vector3).set(...half);
    this.box.scale.set(half[0] * 2, half[1] * 2, half[2] * 2);
    this.updateOutline();
  }

  setPlane(normal: Vec3, offset: number, on: boolean, flip: boolean): void {
    this.plane = { normal, offset, on, flip };
    (this.uniforms.uPlaneNormal.value as THREE.Vector3).set(...normal);
    this.uniforms.uPlaneOffset.value = offset;
    this.uniforms.uPlaneOn.value = on;
    this.uniforms.uPlaneFlip.value = flip;
    this.updateOutline();
  }

  /** Apply (or, when disabled, clear) the viewer colour key. */
  setColorKey(key: ColorKey): void {
    const u = this.uniforms;
    u.uKeyOn.value = key.enabled;
    u.uKeyIsolate.value = key.mode === 'isolate';
    (u.uKeyHsv.value as THREE.Vector3).set(...rgbToHsv(...key.color));
    (u.uKeyTol.value as THREE.Vector3).set(key.hueTol / 360, key.satTol, key.valTol);
    u.uKeySoft.value = key.softness;
  }

  /**
   * Colour of the cut-face image under a canvas point (client pixels), read
   * from the volume data, or null when the point misses the cut face.
   */
  pickPlaneColor(clientX: number, clientY: number): [number, number, number] | null {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const n = new THREE.Vector3(...this.plane.normal);
    const hit = new THREE.Vector3();
    // THREE.Plane uses n.p + constant = 0, so constant = -offset.
    if (!ray.ray.intersectPlane(new THREE.Plane(n, -this.plane.offset), hit)) return null;
    const [hx, hy, hz] = this.half;
    if (Math.abs(hit.x) > hx || Math.abs(hit.y) > hy || Math.abs(hit.z) > hz) return null;
    const img = (this.uniforms.uVolume.value as THREE.Data3DTexture).image as {
      data: Uint8Array;
      width: number;
      height: number;
      depth: number;
    };
    const ix = Math.min(img.width - 1, Math.floor((hit.x / (2 * hx) + 0.5) * img.width));
    const iy = Math.min(img.height - 1, Math.floor((0.5 - hit.y / (2 * hy)) * img.height));
    const iz = Math.min(img.depth - 1, Math.floor((hit.z / (2 * hz) + 0.5) * img.depth));
    const o = ((iz * img.height + iy) * img.width + ix) * 4;
    return [img.data[o] / 255, img.data[o + 1] / 255, img.data[o + 2] / 255];
  }

  /** Show the tilt pivot as a segment between two world points, or hide it with null. */
  setPivotLine(segment: [Vec3, Vec3] | null): void {
    this.pivotSegment = segment;
    this.pivotLine.visible = !!segment && this.showGuides;
    if (!segment) return;
    const attr = this.pivotLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    (attr.array as Float32Array).set([...segment[0], ...segment[1]]);
    attr.needsUpdate = true;
    this.pivotLine.geometry.computeBoundingSphere();
  }

  /** Show or hide the cut-face outline and the pivot line (visual guides only). */
  setGuidesVisible(visible: boolean): void {
    this.showGuides = visible;
    this.pivotLine.visible = visible && !!this.pivotSegment;
    this.updateOutline();
  }

  private updateOutline(): void {
    const { normal, offset, on } = this.plane;
    if (!on) {
      this.line.visible = false;
      return;
    }
    const poly = planeCubePolygon(normal, offset, this.half);
    this.line.visible = poly.length >= 2 && this.showGuides;
    if (poly.length >= 2) {
      const arr = this.linePositions.array as Float32Array;
      poly.forEach((p, i) => arr.set(p, i * 3));
      // wrap: repeat first vertex to close the loop
      if (poly.length < 8) arr.set(poly[0], poly.length * 3);
      this.linePositions.needsUpdate = true;
      this.line.geometry.setDrawRange(0, poly.length + 1);
    }
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    window.addEventListener('resize', this.onResize);
    this.renderer.setAnimationLoop(() => this.renderer.render(this.scene, this.camera));
  }

  private onResize = (): void => this.resize();

  /** Stop the render loop and release listeners; call before replacing the renderer. */
  dispose(): void {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
  }
}
