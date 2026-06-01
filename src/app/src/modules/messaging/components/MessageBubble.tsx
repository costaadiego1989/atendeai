import { cn } from '@/lib/utils';
import { Bot, FileText, MessageCircle, UserRound } from 'lucide-react';
import { formatConversationClock } from '../utils/conversation-ui-helpers';

interface MessageBubbleProps {
  direction: 'INBOUND' | 'OUTBOUND';
  sender: 'CONTACT' | 'AGENT' | 'AI';
  content: string;
  timestamp: string;
  status?: string;
  mediaUrl?: string;
  mediaType?: string;
}

export function MessageBubble({
  direction,
  sender,
  content,
  timestamp,
  status,
  mediaUrl,
  mediaType,
}: MessageBubbleProps) {
  const isOutbound = direction === 'OUTBOUND';
  const normalizedMediaType = mediaType?.toUpperCase();

  return (
    <div className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[82%] rounded-3xl px-4 py-3 shadow-sm',
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'border border-border/60 bg-background text-foreground',
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] opacity-80">
          {sender === 'AI' ? (
            <>
              <Bot className="h-3.5 w-3.5" />
              Agente
            </>
          ) : sender === 'AGENT' ? (
            <>
              <UserRound className="h-3.5 w-3.5" />
              Time
            </>
          ) : (
            <>
              <MessageCircle className="h-3.5 w-3.5" />
              Cliente
            </>
          )}
        </div>
        {mediaUrl ? (
          <div className="mb-2 overflow-hidden rounded-2xl border border-border/50 bg-background/50">
            {normalizedMediaType === 'IMAGE' ? (
              <img
                src={mediaUrl}
                alt={content || 'Imagem enviada'}
                className="max-h-64 w-full object-cover"
              />
            ) : normalizedMediaType === 'AUDIO' ? (
              <div className="p-3">
                <audio controls src={mediaUrl} className="w-full" />
              </div>
            ) : (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-3 text-sm font-medium underline-offset-4 hover:underline"
              >
                <FileText className="h-4 w-4" />
                Abrir documento
              </a>
            )}
          </div>
        ) : null}
        {content ? <p className="whitespace-pre-wrap text-sm leading-6">{content}</p> : null}
        <div
          className={cn(
            'mt-2 flex items-center justify-end gap-1.5 text-[11px]',
            isOutbound ? 'text-primary-foreground/75' : 'text-muted-foreground',
          )}
        >
          <span>{formatConversationClock(timestamp)}</span>
          {isOutbound && status ? (
            <span
              className={cn(
                'font-medium tracking-tight',
                status === 'READ' ? 'text-sky-300' : 'text-primary-foreground/60',
              )}
              title={status}
            >
              {status === 'READ' || status === 'DELIVERED' ? '✓✓' : '✓'}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
