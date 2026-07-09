import { useState } from 'react';
import { MessageCircle, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardChatViewModel } from '@/modules/dashboard/view-models/useDashboardChatViewModel';
import { DashboardChatMessages } from './DashboardChatMessages';
import { DashboardChatInput } from './DashboardChatInput';
import { DashboardChatSuggestions } from './DashboardChatSuggestions';

interface Props {
  tenantId: string;
  businessType?: string;
}

export function DashboardChatWidget({ tenantId, businessType }: Props) {
  const [open, setOpen] = useState(false);
  const vm = useDashboardChatViewModel(businessType || 'GENERIC');

  const handleSend = () => {
    vm.sendMessage(vm.input, tenantId);
  };

  const handlePick = (s: string) => {
    vm.sendMessage(s, tenantId);
  };

  return (
    <>
      {!open && (
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
          aria-label="Abrir chat do dashboard"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[380px] flex-col rounded-2xl border bg-background shadow-2xl">
          <header className="flex items-center justify-between border-b p-3">
            <div>
              <p className="text-sm font-semibold">Assistente do Negócio</p>
              <p className="text-xs text-muted-foreground">IA com dados em tempo real</p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={vm.clear}
                aria-label="Limpar conversa"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <DashboardChatMessages
            messages={vm.messages}
            isStreaming={vm.isStreaming}
            activeTool={vm.activeTool}
          />

          {vm.messages.length === 0 && (
            <DashboardChatSuggestions
              suggestions={vm.suggestions}
              onPick={handlePick}
              disabled={vm.isStreaming}
            />
          )}

          <DashboardChatInput
            value={vm.input}
            onChange={vm.setInput}
            onSend={handleSend}
            onCancel={vm.cancel}
            isStreaming={vm.isStreaming}
          />
        </div>
      )}
    </>
  );
}
