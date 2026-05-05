import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { ContactStage, Conversation, ConversationStatus } from '@/shared/types';
import { contactsService } from '@/modules/contacts/services/contacts-service';

export const CONTACT_STAGE_OPTIONS: Array<{ value: ContactStage; label: string }> = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'OPPORTUNITY', label: 'Oportunidade' },
  { value: 'CUSTOMER', label: 'Cliente' },
  { value: 'INACTIVE', label: 'Inativo' },
];

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function useContactDetailViewModel() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draggingStage, setDraggingStage] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    tags: '',
    notes: '',
  });

  const contactQuery = useQuery({
    queryKey: ['contact-detail', tenant?.id, contactId],
    queryFn: () => contactsService.getContact(tenant!.id, contactId!),
    enabled: !!tenant?.id && !!contactId,
  });

  const timelineQuery = useQuery({
    queryKey: ['contact-timeline', tenant?.id, contactId],
    queryFn: () => contactsService.getContactTimeline(tenant!.id, contactId!),
    enabled: !!tenant?.id && !!contactId,
  });

  useEffect(() => {
    if (!contactQuery.data) {
      return;
    }

    setEditForm({
      name: contactQuery.data.name,
      email: contactQuery.data.email || '',
      tags: (contactQuery.data.tags ?? []).join(', '),
      notes: contactQuery.data.notes || '',
    });
  }, [contactQuery.data]);

  function upsertConversationInCache(
    conversation: Conversation,
    status: ConversationStatus,
  ) {
    const targets: Array<ConversationStatus | 'ALL'> = ['ALL'];

    if (status === 'ACTIVE' || status === 'PENDING_HUMAN' || status === 'ARCHIVED') {
      targets.push(status);
    }

    for (const target of targets) {
      queryClient.setQueryData<
        { data: Conversation[]; meta?: { total?: number; page?: number; limit?: number; totalPages?: number } } | undefined
      >(['conversations', tenant?.id, target], (current) => {
        if (!current) {
          return {
            data: [conversation],
            meta: {
              total: 1,
              page: 1,
              limit: 50,
              totalPages: 1,
            },
          };
        }

        const existing = current.data ?? [];
        const withoutCurrent = existing.filter((item) => item.id !== conversation.id);

        return {
          ...current,
          data: [conversation, ...withoutCurrent],
          meta: current.meta
            ? {
                ...current.meta,
                total:
                  typeof current.meta.total === 'number'
                    ? Math.max(current.meta.total, withoutCurrent.length + 1)
                    : current.meta.total,
              }
            : current.meta,
        };
      });
    }
  }

  const updateContactMutation = useMutation({
    mutationFn: () =>
      contactsService.updateContact(tenant!.id, contactId!, {
        name: editForm.name.trim(),
        email: editForm.email.trim() || undefined,
        tags: parseTags(editForm.tags),
        notes: editForm.notes.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['contacts', tenant?.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['contact-detail', tenant?.id, contactId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['contact-timeline', tenant?.id, contactId],
        }),
      ]);
      setEditOpen(false);
      toast({
        title: 'Contato atualizado',
        description: 'Os dados do CRM foram atualizados com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar contato',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível atualizar este contato agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: (stage: ContactStage) =>
      contactsService.updateContactStage(tenant!.id, contactId!, stage),
    onSuccess: async (_, stage) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['contacts', tenant?.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['contact-detail', tenant?.id, contactId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['contact-timeline', tenant?.id, contactId],
        }),
      ]);
      toast({
        title: 'Estágio atualizado',
        description: `O contato agora está em ${CONTACT_STAGE_OPTIONS.find((option) => option.value === stage)?.label.toLowerCase()}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar estágio',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível mover este contato no funil agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: () => contactsService.deleteContact(tenant!.id, contactId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
      toast({
        title: 'Contato removido',
        description: 'O contato foi removido do CRM.',
      });
      navigate('/app/contacts');
    },
    onError: (error) => {
      toast({
        title: 'Falha ao remover contato',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível remover este contato agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const openConversationMutation = useMutation({
    mutationFn: () => contactsService.openConversation(tenant!.id, contactId!),
    onSuccess: async (result) => {
      if (tenant?.id && contactQuery.data) {
        upsertConversationInCache(
          {
            id: result.conversationId,
            contactId: result.contactId,
            contactName: contactQuery.data.name,
            contactPhone: contactQuery.data.phone,
            status: result.status,
            channel: result.channel,
            unreadCount: 0,
            createdAt: new Date().toISOString(),
          },
          result.status,
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ['conversations', tenant?.id],
        exact: false,
      });
      navigate(`/app/conversations/${result.conversationId}`);
      toast({
        title: result.created ? 'Conversa iniciada' : 'Conversa aberta',
        description: 'A jornada do contato continua no inbox operacional.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao abrir conversa',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível abrir a conversa deste contato agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const timelineEntries = useMemo(
    () => [...(timelineQuery.data?.entries ?? [])].reverse(),
    [timelineQuery.data?.entries],
  );

  return {
    tenant,
    contactId,
    editOpen,
    setEditOpen,
    deleteOpen,
    setDeleteOpen,
    draggingStage,
    setDraggingStage,
    editForm,
    setEditForm,
    contact: contactQuery.data,
    timeline: timelineEntries,
    contactQuery,
    timelineQuery,
    updateContactMutation,
    updateStageMutation,
    deleteContactMutation,
    openConversationMutation,
    stageOptions: CONTACT_STAGE_OPTIONS,
    updateEditForm<K extends keyof typeof editForm>(
      field: K,
      value: (typeof editForm)[K],
    ) {
      setEditForm((current) => ({ ...current, [field]: value }));
    },
    submitEdit() {
      if (!editForm.name.trim()) {
        toast({
          title: 'Informe o nome do contato',
          description: 'O nome é obrigatório para manter o CRM consistente.',
          variant: 'destructive',
        });
        return;
      }

      updateContactMutation.mutate();
    },
    updateStage(stage: ContactStage) {
      updateStageMutation.mutate(stage);
    },
    deleteContact() {
      deleteContactMutation.mutate();
    },
    openConversation() {
      openConversationMutation.mutate();
    },
  };
}
