import { useEffect, useRef } from 'react';
import { Bot, User, Loader2 } from 'lucide-react';
import { DashboardChatMessage } from '@/modules/dashboard/services/dashboard-chat-service';

interface Props {
  messages: DashboardChatMessage[];
  isStreaming: boolean;
  activeTool?: string | null;
}

const TOOL_LABELS: Record<string, string> = {
  sales_metrics: 'Consultando vendas...',
  attendance_status: 'Consultando atendimentos...',
  scheduling: 'Consultando agenda...',
  catalog_inventory: 'Consultando catálogo...',
  recovery_status: 'Consultando recuperação...',
  contacts_crm: 'Consultando contatos...',
};

export function DashboardChatMessages({ messages, isStreaming, activeTool }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTool]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Olá! Pergunte sobre seu negócio — faturamento, atendimentos, agenda, contatos...
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {m.role === 'assistant' && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
          >
            {m.content || (m.isStreaming && <Loader2 className="h-4 w-4 animate-spin" />)}
          </div>
          {m.role === 'user' && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </div>
          )}
        </div>
      ))}
      {activeTool && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
            {TOOL_LABELS[activeTool] || `Usando ${activeTool}...`}
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
