/**
 * Small form controls shared by the export panel.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Slider with a numeric box. `value`, `min`, `max` and `step` are in model
 * units; the box shows `value * scale`, rounded to `decimals`.
 */
export function NumberSlider(props: {
  id: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  scale?: number;
  decimals?: number;
  /** Allow typed values outside the slider range (still clamped to these). */
  inputMin?: number;
  inputMax?: number;
  hint?: ReactNode;
  disabled?: boolean;
  onValueChange: (v: number) => void;
}) {
  const scale = props.scale ?? 1;
  const decimals = props.decimals ?? 2;
  const shown = (v: number) => String(Number((v * scale).toFixed(decimals)));
  const [text, setText] = useState(shown(props.value));

  useEffect(() => {
    setText(shown(props.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value, scale, decimals]);

  const lo = props.inputMin ?? props.min;
  const hi = props.inputMax ?? props.max;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={props.id} className="text-xs">
          {props.label}
        </Label>
        {props.hint && <span className="text-[11px] text-muted-foreground">{props.hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Slider
          aria-label={props.label}
          min={props.min}
          max={props.max}
          step={props.step}
          value={[clamp(props.value, props.min, props.max)]}
          disabled={props.disabled}
          onValueChange={([v]) => props.onValueChange(v)}
          className="flex-1"
        />
        <div className="flex items-center gap-1">
          <Input
            id={props.id}
            type="number"
            inputMode="decimal"
            step={props.step * scale}
            value={text}
            disabled={props.disabled}
            onChange={(e) => {
              setText(e.target.value);
              const v = Number.parseFloat(e.target.value);
              if (!Number.isNaN(v)) props.onValueChange(clamp(v / scale, lo, hi));
            }}
            onBlur={() => setText(shown(props.value))}
            className="h-7 w-[4.5rem] text-xs tabular-nums"
          />
          {props.unit && <span className="w-3 text-xs text-muted-foreground">{props.unit}</span>}
        </div>
      </div>
    </div>
  );
}

/** Native select styled to match the shadcn inputs. */
export function SelectField<T extends string | number>(props: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  disabled?: boolean;
  onValueChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={props.id} className="text-xs">
        {props.label}
      </Label>
      <select
        id={props.id}
        value={String(props.value)}
        disabled={props.disabled}
        onChange={(e) => {
          const opt = props.options.find((o) => String(o.value) === e.target.value);
          if (opt) props.onValueChange(opt.value);
        }}
        className={cn(
          'h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
          '[&>option]:bg-popover [&>option]:text-popover-foreground',
        )}
      >
        {props.options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Titled block inside the export panel. */
export function Section(props: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 border-b px-4 py-4', props.className)}>
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{props.title}</h3>
      {props.children}
    </section>
  );
}
