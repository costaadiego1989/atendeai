import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { contactsService } from '@/modules/contacts/services/contacts-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { formatDocument, formatPhone } from '@/shared/lib/masks';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import type {
  ContactAsyncJob,
  ContactImportResult,
  ContactStage,
  Conversation,
  ConversationStatus,
} from '@/shared/types';

const STAGE_FILTER_OPTIONS: Array<{ value: ContactStage | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Todos os estágios' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'OPPORTUNITY', label: 'Oportunidade' },
  { value: 'CUSTOMER', label: 'Cliente' },
  { value: 'INACTIVE', label: 'Inativo' },
];

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isActiveJob(job?: ContactAsyncJob | null) {
  return job?.status === 'QUEUED' || job?.status === 'PROCESSING';
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

async function executeBulkAction<T>(
  items: T[],
  executor: (item: T) => Promise<unknown>,
) {
  const results = await Promise.allSettled(items.map((item) => executor(item)));
  const succeeded = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - succeeded;

  return {
    total: results.length,
    succeeded,
    failed,
  };
}

function upsertConversationQueryCache(
  queryClient: ReturnType<typeof useQueryClient>,
  tenantId: string | undefined,
  conversation: Conversation,
  status: ConversationStatus,
) {
  if (!tenantId) {
    return;
  }

  const targets: Array<ConversationStatus | 'ALL'> = ['ALL'];

  if (status === 'ACTIVE' || status === 'PENDING_HUMAN' || status === 'ARCHIVED') {
    targets.push(status);
  }

  for (const target of targets) {
    queryClient.setQueryData<
      | {
        data: Conversation[];
        meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
      }
      | undefined
    >(['conversations', tenantId, target], (current) => {
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

export function useContactsListViewModel() {
  const PAGE_SIZE = 20;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant, activeBranchId } = useAuthStore();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<ContactStage | 'ALL'>('ALL');
  const [periodFilter, setPeriodFilterState] = useState<'today' | '7d' | '30d'>('30d');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    document: '',
    email: '',
    tags: '',
    notes: '',
  });
  const [importForm, setImportForm] = useState({
    rawText: '',
    defaultStage: 'LEAD' as ContactStage,
    defaultTags: '',
  });
  const [reportFilters, setReportFilters] = useState({
    tags: '',
    stages: [] as ContactStage[],
    timelineTypes: [] as Array<'MESSAGING' | 'RECOVERY' | 'PAYMENT' | 'SCHEDULING'>,
    channels: [] as Array<'WHATSAPP' | 'INSTAGRAM' | 'CRM'>,
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    dateTo: new Date().toISOString().slice(0, 10),
  });
  const [lastImportResult, setLastImportResult] = useState<ContactImportResult | null>(null);
  const [openingConversationId, setOpeningConversationId] = useState<string | null>(null);
  const [currentImportJobId, setCurrentImportJobId] = useState<string | null>(null);
  const [currentExportJobId, setCurrentExportJobId] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const handledJobsRef = useRef<Record<string, string>>({});

  const contactsQuery = useQuery({
    queryKey: ['contacts', tenant?.id, activeBranchId],
    queryFn: () => contactsService.listContacts(tenant!.id, { branchId: activeBranchId }),
    enabled: Boolean(tenant?.id),
  });

  const jobsQuery = useQuery({
    queryKey: ['contact-async-jobs', tenant?.id],
    queryFn: () => contactsService.listAsyncJobs(tenant!.id),
    enabled: Boolean(tenant?.id),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const jobs = asArray(query.state.data as ContactAsyncJob[] | undefined);
      return jobs.some((job) => isActiveJob(job)) ? 3000 : false;
    },
  });

  const scopedJobs = useMemo(() => {
    const branchScope = activeBranchId ?? null;
    return asArray(jobsQuery.data).filter((job) => (job.branchId ?? null) === branchScope);
  }, [activeBranchId, jobsQuery.data]);

  const latestImportJob = useMemo(
    () => scopedJobs.find((job) => job.type === 'IMPORT_CONTACTS') ?? null,
    [scopedJobs],
  );
  const latestReportJob = useMemo(
    () => scopedJobs.find((job) => job.type === 'EXPORT_CONTACTS_CSV') ?? null,
    [scopedJobs],
  );
  const visibleImportJob = useMemo(
    () => scopedJobs.find((job) => job.id === currentImportJobId) ?? null,
    [currentImportJobId, scopedJobs],
  );
  const visibleReportJob = useMemo(
    () => scopedJobs.find((job) => job.id === currentExportJobId) ?? null,
    [currentExportJobId, scopedJobs],
  );
  const activeJobsCount = useMemo(
    () => scopedJobs.filter((job) => isActiveJob(job)).length,
    [scopedJobs],
  );
  const activeJobItems = useMemo<AsyncOperationItem[]>(
    () =>
      scopedJobs
        .filter((job) => isActiveJob(job))
        .map((job) => ({
          id: job.id,
          title:
            job.type === 'IMPORT_CONTACTS'
              ? 'Importação de contatos'
              : 'Exportação de contatos',
          description:
            job.type === 'IMPORT_CONTACTS'
              ? 'A lista esta sendo validada e aplicada no CRM em lotes.'
              : 'O CSV esta sendo consolidado com os filtros atuais antes do download.',
          status: job.status,
          progress: job.progress,
          processedItems: job.processedItems,
          totalItems: job.totalItems,
        })),
    [scopedJobs],
  );

  useEffect(() => {
    const importJob =
      scopedJobs.find((job) => job.id === currentImportJobId) ??
      (latestImportJob?.id === currentImportJobId ? latestImportJob : null);

    if (importJob && handledJobsRef.current[importJob.id] !== importJob.status) {
      if (importJob.status === 'COMPLETED') {
        handledJobsRef.current[importJob.id] = importJob.status;
        setCurrentImportJobId(null);
        setLastImportResult({
          totalRows: Number(importJob.resultSummary?.totalRows ?? 0),
          processed: Number(importJob.resultSummary?.processed ?? 0),
          created: Number(importJob.resultSummary?.created ?? 0),
          updated: Number(importJob.resultSummary?.updated ?? 0),
          skipped: Number(importJob.resultSummary?.skipped ?? 0),
          failed: Number(importJob.resultSummary?.failed ?? 0),
          items: Array.isArray(importJob.resultSummary?.previewItems)
            ? importJob.resultSummary.previewItems
            : [],
        });
        void queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
        toast({
          title: 'Importação concluída',
          description: `${Number(importJob.resultSummary?.created ?? 0)} criados e ${Number(
            importJob.resultSummary?.updated ?? 0,
          )} atualizados.`,
        });
      }

      if (importJob.status === 'FAILED') {
        handledJobsRef.current[importJob.id] = importJob.status;
        setCurrentImportJobId(null);
        toast({
          title: 'Falha ao importar contatos',
          description: importJob.errorMessage ?? 'Não foi possível concluir a importação.',
          variant: 'destructive',
        });
      }
    }

    const exportJob =
      scopedJobs.find((job) => job.id === currentExportJobId) ??
      (latestReportJob?.id === currentExportJobId ? latestReportJob : null);

    if (exportJob && handledJobsRef.current[exportJob.id] !== exportJob.status) {
      if (exportJob.status === 'COMPLETED') {
        handledJobsRef.current[exportJob.id] = exportJob.status;
        setCurrentExportJobId(null);
        void contactsService
          .downloadAsyncJobFile(tenant!.id, exportJob.id, exportJob.fileName ?? undefined)
          .then(() => {
            toast({
              title: 'CSV exportado',
              description:
                Number(exportJob.resultSummary?.totalContacts ?? 0) > 0
                  ? `${Number(exportJob.resultSummary?.totalContacts ?? 0)} contatos foram incluídos no arquivo.`
                  : 'Baixamos um CSV vazio para os filtros escolhidos.',
            });
          })
          .catch((error) => {
            toast({
              title: 'CSV pronto, mas falhou o download',
              description: getFriendlyErrorMessage(error, {
                fallbackMessage: 'Tente gerar novamente ou atualizar a página.',
              }),
              variant: 'destructive',
            });
          });
      }

      if (exportJob.status === 'FAILED') {
        handledJobsRef.current[exportJob.id] = exportJob.status;
        setCurrentExportJobId(null);
        toast({
          title: 'Falha ao exportar CSV',
          description: exportJob.errorMessage ?? 'Não foi possível gerar o arquivo.',
          variant: 'destructive',
        });
      }
    }
  }, [
    currentExportJobId,
    currentImportJobId,
    latestImportJob,
    latestReportJob,
    queryClient,
    scopedJobs,
    tenant,
  ]);

  const filteredContacts = useMemo(() => {
    const base = asArray(contactsQuery.data?.data);
    const term = search.trim().toLowerCase();

    return base.filter((contact) => {
      const matchesStage = stageFilter === 'ALL' || contact.stage === stageFilter;
      const matchesSearch =
        !term ||
        contact.name.toLowerCase().includes(term) ||
        contact.phone.toLowerCase().includes(term) ||
        (contact.email || '').toLowerCase().includes(term) ||
        (contact.tags ?? []).some((tag) => tag.toLowerCase().includes(term));

      const isOwner = (contact.tags ?? []).includes('owner');
      return matchesStage && matchesSearch && !isOwner;
    });
  }, [contactsQuery.data?.data, search, stageFilter]);
  const allContacts = asArray(contactsQuery.data?.data);
  const selectedContacts = useMemo(
    () => allContacts.filter((contact) => selectedContactIds.includes(contact.id)),
    [allContacts, selectedContactIds],
  );

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredContacts.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredContacts]);

  const stats = useMemo(() => {
    const contacts = asArray(contactsQuery.data?.data);

    return {
      total: contacts.length,
      pipeline: contacts.filter((contact) =>
        ['LEAD', 'PROSPECT', 'OPPORTUNITY'].includes(contact.stage),
      ).length,
      customers: contacts.filter((contact) => contact.stage === 'CUSTOMER').length,
      inactive: contacts.filter((contact) => contact.stage === 'INACTIVE').length,
    };
  }, [contactsQuery.data?.data]);

  const importPreviewCount = useMemo(
    () =>
      importForm.rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean).length,
    [importForm.rawText],
  );

  const createContactMutation = useMutation({
    mutationFn: () => {
      if (!tenant?.id) {
        throw new Error('A sessão da empresa ainda não carregou.');
      }

      return contactsService.createContact(
        tenant.id,
        {
          name: createForm.name.trim(),
          phone: normalizePhone(createForm.phone),
          document: createForm.document.trim(),
          email: createForm.email.trim() || undefined,
          tags: parseTags(createForm.tags),
          notes: createForm.notes.trim() || undefined,
        },
        activeBranchId,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
      setCreateOpen(false);
      setCreateForm({
        name: '',
        phone: '',
        document: '',
        email: '',
        tags: '',
        notes: '',
      });
      toast({
        title: 'Contato cadastrado',
        description: 'O contato entrou no CRM e já pode receber atendimento.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao cadastrar contato',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível cadastrar este contato agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const importContactsMutation = useMutation({
    mutationFn: () =>
      contactsService.startImportJob(
        tenant!.id,
        {
          rawText: importForm.rawText,
          defaultStage: importForm.defaultStage,
          defaultTags: parseTags(importForm.defaultTags),
        },
        activeBranchId,
      ),
    onSuccess: async (job) => {
      setCurrentImportJobId(job.id);
      setLastImportResult(null);
      setImportOpen(false);
      setImportForm({
        rawText: '',
        defaultStage: 'LEAD',
        defaultTags: '',
      });
      await queryClient.invalidateQueries({ queryKey: ['contact-async-jobs', tenant?.id] });
      toast({
        title: 'Importação enfileirada',
        description: 'Vamos processar a lista em segundo plano e atualizar o CRM quando terminar.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar importação',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível enfileirar esta lista agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: (overrideFilters?: typeof reportFilters) => {
      const filters = overrideFilters ?? reportFilters;
      return contactsService.startReportJob(tenant!.id, {
        branchId: activeBranchId,
        tags: parseTags(filters.tags),
        stages: filters.stages,
        timelineTypes: filters.timelineTypes,
        channels: filters.channels,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
    },
    onSuccess: async (job) => {
      setCurrentExportJobId(job.id);
      setReportsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['contact-async-jobs', tenant?.id] });
      toast({
        title: 'CSV enfileirado',
        description: 'Assim que o arquivo ficar pronto, o download será iniciado automaticamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar exportação',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível enfileirar o CSV agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const openConversationMutation = useMutation({
    mutationFn: (contactId: string) => {
      setOpeningConversationId(contactId);
      return contactsService.openConversation(tenant!.id, contactId);
    },
    onSuccess: async (result, contactId) => {
      const contact = (contactsQuery.data?.data ?? []).find((item) => item.id === contactId);

      if (contact) {
        upsertConversationQueryCache(
          queryClient,
          tenant?.id,
          {
            id: result.conversationId,
            contactId: result.contactId,
            contactName: contact.name,
            contactPhone: contact.phone,
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
        description: 'O atendimento foi encaminhado para a inbox para continuar o relacionamento.',
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
    onSettled: () => {
      setOpeningConversationId(null);
    },
  });

  const bulkStageMutation = useMutation({
    mutationFn: async (stage: ContactStage) => {
      const contactsToUpdate = selectedContacts.filter((contact) => contact.stage !== stage);

      if (!contactsToUpdate.length) {
        return {
          total: 0,
          succeeded: 0,
          failed: 0,
          skipped: selectedContacts.length,
        };
      }

      const result = await executeBulkAction(contactsToUpdate, (contact) =>
        contactsService.updateContactStage(tenant!.id, contact.id, stage),
      );

      return {
        ...result,
        skipped: selectedContacts.length - contactsToUpdate.length,
      };
    },
    onSuccess: async (result, stage) => {
      await queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
      setSelectedContactIds([]);

      toast({
        title: result.failed > 0 ? 'ação em lote concluida com ressalvas' : 'Estagio atualizado',
        description:
          result.total === 0
            ? 'Os contatos selecionados ja estavam nesse estagio.'
            : `${result.succeeded} contato(s) movidos para ${STAGE_FILTER_OPTIONS.find((option) => option.value === stage)?.label ?? stage}.${result.failed > 0 ? ` ${result.failed} falharam.` : ''}${result.skipped > 0 ? ` ${result.skipped} ja estavam no estagio.` : ''}`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar estágio em lote',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível atualizar os contatos selecionados agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const bulkTagsMutation = useMutation({
    mutationFn: async ({
      tag,
      mode,
    }: {
      tag: string;
      mode: 'add' | 'remove';
    }) => {
      const normalizedTag = tag.trim();
      const contactsToUpdate = selectedContacts.filter((contact) => {
        const currentTags = contact.tags ?? [];
        const hasTag = currentTags.some(
          (currentTag) => currentTag.toLowerCase() === normalizedTag.toLowerCase(),
        );

        return mode === 'add' ? !hasTag : hasTag;
      });

      if (!contactsToUpdate.length) {
        return {
          total: 0,
          succeeded: 0,
          failed: 0,
          skipped: selectedContacts.length,
        };
      }

      const result = await executeBulkAction(contactsToUpdate, (contact) => {
        const currentTags = contact.tags ?? [];
        const nextTags =
          mode === 'add'
            ? [...currentTags, normalizedTag]
            : currentTags.filter(
              (currentTag) => currentTag.toLowerCase() !== normalizedTag.toLowerCase(),
            );

        return contactsService.updateContact(tenant!.id, contact.id, {
          tags: nextTags,
        });
      });

      return {
        ...result,
        skipped: selectedContacts.length - contactsToUpdate.length,
      };
    },
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
      setSelectedContactIds([]);

      toast({
        title: result.failed > 0 ? 'Tags ajustadas com ressalvas' : 'Tags atualizadas',
        description:
          result.total === 0
            ? variables.mode === 'add'
              ? 'Todos os contatos selecionados ja tinham essa tag.'
              : 'Nenhum dos contatos selecionados tinha essa tag.'
            : `${result.succeeded} contato(s) ${variables.mode === 'add' ? 'atualizados com' : 'sem'} a tag ${variables.tag}.${result.failed > 0 ? ` ${result.failed} falharam.` : ''}${result.skipped > 0 ? ` ${result.skipped} foram ignorados.` : ''}`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar tags em lote',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível ajustar as tags agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () =>
      executeBulkAction(selectedContacts, (contact) =>
        contactsService.deleteContact(tenant!.id, contact.id),
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
      setSelectedContactIds([]);

      toast({
        title: result.failed > 0 ? 'Exclusao em lote concluida com ressalvas' : 'Contatos removidos',
        description: `${result.succeeded} contato(s) removidos do CRM.${result.failed > 0 ? ` ${result.failed} falharam.` : ''}`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao excluir contatos',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível excluir os contatos selecionados agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  return {
    tenant,
    search,
    setSearch,
    stageFilter,
    setStageFilter,
    stageFilterOptions: STAGE_FILTER_OPTIONS,
    periodFilter,
    periodOptions: [
      { value: 'today' as const, label: 'Hoje' },
      { value: '7d' as const, label: '7 dias' },
      { value: '30d' as const, label: '30 dias' },
    ],
    setPeriodFilter(value: 'today' | '7d' | '30d') {
      const now = new Date();
      const start = new Date(now);
      if (value === 'today') start.setHours(0, 0, 0, 0);
      if (value === '7d') start.setDate(start.getDate() - 7);
      if (value === '30d') start.setDate(start.getDate() - 30);
      setPeriodFilterState(value);
      setReportFilters((current) => ({
        ...current,
        dateFrom: start.toISOString().slice(0, 10),
        dateTo: now.toISOString().slice(0, 10),
      }));
    },
    createOpen,
    setCreateOpen,
    importOpen,
    setImportOpen(open: boolean) {
      setImportOpen(open);

      if (!open && !isActiveJob(visibleImportJob)) {
        setLastImportResult(null);
      }
    },
    createForm,
    importForm,
    contacts: paginatedContacts,
    stats,
    page: currentPage,
    setPage,
    pageSize: PAGE_SIZE,
    totalPages,
    totalFiltered: filteredContacts.length,
    contactsQuery,
    jobsQuery,
    createContactMutation,
    importContactsMutation,
    reportMutation,
    lastImportResult,
    importPreviewCount,
    openConversationMutation,
    openingConversationId,
    reportsOpen,
    setReportsOpen,
    reportFilters,
    latestImportJob: visibleImportJob,
    latestReportJob: visibleReportJob,
    activeJobsCount,
    activeJobItems,
    updateCreateForm<K extends keyof typeof createForm>(
      field: K,
      value: (typeof createForm)[K],
    ) {
      setCreateForm((current) => ({
        ...current,
        [field]:
          field === 'phone'
            ? formatPhone(String(value))
            : field === 'document'
              ? formatDocument(String(value))
              : value,
      }));
    },
    updateImportForm<K extends keyof typeof importForm>(
      field: K,
      value: (typeof importForm)[K],
    ) {
      setImportForm((current) => ({
        ...current,
        [field]: value,
      }));
    },
    submitCreate() {
      if (!tenant?.id) {
        toast({
          title: 'Sessão ainda não carregada',
          description: 'Aguarde a empresa terminar de carregar e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      if (!createForm.name.trim() || !createForm.phone.trim() || !createForm.document.trim()) {
        toast({
          title: 'Preencha os campos obrigatórios',
          description: 'Informe nome, telefone e CPF/CNPJ para criar o contato.',
          variant: 'destructive',
        });
        return;
      }

      createContactMutation.mutate();
    },
    submitImport() {
      if (!importForm.rawText.trim()) {
        toast({
          title: 'Cole uma lista para importar',
          description:
            'Use uma linha por contato. Exemplo: Nome; Telefone; Documento; Email; Tags; Observações.',
          variant: 'destructive',
        });
        return;
      }

      if (isActiveJob(latestImportJob)) {
        toast({
          title: 'Importação já em andamento',
          description: 'Espere a fila atual terminar antes de iniciar outra no mesmo escopo.',
          variant: 'destructive',
        });
        return;
      }

      importContactsMutation.mutate();
    },
    updateSearch(value: string) {
      setSearch(value);
      setPage(1);
    },
    updateStageFilter(value: ContactStage | 'ALL') {
      setStageFilter(value);
      setPage(1);
    },
    updateReportFilter<K extends keyof typeof reportFilters>(
      field: K,
      value: (typeof reportFilters)[K],
    ) {
      setReportFilters((current) => ({
        ...current,
        [field]: value,
      }));
    },
    downloadReport() {
      if (isActiveJob(latestReportJob)) {
        toast({
          title: 'CSV já em andamento',
          description: 'Espere o arquivo atual terminar antes de gerar outro no mesmo escopo.',
          variant: 'destructive',
        });
        return;
      }

      reportMutation.mutate();
    },
    downloadCurrentReport() {
      if (isActiveJob(latestReportJob)) {
        toast({
          title: 'Download de relatório em andamento',
          description: 'Espere o relatório atual terminar antes de gerar outro no mesmo escopo.',
          variant: 'destructive',
        });
        return;
      }

      reportMutation.mutate({
        ...reportFilters,
        stages: stageFilter === 'ALL' ? [] : [stageFilter],
      });
    },
    openConversation(contactId: string) {
      openConversationMutation.mutate(contactId);
    },
    selectedContactIds,
    setSelectedContactIds,
    selectedContactsCount: selectedContacts.length,
    bulkActionsBusy:
      bulkStageMutation.isPending ||
      bulkTagsMutation.isPending ||
      bulkDeleteMutation.isPending,
    toggleContactSelection(contactId: string) {
      setSelectedContactIds((prev) =>
        prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId],
      );
    },
    selectAllContacts(contactIds: string[]) {
      setSelectedContactIds(contactIds);
    },
    clearSelection() {
      setSelectedContactIds([]);
    },
    bulkUpdateStage(stage: ContactStage) {
      if (!selectedContacts.length) {
        return;
      }

      bulkStageMutation.mutate(stage);
    },
    bulkAddTag(tag: string) {
      if (!selectedContacts.length) {
        return;
      }

      bulkTagsMutation.mutate({ tag, mode: 'add' });
    },
    bulkRemoveTag(tag: string) {
      if (!selectedContacts.length) {
        return;
      }

      bulkTagsMutation.mutate({ tag, mode: 'remove' });
    },
    bulkDeleteSelected() {
      if (!selectedContacts.length) {
        return;
      }

      bulkDeleteMutation.mutate();
    },
  };
}
