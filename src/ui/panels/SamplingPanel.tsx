import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar';
import { SliderRow } from '../SliderRow';

/**
 * Long-side size of the viewer volume. Larger values sharpen the cut face at
 * the cost of GPU memory (w x h x frames x 4 bytes).
 */
const VIEWER_RESOLUTIONS = [512, 1024, 1536];

/** Sample rate, viewer resolution, resampling and ingest progress. */
export function SamplingPanel(props: {
  rate: number;
  onRate: (v: number) => void;
  viewerRes: number;
  onViewerRes: (v: number) => void;
  /** Largest 3D texture edge the GPU accepts; caps the viewer resolution. */
  max3dTexture: number;
  rateDirty: boolean;
  onResample: () => void;
  ingesting: boolean;
  progress: number;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Sampling</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-3">
        <SliderRow
          id="rate"
          label="Sample rate"
          unit="frames/sec"
          min={1}
          max={40}
          step={1}
          value={props.rate}
          onValueChange={props.onRate}
        />
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Viewer resolution</Label>
          <div className="flex gap-1.5">
            {VIEWER_RESOLUTIONS.map((r) => (
              <Button
                key={r}
                data-res={r}
                size="sm"
                variant={props.viewerRes === r ? 'default' : 'outline'}
                className="flex-1"
                disabled={props.max3dTexture > 0 && r > props.max3dTexture}
                onClick={() => props.onViewerRes(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
        {props.rateDirty && (
          <Button size="sm" onClick={props.onResample}>
            Resample
          </Button>
        )}
        {props.ingesting && (
          <div id="progress" className="flex flex-col gap-1">
            <Progress value={props.progress} />
            <span id="progress-num" className="text-xs text-muted-foreground">
              Sampling {props.progress}%
            </span>
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
