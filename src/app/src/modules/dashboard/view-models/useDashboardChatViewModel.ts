import { useState, useCallback, useRef } from 'react';
import {
  dashboardChatService,
  DashboardChatMessage,
} from '@/modules/dashboard/services/dashboard-chat-service';

const NICHE_SUGGESTIONS: Record<string, string[]> = {
  ECOMMERCE: [
    'Qual foi meu faturamento hoje?',
    'Quais produtos estão com estoque baixo?',
    'Quantos pedidos estão pendentes?',
    'Qual meu ticket médio este mês?',
  ],
  FOOD: [
    'Quantos pedidos entraram hoje?',
    'Qual o prato mais vendido esta semana?',
    'Tem algum item acabando no estoque?',
  ],
  CLINIC: [
    'Como está a agenda de amanhã?',
    'Quantos pacientes atendi esta semana?',
    'Quais horários estão vagos hoje?',
  ],
  SALON: [
    'Como está minha ocupação esta semana?',
    'Quantos agendamentos tenho amanhã?',
    'Qual serviço mais procurado este mês?',
  ],
  RECOVERY: [
    'Quanto recuperei este mês?',
    'Qual a taxa de conversão das cobranças?',
    'Quais são os maiores devedores?',
  ],
  GENERIC: [
    'Qual foi meu faturamento esta semana?',
    'Quantos atendimentos estão em fila?',
    'Quantos contatos novos este mês?',
    'Como está o tempo de resposta?',
  ],
};

export function useDashboardChatViewModel(businessType: string = 'GENERIC') {
  const [messages, setMessages] = useState<DashboardChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const threadIdRef = useRef<string>(`thread_${Date.now()}`);

  const suggestions =
    NICHE_SUGGESTIONS[businessType?.toUpperCase()] ||
    NICHE_SUGGESTIONS.GENERIC;

  const sendMessage = useCallback(
    async (content: string, tenantId: string) => {
      if (!content.trim() || isStreaming) return;

      const userMessage: DashboardChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: content.trim(),
        createdAt: new Date(),
      };

      const assistantMessage: DashboardChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: '',
        isStreaming: true,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInput('');
      setIsStreaming(true);

      try {
        for await (const event of dashboardChatService.stream(
          tenantId,
          content.trim(),
          threadIdRef.current,
        )) {
          if (event.type === 'token' && event.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: m.content + event.content }
                  : m,
              ),
            );
          } else if (event.type === 'tool_start' && event.toolName) {
            setActiveTool(event.toolName);
          } else if (event.type === 'tool_end') {
            setActiveTool(null);
          } else if (event.type === 'error' && event.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: m.content || `Erro: ${event.content}` }
                  : m,
              ),
            );
          } else if (event.type === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, isStreaming: false }
                  : m,
              ),
            );
          }
        }
      } finally {
        setIsStreaming(false);
        setActiveTool(null);
      }
    },
    [isStreaming],
  );

  const cancel = useCallback(() => {
    dashboardChatService.cancel();
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    threadIdRef.current = `thread_${Date.now()}`;
  }, []);

  return {
    messages,
    input,
    setInput,
    isStreaming,
    activeTool,
    suggestions,
    sendMessage,
    cancel,
    clear,
  };
}