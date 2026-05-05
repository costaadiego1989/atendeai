import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { messagingService } from '@/modules/messaging/services/messaging-service';
import { messagingRealtimeService } from '@/modules/messaging/services/messaging-realtime-service';
import { useAuthStore } from '@/shared/stores/auth-store';

export function GlobalConversationNotifier() {
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const queryClient = useQueryClient();
  const notifiedMessagesRef = useRef<Set<string>>(new Set());
  const seenRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    initializedRef.current = false;
    seenRef.current = new Map();
    notifiedMessagesRef.current = new Set();
  }, [activeBranchId, tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) {
      setRealtimeConnected(false);
      return;
    }

    return messagingRealtimeService.subscribeStatus(tenant.id, (status) => {
      setRealtimeConnected(status === 'connected');
    });
  }, [tenant?.id]);

  const fallbackConversationsQuery = useQuery({
    queryKey: ['global-conversation-notifier-fallback', tenant?.id, activeBranchId],
    enabled: Boolean(tenant?.id),
    queryFn: () =>
      messagingService.listConversations(tenant!.id, {
        page: 1,
        limit: 50,
        branchId: activeBranchId,
      }),
    refetchInterval: tenant?.id && !realtimeConnected ? 5000 : false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!tenant?.id) {
      return;
    }

    return messagingRealtimeService.subscribe(tenant.id, async (event) => {
      if (event.type === 'message.received') {
        void queryClient.invalidateQueries({
          queryKey: ['conversations', tenant.id],
          exact: false,
        });
        if (event.conversationId) {
          void queryClient.invalidateQueries({
            queryKey: ['conversation-messages', tenant.id, event.conversationId],
          });
        }
      }

      if (
        event.type === 'message.queued' ||
        event.type === 'message.sent' ||
        event.type === 'message.failed'
      ) {
        if (event.conversationId) {
          void queryClient.invalidateQueries({
            queryKey: ['conversation-messages', tenant.id, event.conversationId],
          });
        }
      }

      if (event.type === 'conversation.status.changed') {
        void queryClient.invalidateQueries({
          queryKey: ['conversations', tenant.id],
          exact: false,
        });
        if (event.conversationId) {
          void queryClient.invalidateQueries({
            queryKey: ['conversation-messages', tenant.id, event.conversationId],
          });
        }
      }

      if (event.type !== 'message.received' || !event.messageId) {
        return;
      }

      if (notifiedMessagesRef.current.has(event.messageId)) {
        return;
      }

      notifiedMessagesRef.current.add(event.messageId);

      const conversations = await messagingService.listConversations(tenant.id, {
        page: 1,
        limit: 50,
        branchId: activeBranchId,
      });
      const conversation = conversations.data.find(
        (item) => item.id === event.conversationId,
      );

      if (!conversation) {
        return;
      }

      toast({
        title: `Nova mensagem no ${conversation.channel === 'INSTAGRAM' ? 'Instagram' : 'WhatsApp'}`,
        description: `${conversation.contactName} enviou uma nova mensagem.`,
      });

      if (
        typeof window !== 'undefined' &&
        document.hidden &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        new window.Notification('Nova mensagem recebida', {
          body: `${conversation.contactName}: ${conversation.lastMessage ?? 'Nova mensagem'}`,
        });
      }
    });
  }, [activeBranchId, queryClient, tenant?.id]);

  useEffect(() => {
    if (realtimeConnected) {
      initializedRef.current = false;
      seenRef.current = new Map();
      return;
    }

    const conversations = fallbackConversationsQuery.data?.data ?? [];
    if (!conversations.length) {
      return;
    }

    if (!initializedRef.current) {
      const initialMap = new Map<string, string>();
      conversations.forEach((conversation) => {
        if (conversation.lastMessageAt) {
          initialMap.set(
            conversation.id,
            `${conversation.lastMessageAt}:${conversation.lastMessage ?? ''}`,
          );
        }
      });
      seenRef.current = initialMap;
      initializedRef.current = true;
      return;
    }

    conversations.forEach((conversation) => {
      const fingerprint = conversation.lastMessageAt
        ? `${conversation.lastMessageAt}:${conversation.lastMessage ?? ''}`
        : '';
      const previous = seenRef.current.get(conversation.id);

      if (fingerprint) {
        seenRef.current.set(conversation.id, fingerprint);
      }

      if (!fingerprint || previous === fingerprint) {
        return;
      }

      if (conversation.lastMessageDirection !== 'INBOUND') {
        return;
      }

      toast({
        title: `Nova mensagem no ${conversation.channel === 'INSTAGRAM' ? 'Instagram' : 'WhatsApp'}`,
        description: `${conversation.contactName} enviou uma nova mensagem.`,
      });
    });
  }, [fallbackConversationsQuery.data?.data, realtimeConnected]);

  return null;
}
