import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Labelled slider with a numeric box for typed values. */
export function SliderRow(props: {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(props.value));

  // Slider / external state changes rewrite the text box (unless the user is
  // mid-edit on a value that still parses to the same number).
  useEffect(() => {
    setText(String(props.value));
  }, [props.value]);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const v = Number.parseFloat(raw);
    if (!Number.isNaN(v)) props.onValueChange(clamp(v, props.min, props.max));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={props.id} className="text-xs">
          {props.label}
        </Label>
        {props.unit && (
          <span className="text-xs text-muted-foreground">{props.unit}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Slider
          aria-label={props.label}
          min={props.min}
          max={props.max}
          step={props.step}
          value={[props.value]}
          onValueChange={([v]) => props.onValueChange(v)}
          className="flex-1"
        />
        {/* Native number input — also the drive surface for the e2e harness
            (value assignment + bubbled 'input' event, which React onChange
            receives). Resynced on blur so half-typed drafts don't stick. */}
        <Input
          id={props.id}
          type="number"
          inputMode="decimal"
          min={props.min}
          max={props.max}
          step={props.step}
          value={text}
          onChange={onInputChange}
          onBlur={() => setText(String(props.value))}
          className="h-7 w-16 text-xs tabular-nums"
        />
      </div>
    </div>
  );
}
