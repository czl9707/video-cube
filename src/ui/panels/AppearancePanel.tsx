import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar';
import { SliderRow } from '../SliderRow';

/** Cube opacity, cut-face image opacity and frame spacing. */
export function AppearancePanel(props: {
  opacity: number;
  onOpacity: (v: number) => void;
  planeImg: number;
  onPlaneImg: (v: number) => void;
  spacing: number;
  onSpacing: (v: number) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Appearance</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-3">
        <SliderRow
          id="opacity"
          label="Cube opacity"
          unit=""
          min={0.5}
          max={100}
          step={0.5}
          value={props.opacity}
          onValueChange={props.onOpacity}
        />
        <SliderRow
          id="plane-img"
          label="Plane image opacity"
          unit=""
          min={0}
          max={100}
          step={1}
          value={props.planeImg}
          onValueChange={props.onPlaneImg}
        />
        <SliderRow
          id="spacing"
          label="Spacing"
          unit="×"
          min={0.2}
          max={3}
          step={0.05}
          value={props.spacing}
          onValueChange={props.onSpacing}
        />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
