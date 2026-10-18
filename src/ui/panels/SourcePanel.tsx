import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/** Video drop zone, file picker and ingest error display. */
export function SourcePanel(props: {
  ingesting: boolean;
  dragOver: boolean;
  error: string | null;
  onDragOverChange: (over: boolean) => void;
  onFile: (file: File) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Source</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            props.onDragOverChange(true);
          }}
          onDragLeave={() => props.onDragOverChange(false)}
          onDrop={(e) => {
            e.preventDefault();
            props.onDragOverChange(false);
            const file = e.dataTransfer.files?.[0];
            if (file) props.onFile(file);
          }}
          className={cn(
            'flex flex-col items-center gap-2 rounded-md border border-dashed p-4 transition-colors',
            props.dragOver && 'border-primary bg-accent',
          )}
        >
          <span className="text-xs text-muted-foreground">
            {props.ingesting ? 'Sampling…' : 'Drop a video here'}
          </span>
          <Button asChild variant="outline" size="sm">
            <label htmlFor="file" className="cursor-pointer">
              Load video
            </label>
          </Button>
        </div>
        <input
          id="file"
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) props.onFile(file);
          }}
        />
        {props.error && (
          <Alert variant="destructive" id="msg">
            <AlertTitle>Ingest failed</AlertTitle>
            <AlertDescription>{props.error}</AlertDescription>
          </Alert>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
