import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CubeRenderer } from '@/render/cubeRenderer';
import { ingestVideo } from '@/ingest/ingestVideo';
import { volumeHalfExtents } from '@/render/resliceMath';
import { offsetAboutPivot, pivotSegment3D } from '@/render/tiltPivot';
import { DEFAULT_COLOR_KEY } from '@/render/colorKey';
import type { ColorKey } from '@/render/colorKey';
import type { Vec3 } from '@/render/linalg';
import { syntheticVolume } from './syntheticVolume';
import { INITIAL_PLANE, planeNormal } from './planeState';
import type { Axis, PlaneState } from './planeState';
import { SourcePanel } from './panels/SourcePanel';
import { SamplingPanel } from './panels/SamplingPanel';
import { AppearancePanel } from './panels/AppearancePanel';
import { SlicePlanePanel } from './panels/SlicePlanePanel';
import { ToolsPanel } from './panels/ToolsPanel';
import { ColorKeyAside } from './panels/ColorKeyAside';

export function App() {
  const [webgl2Supported] = useState(
    () => typeof document !== 'undefined' && !!document.createElement('canvas').getContext('webgl2'),
  );
  // Largest 3D texture edge the GPU accepts; caps the viewer resolution.
  const [max3dTexture] = useState(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    return gl ? (gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) as number) : 0;
  });

  const cubeCanvasRef = useRef<HTMLCanvasElement>(null);
  const cubeRef = useRef<CubeRenderer | null>(null);
  const lastFileRef = useRef<File | null>(null);
  // False until the user moves a plane control; before that the cut keeps
  // its default parked position as dims/spacing change.
  const planeTouchedRef = useRef(false);

  const [dims, setDims] = useState<Vec3>([64, 64, 64]);
  const [error, setError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState(10);
  const [rateDirty, setRateDirty] = useState(false);
  const [viewerRes, setViewerRes] = useState(512);
  // Tilt pivot along the tilt direction: 0 = top edge, 0.5 = centre, 1 = bottom (at azimuth 0).
  const [pivot, setPivot] = useState(0.5);
  // Bumped on every ingest so plane-overlay effects re-run for the new renderer.
  const [volumeEpoch, setVolumeEpoch] = useState(0);
  // One tool panel at a time on the right.
  const [rightPanel, setRightPanel] = useState<'none' | 'key'>('none');
  const [colorKey, setColorKey] = useState<ColorKey>(DEFAULT_COLOR_KEY);
  // True while the eyedropper waits for a click on the cut face.
  const [picking, setPicking] = useState(false);
  // Green cut-face outline and orange pivot line; hide them for a clean view.
  const [showGuides, setShowGuides] = useState(true);
  const [opacity, setOpacity] = useState(8);
  const [planeImg, setPlaneImg] = useState(100);
  const [showClipped, setShowClipped] = useState(false);
  const [spacing, setSpacing] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [plane, setPlaneState] = useState<PlaneState>(INITIAL_PLANE);

  const normal = useMemo(
    () => planeNormal(plane.azimuth, plane.elevation),
    [plane.azimuth, plane.elevation],
  );
  const half = useMemo(() => volumeHalfExtents(dims, spacing), [dims, spacing]);
  const reach = useMemo(() => Math.hypot(...half), [half]);
  // The offset can only reach as far as the box; clamping here keeps the
  // plane on the volume even right after reach shrinks (spacing/dims).
  const clampedOffset = Math.min(reach, Math.max(-reach, plane.offset));

  // Boot with a synthetic volume so the cube renders before any video is loaded.
  useEffect(() => {
    if (!webgl2Supported) return;
    const canvas = cubeCanvasRef.current;
    if (!canvas) return;
    const cube = new CubeRenderer(canvas, syntheticVolume(64), [64, 64, 64]);
    cube.setDensity(opacity);
    cube.setSpacing(volumeHalfExtents([64, 64, 64], spacing));
    cube.start();
    cubeRef.current = cube;
    return () => {
      cubeRef.current?.dispose();
      cubeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl2Supported]);

  // Volume box and derived plane drive the renderer. The cut is always on;
  // before the user touches a plane control it stays parked near the start.
  useEffect(() => {
    const cube = cubeRef.current;
    if (!cube) return;
    cube.setSpacing(half);
    cube.setPlane(normal, clampedOffset, true, plane.flip);
  }, [half, normal, clampedOffset, plane.flip]);

  // Park the cut three frames into the stack so the section is visible from
  // boot; once the user moves a plane control, their offset stands.
  useEffect(() => {
    if (planeTouchedRef.current) return;
    const pitch = (2 * half[2]) / dims[2];
    const d = -half[2] + 3 * pitch;
    setPlaneState((p) => (p.offset === d ? p : { ...p, offset: d }));
  }, [half, dims]);

  // Reconcile offset state when reach shrinks (spacing/dims change), so the
  // stored offset and the slider cannot sit beyond the volume.
  useEffect(() => {
    setPlaneState((p) => {
      const next = Math.min(reach, Math.max(-reach, p.offset));
      return next === p.offset ? p : { ...p, offset: next };
    });
  }, [reach]);

  // Keep the orange tilt-pivot marker on the cut face in sync.
  useEffect(() => {
    const plane3 = { azimuth: plane.azimuth, elevation: plane.elevation, offset: clampedOffset };
    // Drawn 1.5% inside the frame so it stays distinguishable from the outline at 0% / 100%.
    cubeRef.current?.setPivotLine(pivotSegment3D(plane3, half, 0.015 + pivot * 0.97));
  }, [plane.azimuth, plane.elevation, clampedOffset, half, pivot, volumeEpoch]);

  // Guides visibility and the colour key; re-applied when a new volume (and renderer) is created.
  useEffect(() => {
    cubeRef.current?.setGuidesVisible(showGuides);
  }, [showGuides, volumeEpoch]);

  useEffect(() => {
    cubeRef.current?.setColorKey(colorKey);
  }, [colorKey, volumeEpoch]);

  // Escape cancels the eyedropper.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  const handleCanvasClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (!picking) return;
      const rgb = cubeRef.current?.pickPlaneColor(e.clientX, e.clientY);
      if (!rgb) return; // missed the cut face: keep waiting
      setColorKey((k) => ({ ...k, color: rgb, enabled: true }));
      setPicking(false);
    },
    [picking],
  );

  const ingest = useCallback(
    async (file: File) => {
      setIngesting(true);
      setProgress(0);
      try {
        const r = await ingestVideo(file, rate, viewerRes, (done, total) =>
          setProgress(Math.round((done / total) * 100)),
        );
        const nextDims: Vec3 = [r.width, r.height, r.depth];
        const nextHalf = volumeHalfExtents(nextDims, spacing);
        const n = planeNormal(plane.azimuth, plane.elevation);

        cubeRef.current?.dispose();
        const cubeCanvas = cubeCanvasRef.current;
        if (cubeCanvas) {
          const cube = new CubeRenderer(cubeCanvas, r.data, nextDims);
          cube.setDensity(opacity);
          cube.setPlaneImageAlpha(planeImg);
          cube.setClipCube(!showClipped);
          cube.setSpacing(nextHalf);
          cube.setPlane(n, clampedOffset, true, plane.flip);
          cube.start();
          cubeRef.current = cube;
        }
        setDims(nextDims);
        setVolumeEpoch((e) => e + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ingest failed.');
      } finally {
        setIngesting(false);
      }
    },
    [rate, viewerRes, spacing, opacity, planeImg, showClipped, plane.azimuth, plane.elevation, clampedOffset, plane.flip],
  );

  const ingestFile = useCallback(
    (file: File) => {
      if (!cubeRef.current) return;
      lastFileRef.current = file;
      setRateDirty(false);
      setError(null);
      void ingest(file);
    },
    [ingest],
  );

  const handleRate = useCallback((v: number) => {
    setRate(v);
    if (lastFileRef.current) setRateDirty(true);
  }, []);

  const handleViewerRes = useCallback((v: number) => {
    setViewerRes(v);
    if (lastFileRef.current) setRateDirty(true);
  }, []);

  const handleResample = useCallback(() => {
    const file = lastFileRef.current;
    if (!file) return;
    setRateDirty(false);
    void ingest(file);
  }, [ingest]);

  const handleOpacity = useCallback((v: number) => {
    setOpacity(v);
    cubeRef.current?.setDensity(v);
  }, []);

  const handlePlaneImg = useCallback((v: number) => {
    setPlaneImg(v);
    cubeRef.current?.setPlaneImageAlpha(v);
  }, []);

  const handleShowClipped = useCallback((show: boolean) => {
    setShowClipped(show);
    cubeRef.current?.setClipCube(!show);
  }, []);

  // A plane-control interaction hands the offset over to the user: the
  // parked default no longer follows dims/spacing changes.
  const updatePlane = useCallback((partial: Partial<PlaneState>) => {
    planeTouchedRef.current = true;
    setPlaneState((p) => ({ ...p, ...partial }));
  }, []);

  // Azimuth / elevation changes rotate the plane around the tilt pivot line,
  // so the moment shown at the pivot stays put while the plane tilts.
  const rotatePlane = useCallback(
    (angles: { azimuth?: number; elevation?: number }) => {
      planeTouchedRef.current = true;
      setPlaneState((p) => {
        const next = { azimuth: angles.azimuth ?? p.azimuth, elevation: angles.elevation ?? p.elevation };
        const prev = { azimuth: p.azimuth, elevation: p.elevation, offset: Math.min(reach, Math.max(-reach, p.offset)) };
        return { ...p, ...next, offset: offsetAboutPivot(prev, next, half, pivot) };
      });
    },
    [half, reach, pivot],
  );

  const setAxis = useCallback(
    (axis: Axis) => {
      updatePlane({
        axis,
        azimuth: axis === 'x' ? 90 : 0,
        elevation: axis === 'z' ? 90 : 0,
      });
    },
    [updatePlane],
  );

  if (!webgl2Supported) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <Alert variant="destructive" id="msg" className="max-w-md">
          <AlertTitle>WebGL2 unavailable</AlertTitle>
          <AlertDescription>
            WebGL2 is required but not available in this browser.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Definite wrapper height (not just min-height) so the h-full sidebar
  // rail resolves to the viewport instead of its content height.
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar side="left" collapsible="none">
        <SidebarHeader>
          <h1 className="px-2 py-1 text-sm font-semibold tracking-tight">Video Cube</h1>
        </SidebarHeader>
        <SidebarContent>
          <SourcePanel
            ingesting={ingesting}
            dragOver={dragOver}
            error={error}
            onDragOverChange={setDragOver}
            onFile={ingestFile}
          />
          <SamplingPanel
            rate={rate}
            onRate={handleRate}
            viewerRes={viewerRes}
            onViewerRes={handleViewerRes}
            max3dTexture={max3dTexture}
            rateDirty={rateDirty}
            onResample={handleResample}
            ingesting={ingesting}
            progress={progress}
          />
          <AppearancePanel
            opacity={opacity}
            onOpacity={handleOpacity}
            planeImg={planeImg}
            onPlaneImg={handlePlaneImg}
            spacing={spacing}
            onSpacing={setSpacing}
          />
          <SlicePlanePanel
            plane={plane}
            reach={reach}
            pivot={pivot}
            onPivot={setPivot}
            showClipped={showClipped}
            onShowClipped={handleShowClipped}
            showGuides={showGuides}
            onShowGuides={setShowGuides}
            onAxis={setAxis}
            onRotate={rotatePlane}
            onOffset={(v) => updatePlane({ offset: v })}
            onFlip={(flip) => updatePlane({ flip })}
          />
          <ToolsPanel
            keyActive={rightPanel === 'key'}
            keyOn={colorKey.enabled}
            onToggleKey={() => setRightPanel((cur) => (cur === 'key' ? 'none' : 'key'))}
          />
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="relative overflow-hidden">
        <canvas
          id="cube"
          width={800}
          height={600}
          ref={cubeCanvasRef}
          onClick={handleCanvasClick}
          className={cn('absolute inset-0 h-full w-full', picking && 'cursor-crosshair')}
        />
      </SidebarInset>

      {rightPanel === 'key' && (
        <ColorKeyAside
          colorKey={colorKey}
          onColorKeyChange={setColorKey}
          picking={picking}
          onPickToggle={() => setPicking((p) => !p)}
          onClose={() => setRightPanel('none')}
        />
      )}
    </SidebarProvider>
  );
}
