import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { contactsService } from '@/modules/contacts/services/contacts-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { formatCurrencyInput, parseCurrencyInput } from '@/shared/lib/masks';
import { formatCurrency } from '@/shared/lib/formatters';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { Contact } from '@/shared/types';
import { proposalsService } from '../services/proposals-service';
import { getProposalPublicPath } from '../utils/proposal-finance';
import {
  createProposalFormState,
  createProposalItemDraft,
  type ProposalFormState,
  type ProposalItemDraft,
  type ProposalRecord,
  type ProposalStatus,
} from '../types';

type ProposalStatusFilter = ProposalStatus | 'ALL';

const STATUS_OPTIONS: Array<{ value: ProposalStatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'SCHEDULED', label: 'Agendadas' },
  { value: 'SENT', label: 'Enviadas' },
  { value: 'ACCEPTED', label: 'Aceitas' },
  { value: 'REJECTED', label: 'Rejeitadas' },
  { value: 'EXPIRED', label: 'Expiradas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function toLocalDatetimeInput(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateInput(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildContactLabelMap(contacts: Contact[]) {
  return contacts.reduce<Record<string, string>>((acc, contact) => {
    acc[contact.id] = contact.name;
    return acc;
  }, {});
}

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function proposalMatchesSearch(proposal: ProposalRecord, search: string, contactName?: string) {
  if (!search) {
    return true;
  }

  const haystack = [
    proposal.title,
    proposal.description ?? '',
    proposal.benefits ?? '',
    proposal.status,
    proposal.contactId,
    contactName ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(search);
}

function getDefaultScheduleValue() {
  const date = new Date(Date.now() + 15 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseMetadataFinalPrice(metadata: ProposalRecord['metadata']) {
  const value =
    metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>).finalPrice
      : undefined;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

function buildProposalItems(items: ProposalFormState['items']) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      name: String(item.name ?? '').trim(),
      quantity: Number(item.quantity || 0),
      unitPrice: Number(parseCurrencyInput(item.unitPrice) ?? 0),
      description: String(item.description ?? '').trim() || undefined,
    }))
    .filter((item) => item.name && item.quantity > 0);
}

function buildProposalPayload(
  tenantId: string,
  userId: string,
  form: ProposalFormState,
) {
  const finalPrice = Number(parseCurrencyInput(form.finalPrice) ?? 0);
  const metadata =
    finalPrice > 0
      ? {
          finalPrice,
          manualFinalPrice: true,
        }
      : undefined;

  return {
    tenantId,
    userId,
    contactId: form.contactId,
    title: String(form.title ?? ''),
    description: String(form.description ?? '').trim() || undefined,
    benefits: String(form.benefits ?? '').trim() || undefined,
    validUntil: String(form.validUntil ?? '').trim() || undefined,
    metadata,
    items: buildProposalItems(form.items),
  };
}

function downloadFile(url: string, fileName: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const fallbackDownload = (targetUrl: string) => {
    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  void fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF (${response.status})`);
      }

      return response.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      fallbackDownload(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    })
    .catch(() => {
      fallbackDownload(url);
    });
}

function getProposalPdfFileName(proposal: ProposalRecord) {
  const safeTitle = proposal.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return `proposta-${safeTitle || proposal.id}.pdf`;
}

export function useProposalsPageViewModel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenant = useAuthStore((state) => state.tenant);
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const [search, setSearchState] = useState('');
  const [statusFilter, setStatusFilterState] = useState<ProposalStatusFilter>('ALL');
  const [selectedProposalId, setSelectedProposalIdState] = useState<string | null>(null);
  const [editorOpen, setEditorOpenState] = useState(false);
  const [editorMode, setEditorModeState] = useState<'create' | 'edit'>('create');
  const [editorForm, setEditorFormState] = useState<ProposalFormState>(createProposalFormState());
  const [contactSearch, setContactSearchState] = useState('');
  const [scheduleTarget, setScheduleTargetState] = useState<ProposalRecord | null>(null);
  const [scheduleAt, setScheduleAtState] = useState(getDefaultScheduleValue());
  const [deleteTarget, setDeleteTargetState] = useState<ProposalRecord | null>(null);

  const proposalsQuery = useQuery({
    queryKey: ['proposals', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => proposalsService.listProposals(tenant!.id),
    staleTime: 30_000,
  });

  const contactsQuery = useQuery({
    queryKey: ['proposal-contacts', tenant?.id, activeBranchId],
    enabled: Boolean(tenant?.id),
    queryFn: () =>
      contactsService.listContacts(tenant!.id, {
        page: 1,
        limit: 200,
        branchId: activeBranchId ?? undefined,
      }),
    staleTime: 30_000,
  });

  const contacts = contactsQuery.data?.data ?? [];
  const contactLabelMap = useMemo(() => buildContactLabelMap(contacts), [contacts]);
  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === editorForm.contactId) ?? null,
    [contacts, editorForm.contactId],
  );
  const filteredContacts = useMemo(() => {
    const normalized = normalizeSearchTerm(contactSearch);

    if (!normalized) {
      return contacts.slice(0, 8);
    }

    const normalizedDigits = contactSearch.replace(/\D/g, '');

    return contacts
      .filter((contact) => {
        const haystack = `${contact.name} ${contact.phone} ${contact.email ?? ''} ${contact.document ?? ''}`.toLowerCase();
        const phoneDigits = contact.phone.replace(/\D/g, '');
        const documentDigits = (contact.document ?? '').replace(/\D/g, '');

        return (
          haystack.includes(normalized) ||
          (normalizedDigits.length > 0 &&
            (phoneDigits.includes(normalizedDigits) || documentDigits.includes(normalizedDigits)))
        );
      })
      .slice(0, 8);
  }, [contactSearch, contacts]);

  const filteredProposals = useMemo(() => {
    const searchTerm = normalizeText(search);
    return (proposalsQuery.data ?? [])
      .filter((proposal) => statusFilter === 'ALL' || proposal.status === statusFilter)
      .filter((proposal) =>
        proposalMatchesSearch(proposal, searchTerm, contactLabelMap[proposal.contactId]),
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [contactLabelMap, proposalsQuery.data, search, statusFilter]);

  useEffect(() => {
    if (!selectedProposalId && filteredProposals.length > 0) {
      setSelectedProposalIdState(filteredProposals[0].id);
    }
  }, [filteredProposals, selectedProposalId]);

  const selectedProposal =
    (selectedProposalId
      ? (proposalsQuery.data ?? []).find((proposal) => proposal.id === selectedProposalId)
      : null) ?? filteredProposals[0] ?? null;

  const totalValue = useMemo(
    () => filteredProposals.reduce((sum, proposal) => sum + Number(proposal.totalAmount ?? 0), 0),
    [filteredProposals],
  );

  const summary = useMemo(() => {
    const byStatus = (status: ProposalStatus) =>
      filteredProposals.filter((proposal) => proposal.status === status).length;

    return {
      total: filteredProposals.length,
      draft: byStatus('DRAFT'),
      scheduled: byStatus('SCHEDULED'),
      sent: byStatus('SENT'),
      accepted: byStatus('ACCEPTED'),
      totalValue,
    };
  }, [filteredProposals, totalValue]);

  const invalidateProposals = async () => {
    await queryClient.invalidateQueries({ queryKey: ['proposals', tenant?.id] });
  };

  const openCreateEditor = () => {
    setEditorModeState('create');
    setEditorFormState(createProposalFormState());
    setContactSearchState('');
    setEditorOpenState(true);
  };

  const openEditEditor = (proposal: ProposalRecord) => {
    const metadataFinalPrice = parseMetadataFinalPrice(proposal.metadata);
    setEditorModeState('edit');
    setSelectedProposalIdState(proposal.id);
    setContactSearchState(contactLabelMap[proposal.contactId] ?? '');
    setEditorFormState({
      contactId: proposal.contactId,
      title: proposal.title,
      description: proposal.description ?? '',
      benefits: proposal.benefits ?? '',
      validUntil: toDateInput(proposal.validUntil),
      finalPrice: metadataFinalPrice ? formatCurrencyInput(String(metadataFinalPrice * 100)) : '',
      items: proposal.items.length
        ? proposal.items.map((item) => ({
            id:
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: item.name,
            quantity: String(item.quantity ?? 1),
            unitPrice: formatCurrencyInput(String((item.unitPrice ?? 0) * 100)),
            description: item.description ?? '',
          }))
        : [createProposalItemDraft()],
    });
    setEditorOpenState(true);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!tenant?.id || !user?.id) {
        throw new Error('Sessão inválida para criar proposta.');
      }

      return proposalsService.createProposal(
        buildProposalPayload(tenant.id, user.id, editorForm),
      );
    },
    onSuccess: async (result) => {
      await invalidateProposals();
      setEditorOpenState(false);
      setSelectedProposalIdState(result.id);
      toast({
        title: 'Proposta criada',
        description: 'O PDF foi gerado automaticamente e a proposta já está pronta para envio.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar proposta',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível criar a proposta agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedProposal) {
        throw new Error('Nenhuma proposta selecionada.');
      }

      const tenantId = tenant?.id ?? selectedProposal.tenantId;
      const userId = user?.id ?? selectedProposal.userId;

      if (!tenantId || !userId) {
        throw new Error('Sessão inválida para atualizar proposta.');
      }

      return proposalsService.updateProposal(
        selectedProposal.id,
        buildProposalPayload(tenantId, userId, editorForm),
      );
    },
    onSuccess: async () => {
      await invalidateProposals();
      setEditorOpenState(false);
      toast({
        title: 'Proposta atualizada',
        description: 'As alterações foram salvas com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar proposta',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível salvar as alterações agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const pdfMutation = useMutation({
    mutationFn: (proposal: ProposalRecord) => proposalsService.generateProposalPdf(proposal.id),
    onSuccess: async (result, proposal) => {
      await invalidateProposals();
      const pdfUrl = result.pdfUrl ?? proposal.pdfUrl ?? null;

      if (pdfUrl) {
        downloadFile(pdfUrl, getProposalPdfFileName(proposal));
      }

      toast({
        title: 'PDF gerado',
        description: pdfUrl
          ? 'O PDF foi gerado e o download foi iniciado.'
          : 'A proposta foi atualizada com o arquivo PDF mais recente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao gerar PDF',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível gerar o PDF agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (proposal: ProposalRecord) => proposalsService.sendProposalToConversation(proposal.id),
    onSuccess: async (result, proposal) => {
      await Promise.all([
        invalidateProposals(),
        queryClient.invalidateQueries({ queryKey: ['conversations', tenant?.id], exact: false }),
      ]);

      toast({
        title: 'Proposta enviada na conversa',
        description: 'A mensagem foi disparada automaticamente para o contato associado.',
      });

      navigate(`/app/conversations/${result.conversationId}`);
    },
    onError: (error) => {
      toast({
        title: 'Falha ao enviar proposta',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível enviar a proposta agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  function openPublicProposal(proposal: ProposalRecord) {
    const publicPath = getProposalPublicPath(proposal);

    if (!publicPath) {
      toast({
        title: 'Contrato ainda indisponivel',
        description: 'Envie a proposta ou gere o acesso publico antes de abrir esta pagina.',
        variant: 'destructive',
      });
      return;
    }

    navigate(publicPath);
  }

  const scheduleMutation = useMutation({
    mutationFn: () => {
      if (!scheduleTarget) {
        throw new Error('Nenhuma proposta selecionada para agendamento.');
      }

      return proposalsService.scheduleProposalDelivery(scheduleTarget.id, scheduleAt);
    },
    onSuccess: async () => {
      await invalidateProposals();
      setScheduleTargetState(null);
      toast({
        title: 'Envio agendado',
        description: 'A fila vai disparar a proposta no horário definido.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao agendar envio',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível agendar a entrega agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!deleteTarget) {
        throw new Error('Nenhuma proposta selecionada para exclusão.');
      }

      return proposalsService.deleteProposal(deleteTarget.id);
    },
    onSuccess: async () => {
      const deletedId = deleteTarget?.id ?? null;
      await invalidateProposals();
      setDeleteTargetState(null);
      if (selectedProposalId === deletedId) {
        setSelectedProposalIdState(
          filteredProposals.find((proposal) => proposal.id !== deletedId)?.id ?? null,
        );
      }
      toast({
        title: 'Proposta excluida',
        description: 'A proposta foi removida da lista.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao excluir proposta',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível excluir a proposta agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  function setEditorField<K extends keyof ProposalFormState>(field: K, value: ProposalFormState[K]) {
    setEditorFormState((current) => ({ ...current, [field]: value }));
  }

  function updateEditorItem(itemId: string, field: keyof ProposalItemDraft, value: string) {
    setEditorFormState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]:
                field === 'unitPrice'
                  ? formatCurrencyInput(value)
                  : value,
            }
          : item,
      ),
    }));
  }

  function addEditorItem() {
    setEditorFormState((current) => ({
      ...current,
      items: [...current.items, createProposalItemDraft()],
    }));
  }

  function removeEditorItem(itemId: string) {
    setEditorFormState((current) => {
      if (current.items.length === 1) {
        return current;
      }

      return {
        ...current,
        items: current.items.filter((item) => item.id !== itemId),
      };
    });
  }

  function submitEditor() {
    if (!tenant?.id || !user?.id) {
      toast({
        title: 'Sessão inválida',
        description: 'Entre novamente para criar ou editar propostas.',
        variant: 'destructive',
      });
      return;
    }

    if (!editorForm.contactId) {
      toast({
        title: 'Escolha um contato',
        description: 'A proposta precisa estar associada a um contato.',
        variant: 'destructive',
      });
      return;
    }

    if (!editorForm.title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe o título da proposta para continuar.',
        variant: 'destructive',
      });
      return;
    }

    const validItems = editorForm.items.filter(
      (item) => item.name.trim() && Number(item.quantity) > 0 && Number(parseCurrencyInput(item.unitPrice) ?? 0) > 0,
    );

    if (!validItems.length) {
      toast({
        title: 'Adicione pelo menos um item',
        description: 'A proposta precisa ter ao menos um item com quantidade e valor válidos.',
        variant: 'destructive',
      });
      return;
    }

    if (editorMode === 'create') {
      createMutation.mutate();
      return;
    }

    updateMutation.mutate();
  }

  function openScheduleDialog(proposal: ProposalRecord) {
    setScheduleTargetState(proposal);
    setScheduleAtState(toLocalDatetimeInput(proposal.scheduledAt ?? getDefaultScheduleValue()));
  }

  function selectContact(contact: Contact) {
    setEditorFormState((current) => ({
      ...current,
      contactId: contact.id,
    }));
    setContactSearchState(contact.name);
  }

  function clearSelectedContact() {
    setEditorFormState((current) => ({
      ...current,
      contactId: '',
    }));
    setContactSearchState('');
  }

  return {
    tenant,
    user,
    search,
    setSearch(value: string) {
      setSearchState(value);
    },
    statusFilter,
    setStatusFilter(value: ProposalStatusFilter) {
      setStatusFilterState(value);
    },
    statusOptions: STATUS_OPTIONS,
    proposalsQuery,
    filteredProposals,
    selectedProposal,
    selectedProposalId,
    setSelectedProposalId: setSelectedProposalIdState,
    selectProposal(proposalId: string) {
      setSelectedProposalIdState(proposalId);
    },
    summary,
    contactLabelMap,
    contacts,
    contactSearch,
    setContactSearch(value: string) {
      setContactSearchState(value);
    },
    filteredContacts,
    selectedContact,
    editorOpen,
    editorMode,
    openCreateEditor,
    openEditEditor,
    closeEditor() {
      setEditorOpenState(false);
      setEditorFormState(createProposalFormState());
      setEditorModeState('create');
      setContactSearchState('');
    },
    editorForm,
    setEditorField,
    updateEditorItem,
    addEditorItem,
    removeEditorItem,
    submitEditor,
    selectContact,
    clearSelectedContact,
    createMutation,
    updateMutation,
    pdfMutation,
    scheduleTarget,
    setScheduleTarget: setScheduleTargetState,
    scheduleAt,
    setScheduleAt: setScheduleAtState,
    openScheduleDialog,
    scheduleMutation,
    deleteTarget,
    setDeleteTarget: setDeleteTargetState,
    deleteMutation,
    scheduleProposal(proposal: ProposalRecord) {
      openScheduleDialog(proposal);
    },
    requestDelete(proposal: ProposalRecord) {
      setDeleteTargetState(proposal);
    },
    generatePdf(proposal: ProposalRecord) {
      if (proposal.pdfUrl) {
        downloadFile(proposal.pdfUrl, getProposalPdfFileName(proposal));
        return;
      }

      pdfMutation.mutate(proposal);
    },
    sendProposal(proposal: ProposalRecord) {
      sendMutation.mutate(proposal);
    },
    openPublicProposal,
    confirmSchedule() {
      scheduleMutation.mutate();
    },
    confirmDelete() {
      deleteMutation.mutate();
    },
    resetFilters() {
      setSearchState('');
      setStatusFilterState('ALL');
    },
    hasFilters: Boolean(search || statusFilter !== 'ALL'),
    formatCurrency,
  };
}

export type ProposalsPageViewModel = ReturnType<typeof useProposalsPageViewModel>;
