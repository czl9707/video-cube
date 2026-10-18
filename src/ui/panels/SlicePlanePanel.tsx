import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar';
import { SliderRow } from '../SliderRow';
import type { Axis, PlaneState } from '../planeState';

/** Axis preset, tilt angles, tilt pivot, position and cut-side toggles. */
export function SlicePlanePanel(props: {
  plane: PlaneState;
  /** World-space half extent of the volume along the offset axis. */
  reach: number;
  pivot: number;
  onPivot: (v: number) => void;
  showClipped: boolean;
  onShowClipped: (show: boolean) => void;
  showGuides: boolean;
  onShowGuides: (show: boolean) => void;
  onAxis: (axis: Axis) => void;
  onRotate: (angles: { azimuth?: number; elevation?: number }) => void;
  onOffset: (v: number) => void;
  onFlip: (flip: boolean) => void;
}) {
  const p = props.plane;
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Slice plane</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-3">
        <div className="flex gap-1.5">
          {(['x', 'y', 'z'] as const).map((a) => (
            <Button
              key={a}
              data-axis={a}
              size="sm"
              variant={p.axis === a ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => props.onAxis(a)}
            >
              {a.toUpperCase()}
            </Button>
          ))}
        </div>
        <SliderRow
          id="azimuth"
          label="Azimuth"
          unit="°"
          min={-180}
          max={180}
          step={1}
          value={p.azimuth}
          onValueChange={(v) => props.onRotate({ azimuth: v })}
        />
        <SliderRow
          id="elevation"
          label="Elevation"
          unit="°"
          min={-90}
          max={90}
          step={1}
          value={p.elevation}
          onValueChange={(v) => props.onRotate({ elevation: v })}
        />
        <SliderRow
          id="pivot"
          label="Tilt pivot"
          unit="%"
          min={0}
          max={100}
          step={1}
          value={Math.round(props.pivot * 100)}
          onValueChange={(v) => props.onPivot(v / 100)}
        />
        <p className="-mt-1.5 text-[11px] leading-snug text-muted-foreground">
          Line the plane tilts around: 0% top, 50% centre, 100% bottom (at azimuth 0 deg). That line keeps its moment
          in time.
        </p>
        <SliderRow
          id="offset"
          label="Position"
          unit=""
          min={-props.reach}
          max={props.reach}
          step={0.005}
          value={p.offset}
          onValueChange={props.onOffset}
        />
        <div className="flex items-center gap-2">
          <Checkbox id="flip" checked={p.flip} onCheckedChange={(c) => props.onFlip(c === true)} />
          <Label htmlFor="flip" className="text-xs">
            Flip cut side
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-clipped"
            checked={props.showClipped}
            onCheckedChange={(c) => props.onShowClipped(c === true)}
          />
          <Label htmlFor="show-clipped" className="text-xs">
            Show clipped side
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-guides"
            checked={props.showGuides}
            onCheckedChange={(c) => props.onShowGuides(c === true)}
          />
          <Label htmlFor="show-guides" className="text-xs">
            Show the cut-face outline and pivot line
          </Label>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
