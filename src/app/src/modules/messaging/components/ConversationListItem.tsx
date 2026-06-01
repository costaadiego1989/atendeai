import { cn } from '@/lib/utils';
import { Instagram, Megaphone, MessageCircle } from 'lucide-react';
import type { useConversationsPageViewModel } from '../view-models/useConversationsPageViewModel';
import {
  formatConversationClock,
  formatConversationPhone,
  getQueueSignal,
  getSentimentMeta,
  getSignalClassName,
  isProspectConversation,
} from '../utils/conversation-ui-helpers';

type ConversationsPageViewModel = ReturnType<typeof useConversationsPageViewModel>;

interface ConversationListItemProps {
  conversation: ConversationsPageViewModel['conversations'][number];
  isSelected: boolean;
  currentUserId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationListItem({
  conversation,
  isSelected,
  currentUserId,
  onSelect,
}: ConversationListItemProps) {
  const signal = getQueueSignal(conversation, currentUserId);
  const interactionAt =
    conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={cn(
        'block w-full rounded-2xl border text-left transition-all',
        isSelected
          ? 'border-primary/30 bg-primary/5 shadow-sm'
          : 'border-border/60 bg-background hover:bg-muted/20',
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {conversation.contactName.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-foreground">
                  {conversation.contactName}
                </p>
                {isProspectConversation(conversation) ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                    <Megaphone className="h-2.5 w-2.5" />
                    Prospect
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {formatConversationPhone(conversation.contactPhone)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-muted-foreground">
                {formatConversationClock(interactionAt)}
              </p>
              {(conversation.unreadCount ?? 0) > 0 ? (
                <span className="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  {conversation.unreadCount}
                </span>
              ) : null}
            </div>
          </div>

          <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
            {conversation.intelligence?.summary ||
              conversation.lastMessage ||
              'Conversa sem mensagens ainda'}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {conversation.channel === 'INSTAGRAM' ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-400">
                  <Instagram className="h-2.5 w-2.5" />
                  IG
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <MessageCircle className="h-2.5 w-2.5" />
                  WA
                </span>
              )}
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
                  getSignalClassName(signal.tone),
                )}
              >
                {signal.label}
              </span>
              {conversation.intelligence ? (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
                    getSentimentMeta(conversation.intelligence.sentiment).className,
                  )}
                >
                  {getSentimentMeta(conversation.intelligence.sentiment).label}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
