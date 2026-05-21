import { Bot, MessageCircle } from 'lucide-react';

interface WidgetPreviewProps {
  name?: string;
  greeting?: string | null;
  color?: string | null;
  backgroundColor?: string | null;
  avatarUrl?: string | null;
  position?: 'bottom-right' | 'bottom-left';
}

export function WidgetPreview({ name, greeting, color, backgroundColor, avatarUrl, position }: WidgetPreviewProps) {
  const bgColor = color || '#3b82f6';
  const msgBgColor = backgroundColor || '#ffffff';
  const isLeft = position === 'bottom-left';
  const agentName = name || 'Assistente';

  return (
    <div className="relative h-[340px] w-full rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
      {/* Simulated page background */}
      <div className="absolute inset-0 p-4 opacity-40">
        <div className="h-3 w-24 rounded bg-muted/50 mb-2" />
        <div className="h-2 w-48 rounded bg-muted/40 mb-1" />
        <div className="h-2 w-36 rounded bg-muted/40 mb-1" />
        <div className="h-2 w-44 rounded bg-muted/40" />
      </div>

      {/* Chat widget panel */}
      <div
        className={`absolute bottom-4 ${isLeft ? 'left-4' : 'right-4'} flex flex-col items-${isLeft ? 'start' : 'end'} gap-2`}
        style={{ maxWidth: '210px' }}
      >
        {/* Mini chat panel */}
        <div className="w-[200px] rounded-2xl border border-border/40 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: bgColor }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={agentName} className="h-full w-full object-cover" />
              ) : (
                <Bot className="h-4 w-4 text-white" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-[11px] font-semibold text-white leading-tight">{agentName}</span>
              <span className="text-[9px] text-white/70 leading-tight">Online</span>
            </div>
          </div>

          {/* Message bubble */}
          {greeting && (
            <div className="p-2.5">
              <div
                className="rounded-xl rounded-tl-sm px-2.5 py-2 shadow-sm"
                style={{ backgroundColor: msgBgColor, border: '1px solid #e5e7eb' }}
              >
                <p className="text-[11px] text-gray-800 leading-snug">{greeting}</p>
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-1.5 border-t border-border/30 px-2.5 py-2">
            <div className="flex-1 h-6 rounded-full bg-muted/40 text-[10px] text-muted-foreground flex items-center px-2">
              Digite...
            </div>
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: bgColor }}
            >
              <MessageCircle className="h-3 w-3 text-white" />
            </div>
          </div>
        </div>

        {/* FAB */}
        <button
          className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg overflow-hidden ${isLeft ? 'self-start' : 'self-end'}`}
          style={{ backgroundColor: bgColor }}
          aria-label="Abrir chat"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={agentName} className="h-full w-full object-cover" />
          ) : (
            <MessageCircle className="h-5 w-5 text-white" />
          )}
        </button>
      </div>

      {/* Label */}
      <div className="absolute top-3 left-3">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Preview
        </span>
      </div>
    </div>
  );
}
