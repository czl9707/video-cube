import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ColorKey } from '@/render/colorKey';
import { ColorKeyPanel } from '../ColorKeyPanel';

/** Right-hand panel hosting the colour key controls. */
export function ColorKeyAside(props: {
  colorKey: ColorKey;
  onColorKeyChange: (key: ColorKey) => void;
  picking: boolean;
  onPickToggle: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      id="color-key-panel"
      className="flex h-svh w-[320px] shrink-0 flex-col border-l bg-sidebar text-sidebar-foreground"
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Colour key</h2>
          <p className="text-[11px] text-muted-foreground">Viewer only; exports are never keyed.</p>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={props.onClose} aria-label="Close colour key">
          <X />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ColorKeyPanel
          value={props.colorKey}
          onChange={props.onColorKeyChange}
          picking={props.picking}
          onPickToggle={props.onPickToggle}
        />
      </div>
    </aside>
  );
}
