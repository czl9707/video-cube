/**
 * Sidebar controls for the viewer colour key (hide or isolate a colour range
 * picked from the cut face). Purely visual: exports are never keyed.
 */
import { Pipette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { hexToRgb, rgbToHex } from '@/render/colorKey';
import type { ColorKey } from '@/render/colorKey';
import { NumberSlider } from './export/fields';

export function ColorKeyPanel(props: {
  value: ColorKey;
  onChange: (key: ColorKey) => void;
  picking: boolean;
  onPickToggle: () => void;
}) {
  const k = props.value;
  const set = (patch: Partial<ColorKey>) => props.onChange({ ...k, ...patch });
  const hex = rgbToHex(k.color);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="key-on" checked={k.enabled} onCheckedChange={(c) => set({ enabled: c === true })} />
        <Label htmlFor="key-on" className="text-xs">
          Enable colour key
        </Label>
      </div>

      <div className="flex gap-1.5">
        {(['hide', 'isolate'] as const).map((m) => (
          <Button
            key={m}
            data-key-mode={m}
            size="sm"
            variant={k.mode === m ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => set({ mode: m, enabled: true })}
          >
            {m === 'hide' ? 'Hide colour' : 'Isolate colour'}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label
          className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border"
          style={{ background: hex }}
          title="Choose the key colour"
        >
          <input
            id="key-color"
            type="color"
            value={hex}
            onChange={(e) => set({ color: hexToRgb(e.target.value), enabled: true })}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <Button
          id="key-pick"
          size="sm"
          variant={props.picking ? 'default' : 'outline'}
          className="flex-1"
          onClick={props.onPickToggle}
        >
          <Pipette /> {props.picking ? 'Click the cut face...' : 'Pick from slice'}
        </Button>
      </div>

      <NumberSlider
        id="key-hue"
        label="Hue tolerance"
        unit={'°'}
        min={0}
        max={180}
        step={1}
        value={k.hueTol}
        decimals={0}
        onValueChange={(hueTol) => set({ hueTol })}
      />
      <NumberSlider
        id="key-sat"
        label="Saturation tolerance"
        unit="%"
        min={0}
        max={1}
        step={0.01}
        scale={100}
        decimals={0}
        value={k.satTol}
        onValueChange={(satTol) => set({ satTol })}
      />
      <NumberSlider
        id="key-val"
        label="Brightness tolerance"
        unit="%"
        min={0}
        max={1}
        step={0.01}
        scale={100}
        decimals={0}
        value={k.valTol}
        onValueChange={(valTol) => set({ valTol })}
      />
      <NumberSlider
        id="key-soft"
        label="Softness"
        unit="%"
        min={0}
        max={1}
        step={0.01}
        scale={100}
        decimals={0}
        value={k.softness}
        onValueChange={(softness) => set({ softness })}
      />
      <p className="-mt-1 text-[11px] leading-snug text-muted-foreground">
        Viewer only: the preview and exports are never keyed. Tip: hide the sky to see the volume of the clouds
        change over time; raise Cube opacity to make it denser.
      </p>
    </div>
  );
}
