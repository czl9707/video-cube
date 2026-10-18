import { Button } from '@/components/ui/button';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar';

/** Launcher for the tool panels that open on the right. */
export function ToolsPanel(props: {
  keyActive: boolean;
  keyOn: boolean;
  onToggleKey: () => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Tools</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <Button
          id="open-key"
          size="sm"
          variant={props.keyActive ? 'default' : 'outline'}
          onClick={props.onToggleKey}
        >
          Colour key...{props.keyOn && ' (on)'}
        </Button>
        <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">
          Hide or isolate a colour picked from the slice, e.g. hide the sky to see the clouds.
        </p>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
