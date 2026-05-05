import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { ConversationStatus, Message } from '@/shared/types';
import { messagingService } from '@/modules/messaging/services/messaging-service';
import { messagingRealtimeService } from '@/modules/messaging/services/messaging-realtime-service';
import { checkoutService } from '@/modules/checkout/services/checkout-service';
import { salesPaymentLinksService } from '@/modules/sales/services/sales-payment-links-service';
import type { CreateSalesSplitChargeInput } from '@/modules/sales/services/sales-types';

const DEFAULT_CHARGE_FORM = {
  name: '',
  description: '',
  customerDocument: '',
  value: '',
  billingType: 'PIX' as CreateSalesSplitChargeInput['billingType'],
  dueDate: '',
  recurring: false,
  recurrenceFrequency: 'MONTHLY' as NonNullable<CreateSalesSplitChargeInput['recurrenceFrequency']>,
  recurrenceStartDate: '',
  recurrenceEndDate: '',
};

const CHARGE_BUSINESS_TYPES = new Set(['RECOVERY']);
const COMMERCE_BUSINESS_TYPES = new Set([
  'ECOMMERCE',
  'FOOD',
  'RETAIL',
  'MARKET',
  'GROCERY',
  'BAKERY',
  'CAFETERIA',
  'SUPERMARKET',
]);
const CHARGE_MODULE_CODES = [
  'Cobrança_AUTO',
  'COBRANCA_AUTO',
  'RECOVERY_WALLET',
  'RECOVERY_AUTOMATION',
  'RECOVERY_REPORTS',
];

const COMMERCE_MODULE_CODE = 'COMMERCE';

const HUMAN_STATUS_LABELS: Record<'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED', string> = {
  ACTIVE: 'Fluxo ativo',
  PENDING_HUMAN: 'Atendimento humano',
  ARCHIVED: 'Encerrada',
};

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() ?? '';
}

function parseCurrencyInput(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  const amount = Number(digits) / 100;
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export type ConversationQueueFilter =
  | 'ALL'
  | 'NEW'
  | 'MINE'
  | 'WAITING_CUSTOMER';

export function useConversationsPageViewModel() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { tenant, user, activeBranchId } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    conversationId ?? null,
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'ALL' | 'OPEN'>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'WHATSAPP' | 'INSTAGRAM'>('ALL');
  const [queueFilter, setQueueFilter] = useState<ConversationQueueFilter>('ALL');
  const [draftMessage, setDraftMessage] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState(DEFAULT_CHARGE_FORM);
  const tenantBusinessType = normalizeCode(tenant?.businessType);
  const enabledModuleCodes = new Set(
    (tenant?.billingAccess?.enabledModules ?? []).map(normalizeCode),
  );
  const moduleAccessCodes = new Set(
    Object.entries(tenant?.billingAccess?.moduleAccess ?? {})
      .filter(([, enabled]) => enabled)
      .map(([code]) => normalizeCode(code)),
  );
  const hasChargeModule = CHARGE_MODULE_CODES.some(
    (code) => enabledModuleCodes.has(normalizeCode(code)) || moduleAccessCodes.has(normalizeCode(code)),
  );

  const commerceModuleActive =
    enabledModuleCodes.has(normalizeCode(COMMERCE_MODULE_CODE)) ||
    moduleAccessCodes.has(normalizeCode(COMMERCE_MODULE_CODE));

  const supportsManualSaleAttribution =
    Boolean(tenant?.id) && !commerceModuleActive;

  const canCreateConversationCharge =
    Boolean(tenant?.id) &&
    !COMMERCE_BUSINESS_TYPES.has(tenantBusinessType) &&
    (CHARGE_BUSINESS_TYPES.has(tenantBusinessType) || hasChargeModule);

  const clearConversationUnreadInCache = (conversationId: string) => {
    queryClient.setQueriesData(
      { queryKey: ['conversations', tenant?.id], exact: false },
      (current: { data?: Message[] } | { data?: any[]; meta?: unknown } | undefined) => {
        if (!current || !('data' in current) || !Array.isArray(current.data)) {
          return current;
        }

        return {
          ...current,
          data: current.data.map((conversation: any) =>
            conversation.id === conversationId
              ? {
                ...conversation,
                unreadCount: 0,
              }
              : conversation,
          ),
        };
      },
    );
  };

  useEffect(() => {
    setSelectedConversationId(conversationId ?? null);
  }, [conversationId]);

  useEffect(() => {
    if (!tenant?.id) {
      setRealtimeConnected(false);
      return;
    }

    return messagingRealtimeService.subscribeStatus(tenant.id, (status) => {
      setRealtimeConnected(status === 'connected');
    });
  }, [tenant?.id]);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', tenant?.id, activeBranchId, statusFilter],
    queryFn: () =>
      messagingService.listConversations(tenant!.id, {
        branchId: activeBranchId,
        status: statusFilter === 'ALL' || statusFilter === 'OPEN' ? undefined : statusFilter,
      }),
    enabled: !!tenant?.id,
    refetchInterval: tenant?.id && !realtimeConnected ? 8000 : false,
    retry: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  });

  const conversations = useMemo(() => {
    const base = conversationsQuery.data?.data ?? [];
    const term = search.trim().toLowerCase();
    const filtered = base.filter(
      (conversation) =>
        (channelFilter === 'ALL' || conversation.channel === channelFilter) &&
        (statusFilter !== 'OPEN' ||
          conversation.status === 'ACTIVE' ||
          conversation.status === 'PENDING_HUMAN') &&
        (queueFilter === 'ALL' ||
          (queueFilter === 'NEW' && (conversation.unreadCount ?? 0) > 0) ||
          (queueFilter === 'MINE' &&
            conversation.status === 'PENDING_HUMAN' &&
            conversation.assignedToUserId === (user?.id ?? null)) ||
          (queueFilter === 'WAITING_CUSTOMER' &&
            conversation.status === 'ACTIVE' &&
            conversation.lastMessageDirection === 'OUTBOUND' &&
            (conversation.unreadCount ?? 0) === 0)) &&
        (!term ||
          conversation.contactName.toLowerCase().includes(term) ||
          conversation.contactPhone.toLowerCase().includes(term) ||
          (conversation.lastMessage || '').toLowerCase().includes(term)),
    );

    const prioritized = [...filtered].sort((left, right) => {
      const getPriority = (conversation: (typeof filtered)[number]) => {
        if ((conversation.unreadCount ?? 0) > 0 && conversation.status === 'PENDING_HUMAN') {
          return 0;
        }

        if ((conversation.unreadCount ?? 0) > 0) {
          return 1;
        }

        if (conversation.status === 'PENDING_HUMAN') {
          return 2;
        }

        if (conversation.lastMessageDirection === 'OUTBOUND') {
          return 3;
        }

        if (conversation.status === 'ACTIVE') {
          return 4;
        }

        return 5;
      };

      const priorityDiff = getPriority(left) - getPriority(right);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const leftSequence = left.lastMessageSequence ?? 0;
      const rightSequence = right.lastMessageSequence ?? 0;
      if (leftSequence !== rightSequence) {
        return rightSequence - leftSequence;
      }

      const leftTimestamp = new Date(
        left.lastMessageAt ?? left.updatedAt ?? left.createdAt,
      ).getTime();
      const rightTimestamp = new Date(
        right.lastMessageAt ?? right.updatedAt ?? right.createdAt,
      ).getTime();

      return rightTimestamp - leftTimestamp;
    });

    return prioritized;
  }, [
    channelFilter,
    conversationsQuery.data?.data,
    queueFilter,
    search,
    selectedConversationId,
    statusFilter,
    user?.id,
  ]);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ||
    (conversationsQuery.data?.data ?? []).find(
      (conversation) => conversation.id === selectedConversationId,
    ) ||
    null;

  useEffect(() => {
    if (!tenant?.id) {
      return;
    }

    void conversationsQuery.refetch();
  }, [activeBranchId, conversationsQuery.refetch, tenant?.id, statusFilter]);

  useEffect(() => {
    if (!tenant?.id || conversationsQuery.isLoading) {
      return;
    }

    if (!selectedConversationId && conversations[0]) {
      setSelectedConversationId(conversations[0].id);
      navigate(`/app/conversations/${conversations[0].id}`, { replace: true });
      return;
    }

    if (selectedConversationId && !selectedConversation && conversations[0]) {
      setSelectedConversationId(conversations[0].id);
      navigate(`/app/conversations/${conversations[0].id}`, { replace: true });
    }
  }, [
    conversations,
    conversationsQuery.isLoading,
    navigate,
    selectedConversation,
    selectedConversationId,
    tenant?.id,
  ]);

  const messagesQuery = useQuery({
    queryKey: ['conversation-messages', tenant?.id, selectedConversation?.id],
    queryFn: () => messagingService.getMessages(tenant!.id, selectedConversation!.id),
    enabled: !!tenant?.id && !!selectedConversation?.id,
    refetchInterval: tenant?.id && selectedConversation?.id && !realtimeConnected ? 4000 : false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const saleAttributionQuery = useQuery({
    queryKey: ['conversation-sale-attribution', tenant?.id, selectedConversation?.id],
    queryFn: () =>
      messagingService.getSaleAttribution(tenant!.id, selectedConversation!.id),
    enabled:
      !!tenant?.id &&
      !!selectedConversation?.id &&
      supportsManualSaleAttribution,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const checkoutOrdersQuery = useQuery({
    queryKey: ['checkout-orders-for-conversations', tenant?.id, activeBranchId],
    queryFn: () => checkoutService.listOrders(tenant!.id, { branchId: activeBranchId }),
    enabled: !!tenant?.id,
    refetchInterval: tenant?.id && !realtimeConnected ? 12000 : false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const selectedCheckoutOrder =
    (checkoutOrdersQuery.data ?? []).find(
      (order) => order.conversationId === selectedConversation?.id,
    ) ?? null;

  const checkoutOrderDetailsQuery = useQuery({
    queryKey: ['checkout-order-by-conversation', tenant?.id, selectedCheckoutOrder?.id],
    queryFn: () => checkoutService.getOrderDetails(tenant!.id, selectedCheckoutOrder!.id),
    enabled: !!tenant?.id && !!selectedCheckoutOrder?.id,
    refetchInterval:
      tenant?.id && selectedCheckoutOrder?.id && !realtimeConnected ? 12000 : false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!tenant?.id || !selectedConversation?.id) {
      return;
    }

    void messagesQuery.refetch();
  }, [messagesQuery.refetch, selectedConversation?.id, tenant?.id]);

  useEffect(() => {
    if (!tenant?.id || !selectedConversation?.id) {
      return;
    }

    if ((selectedConversation.unreadCount ?? 0) === 0) {
      return;
    }

    clearConversationUnreadInCache(selectedConversation.id);

    void messagingService
      .markConversationRead(tenant.id, selectedConversation.id)
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: ['conversations', tenant.id],
          exact: false,
        }),
      )
      .catch(() => {
        void queryClient.invalidateQueries({
          queryKey: ['conversations', tenant.id],
          exact: false,
        });
      });
  }, [
    queryClient,
    selectedConversation?.id,
    selectedConversation?.unreadCount,
    tenant?.id,
  ]);

  const sendMessageMutation = useMutation({
    mutationFn: (payload: { text: string; file?: File | null }) => {
      if (payload.file) {
        return messagingService.uploadMessage(
          tenant!.id,
          selectedConversation!.id,
          payload.file,
          payload.text,
        );
      }

      return messagingService.sendMessage(tenant!.id, selectedConversation!.id, payload.text);
    },
    onSuccess: () => {
      setDraftMessage('');
      setSelectedAttachment(null);
      void queryClient.invalidateQueries({
        queryKey: ['conversation-messages', tenant?.id, selectedConversation?.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ['conversations', tenant?.id],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ['checkout-orders-for-conversations', tenant?.id],
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao enviar mensagem',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível enviar a mensagem agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: 'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED') =>
      messagingService.updateConversationStatus(tenant!.id, selectedConversation!.id, status),
    onSuccess: (_, status) => {
      void queryClient.invalidateQueries({
        queryKey: ['conversations', tenant?.id],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ['conversation-messages', tenant?.id, selectedConversation?.id],
      });
      toast({
        title: 'Status atualizado',
        description: `A conversa agora está em ${HUMAN_STATUS_LABELS[status].toLowerCase()}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar status',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível atualizar o status da conversa agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const markSaleAttributionMutation = useMutation({
    mutationFn: (payload: { saleAmount?: number; notes?: string }) =>
      messagingService.markSaleAttribution(
        tenant!.id,
        selectedConversation!.id,
        payload,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [
          'conversation-sale-attribution',
          tenant?.id,
          selectedConversation?.id,
        ],
      });
      toast({
        title: 'Venda registada',
        description:
          'A IA confirmou o contexto da conversa e a venda foi atribuída.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível registar a venda',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage:
            'Verifique se há evidência clara de fecho na conversa ou tente novamente.',
        }),
        variant: 'destructive',
      });
    },
  });

  const voidSaleAttributionMutation = useMutation({
    mutationFn: () =>
      messagingService.voidSaleAttribution(tenant!.id, selectedConversation!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [
          'conversation-sale-attribution',
          tenant?.id,
          selectedConversation?.id,
        ],
      });
      toast({
        title: 'Marcação anulada',
        description: 'Esta conversa deixou de contar como venda manual.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao anular',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível anular a marcação agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const suggestReplyMutation = useMutation({
    mutationFn: () =>
      messagingService.suggestReply(tenant!.id, selectedConversation!.id),
    onSuccess: (response) => {
      setDraftMessage(response.text);
      toast({
        title: 'Sugestão gerada',
        description: 'Um rascunho de IA foi preenchido na caixa de texto.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao gerar sugestão',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage:
            'Não foi possível gerar a sugestão agora. Se o problema persistir, verifique creditos de IA em Cobrança.',
        }),
        variant: 'destructive',
      });
    },
  });

  const updateCheckoutAbandonmentStateMutation = useMutation({
    mutationFn: (paused: boolean) =>
      checkoutService.updateAbandonmentState(tenant!.id, selectedCheckoutOrder!.id, {
        paused,
        userId: user?.id,
        userName: user?.name,
      }),
    onSuccess: (_, paused) => {
      void queryClient.invalidateQueries({
        queryKey: ['checkout-orders-for-conversations', tenant?.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ['checkout-order-by-conversation', tenant?.id, selectedCheckoutOrder?.id],
      });
      toast({
        title: paused ? 'Mensagem pausada' : 'Mensagem retomada',
        description: paused
          ? 'Os toques automáticos desse checkout foram pausados.'
          : 'Os toques automáticos desse checkout voltaram a ficar ativos.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar a mensagem',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível atualizar a mensagem de abandono agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const triggerCheckoutAbandonmentTouchMutation = useMutation({
    mutationFn: () =>
      checkoutService.triggerAbandonmentTouch(tenant!.id, selectedCheckoutOrder!.id, {
        userId: user?.id,
        userName: user?.name,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['checkout-orders-for-conversations', tenant?.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ['checkout-order-by-conversation', tenant?.id, selectedCheckoutOrder?.id],
      });
      toast({
        title: 'Retomada enviada',
        description: 'A mensagem de abandono disparou um novo toque para essa conversa.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao reenviar retomada',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível disparar um novo toque agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const createConversationChargeMutation = useMutation({
    mutationFn: () => {
      if (!selectedConversation?.contactId) {
        throw new Error('Conversa sem contato vinculado.');
      }

      const numericValue = parseCurrencyInput(chargeForm.value);

      if (!(numericValue > 0)) {
        throw new Error('Informe um valor valido para a cobranca.');
      }

      if (chargeForm.recurring && !chargeForm.recurrenceEndDate) {
        throw new Error('Informe a data final da recorrência.');
      }

      return salesPaymentLinksService.createSplitCharge({
        contactId: selectedConversation.contactId,
        conversationId: selectedConversation.id,
        customerDocument: chargeForm.customerDocument || undefined,
        name: chargeForm.name.trim(),
        description: chargeForm.description.trim() || undefined,
        value: numericValue,
        billingType: chargeForm.billingType,
        dueDate: chargeForm.dueDate || undefined,
        sendViaWhatsApp: true,
        recurring: chargeForm.recurring,
        recurrenceFrequency: chargeForm.recurring
          ? chargeForm.recurrenceFrequency
          : undefined,
        recurrenceStartDate: chargeForm.recurring
          ? chargeForm.recurrenceStartDate || chargeForm.dueDate || undefined
          : undefined,
        recurrenceEndDate: chargeForm.recurring
          ? chargeForm.recurrenceEndDate
          : undefined,
        branchId: activeBranchId,
      });
    },
    onSuccess: async () => {
      setChargeDialogOpen(false);
      setChargeForm(DEFAULT_CHARGE_FORM);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['conversation-messages', tenant?.id, selectedConversation?.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['conversations', tenant?.id],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ['sales-payment-links'],
          exact: false,
        }),
      ]);
      toast({
        title: 'Cobranca enviada',
        description: 'O link de pagamento foi criado e enviado no WhatsApp do cliente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao enviar cobranca',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Nao foi possivel criar e enviar a cobranca agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const saleAttribution = saleAttributionQuery.data?.sale ?? null;
  const canVoidSaleAttribution = Boolean(
    saleAttribution &&
      user &&
      (user.role === 'OWNER' ||
        user.role === 'ADMIN' ||
        saleAttribution.markedByUserId === user.id),
  );

  return {
    tenant,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    channelFilter,
    setChannelFilter,
    queueFilter,
    setQueueFilter,
    draftMessage,
    setDraftMessage,
    selectedAttachment,
    setSelectedAttachment,
    clearSelectedAttachment() {
      setSelectedAttachment(null);
    },
    realtimeConnected,
    conversations,
    conversationsQuery,
    selectedConversation,
    messages: messagesQuery.data?.data ?? [],
    messagesQuery,
    supportsManualSaleAttribution,
    saleAttribution,
    saleAttributionQuery,
    markSaleAttributionMutation,
    voidSaleAttributionMutation,
    canVoidSaleAttribution,
    latestInboundMessage:
      [...(messagesQuery.data?.data ?? [])]
        .reverse()
        .find((message: Message) => message.direction === 'INBOUND') ?? null,
    selectedCheckoutOrder,
    selectedCheckoutSession: checkoutOrderDetailsQuery.data?.session ?? null,
    selectedCheckoutAbandonmentTouches:
      checkoutOrderDetailsQuery.data?.abandonmentTouches ?? [],
    checkoutOrdersQuery,
    checkoutOrderDetailsQuery,
    sendMessageMutation,
    updateStatusMutation,
    suggestReplyMutation,
    updateCheckoutAbandonmentStateMutation,
    triggerCheckoutAbandonmentTouchMutation,
    chargeDialogOpen,
    setChargeDialogOpen,
    chargeForm,
    setChargeForm,
    formatConversationChargeValue(value: string) {
      setChargeForm((current) => ({
        ...current,
        value: formatCurrencyInput(value),
      }));
    },
    createConversationChargeMutation,
    selectConversation(id: string) {
      setSelectedConversationId(id);
      navigate(`/app/conversations/${id}`);
    },
    sendMessage() {
      const text = draftMessage.trim();
      if ((!text && !selectedAttachment) || !selectedConversation) {
        return;
      }

      if (selectedConversation.status === 'ARCHIVED') {
        toast({
          title: 'Conversa encerrada',
          description:
            'Reative a conversa em "Fluxo ativo" ou "Atendimento humano" antes de enviar nova mensagem.',
          variant: 'destructive',
        });
        return;
      }

      sendMessageMutation.mutate({
        text,
        file: selectedAttachment,
      });
    },
    updateConversationStatus(status: 'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED') {
      if (!selectedConversation) {
        return;
      }

      updateStatusMutation.mutate(status);
    },
    openSelectedContact() {
      if (!selectedConversation?.contactId) {
        return;
      }

      navigate(`/app/contacts/${selectedConversation.contactId}`);
    },
    openRecovery() {
      navigate('/app/recovery');
    },
    openPaymentLinks() {
      if (!canCreateConversationCharge) {
        navigate('/app/sales/payment-links');
        return;
      }

      if (!selectedConversation) {
        navigate('/app/sales/payment-links');
        return;
      }

      setChargeForm((current) => ({
        ...current,
        name: current.name || `Cobranca para ${selectedConversation.contactName}`,
      }));
      setChargeDialogOpen(true);
    },
    submitConversationCharge() {
      if (!chargeForm.name.trim()) {
        toast({
          title: 'Informe o titulo',
          description: 'A cobranca precisa de um titulo para ser enviada.',
          variant: 'destructive',
        });
        return;
      }

      createConversationChargeMutation.mutate();
    },
    openScheduling() {
      navigate('/app/scheduling');
    },
    openCheckout() {
      navigate('/app/checkout');
    },
    currentUserId: user?.id ?? null,
    userRole: user?.role ?? null,
    canCreateConversationCharge,
  };
}
