import { MessageCircle } from 'lucide-react';

interface WidgetPreviewProps {
  name?: string;
  greeting?: string | null;
  color?: string | null;
  position?: 'bottom-right' | 'bottom-left';
}

export function WidgetPreview({ name, greeting, color, position }: WidgetPreviewProps) {
  const bgColor = color || '#3b82f6';
  const isLeft = position === 'bottom-left';

  return (
    <div className="relative h-[320px] w-full rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
      {/* Simulated page background */}
      <div className="absolute inset-0 p-4">
        <div className="h-3 w-24 rounded bg-muted/50 mb-2" />
        <div className="h-2 w-48 rounded bg-muted/40 mb-1" />
        <div className="h-2 w-36 rounded bg-muted/40 mb-1" />
        <div className="h-2 w-44 rounded bg-muted/40" />
      </div>

      {/* Chat bubble */}
      <div
        className={`absolute bottom-4 ${isLeft ? 'left-4' : 'right-4'} flex flex-col items-${isLeft ? 'start' : 'end'} gap-2`}
      >
        {/* Greeting tooltip */}
        {greeting && (
          <div className="max-w-[200px] rounded-lg bg-white p-3 shadow-lg border border-border/40">
            <p className="text-xs text-foreground">{greeting}</p>
          </div>
        )}

        {/* FAB button */}
        <button
          className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: bgColor }}
          aria-label="Abrir chat"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Label */}
      <div className="absolute top-3 left-3">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Preview — {name || 'Widget'}
        </span>
      </div>
    </div>
  );
}
