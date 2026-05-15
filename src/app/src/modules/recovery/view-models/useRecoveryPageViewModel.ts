import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { contactsService } from '@/modules/contacts/services/contacts-service';
import {
  recoveryService,
  type CreateRecoveryCaseInput,
  type RecoveryBillingType,
  type RecoveryCaseDetail,
  type RecoveryRecurringCharge,
} from '@/modules/recovery/services/RecoveryService';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import type {
  Contact,
  RecoveryAsyncJob,
  RecoverySource,
  RecoveryStatus,
} from '@/shared/types';
import {
  buildRecoverySummary,
  buildRecoveryPeriodRange,
  DEFAULT_CREATE_FORM,
  DEFAULT_GUIDANCE_FORM,
  DEFAULT_OUTREACH_FORM,
  DEFAULT_PAYMENT_LINK_FORM,
  DEFAULT_REPORT_FILTERS,
  DEFAULT_STATUS_FORM,
  isActiveRecoveryJob,
  matchesRecoverySearch,
  RECOVERY_GUIDANCE_SENT_TAG,
  RECOVERY_PAGE_SIZE,
  RECOVERY_PERIOD_OPTIONS,
  recoveryOutreachFlowExhausted,
  type RecoveryPeriodFilter,
  sortRecoveryCases,
  splitRecoveryTags,
} from './useRecoveryViewModelHelper';
import { parseCurrencyInput } from '@/shared/lib/masks';
import { formatCurrency } from '@/shared/lib/formatters';

export function useRecoveryPageViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RecoveryStatus>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | RecoverySource>('ALL');
  const [periodFilter, setPeriodFilterState] = useState<RecoveryPeriodFilter>('30d');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [paymentLinkOpen, setPaymentLinkOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [reportsOpen, setReportsOpenState] = useState(false);
  const [recurringOpen, setRecurringOpenState] = useState(false);
  const [playbooksOpen, setPlaybooksOpenState] = useState(false);
  const [sentOutreachCaseIds, setSentOutreachCaseIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(Date.now());

  const [contactSearch, setContactSearch] = useState('');
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [outreachForm, setOutreachForm] = useState(DEFAULT_OUTREACH_FORM);
  const [guidanceForm, setGuidanceForm] = useState(DEFAULT_GUIDANCE_FORM);
  const [paymentLinkForm, setPaymentLinkForm] = useState(DEFAULT_PAYMENT_LINK_FORM);
  const [statusForm, setStatusForm] = useState(DEFAULT_STATUS_FORM);
  const [reportFilters, setReportFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [recurringForm, setRecurringForm] = useState({
    intervalDays: '30',
    maxOccurrences: '6',
    firstRunAt: '',
    billingType: 'UNDEFINED' as RecoveryBillingType,
    messageTemplate: '',
  });
  const [recurringCancelReason, setRecurringCancelReason] = useState('');
  const [currentReportJobId, setCurrentReportJobId] = useState<string | null>(null);
  const handledReportJobsRef = useRef<Record<string, string>>({});

  const periodRange = useMemo(() => buildRecoveryPeriodRange(periodFilter), [periodFilter, refreshKey]);

  const casesQuery = useQuery({
    queryKey: [
      'recovery-cases',
      tenant?.id,
      activeBranchId,
      statusFilter,
      sourceFilter,
      periodFilter,
      periodRange.dateFrom,
      periodRange.dateTo,
    ],
    enabled: Boolean(tenant?.id),
    queryFn: () =>
      recoveryService.listCases(tenant!.id, {
        branchId: activeBranchId ?? undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        source: sourceFilter === 'ALL' ? undefined : sourceFilter,
        dateFrom: periodRange.dateFrom,
        dateTo: periodRange.dateTo,
      }),
  });

  const filteredCases = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return sortRecoveryCases(
      (casesQuery.data ?? []).filter((item) => matchesRecoverySearch(item, normalizedSearch)),
    );
  }, [casesQuery.data, search]);

  const selectedListCase =
    filteredCases.find((item) => item.id === selectedCaseId) ??
    (casesQuery.data ?? []).find((item) => item.id === selectedCaseId) ??
    null;

  const selectedCaseQuery = useQuery({
    queryKey: ['recovery-case-detail', tenant?.id, selectedCaseId],
    enabled: Boolean(tenant?.id && selectedCaseId),
    queryFn: () => recoveryService.getCase(tenant!.id, selectedCaseId!),
  });

  const selectedCase = selectedCaseQuery.data ?? selectedListCase ?? null;
  const timelineQuery = useQuery({
    queryKey: ['recovery-contact-timeline', tenant?.id, selectedCase?.contactId],
    enabled: Boolean(tenant?.id && selectedCase?.contactId),
    queryFn: () => contactsService.getContactTimeline(tenant!.id, selectedCase!.contactId!),
  });
  const guidanceAlreadySent = Boolean(
    selectedCase?.assignedTags?.includes(RECOVERY_GUIDANCE_SENT_TAG),
  );

  const contactsQuery = useQuery({
    queryKey: ['recovery-create-contacts', tenant?.id, activeBranchId],
    enabled: createOpen && Boolean(tenant?.id),
    queryFn: () =>
      contactsService.listContacts(tenant!.id, {
        page: 1,
        limit: 200,
        branchId: activeBranchId ?? undefined,
      }),
  });

  const jobsQuery = useQuery({
    queryKey: ['recovery-async-jobs', tenant?.id],
    queryFn: () => recoveryService.listAsyncJobs(tenant!.id),
    enabled: Boolean(tenant?.id),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const jobs = (query.state.data ?? []) as RecoveryAsyncJob[];
      return jobs.some((job) => isActiveRecoveryJob(job)) ? 3000 : false;
    },
  });

  const focusedJobQuery = useQuery({
    queryKey: ['recovery-async-job', tenant?.id, currentReportJobId],
    enabled: Boolean(tenant?.id && currentReportJobId),
    queryFn: () => recoveryService.getAsyncJob(tenant!.id, currentReportJobId!),
    refetchInterval: (query) => {
      const job = query.state.data as RecoveryAsyncJob | undefined;
      return job && isActiveRecoveryJob(job) ? 2500 : false;
    },
  });

  const playbooksQuery = useQuery({
    queryKey: ['recovery-playbooks', tenant?.id],
    queryFn: () => recoveryService.listPlaybooks(tenant!.id),
    enabled: Boolean(tenant?.id),
    staleTime: 30_000,
  });

  const outreachFlowExhausted = recoveryOutreachFlowExhausted(
    selectedCase,
    playbooksQuery.data,
  );

  const invalidatePlaybooks = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['recovery-playbooks', tenant?.id],
    });
  };

  const seedPlaybookMutation = useMutation({
    mutationFn: () => recoveryService.seedDefaultPlaybook(tenant!.id),
    onSuccess: async (result) => {
      await invalidatePlaybooks();
      await invalidateCases();
      toast({
        title: result.seeded ? 'Playbook padrão criado' : 'Playbook já existia',
        description: result.seeded
          ? 'O roteiro padrão foi criado e pode ser activado.'
          : 'Os playbooks do tenant já estavam configurados.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao preparar playbook',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Tente novamente em instantes.',
        }),
        variant: 'destructive',
      });
    },
  });

  const activatePlaybookMutation = useMutation({
    mutationFn: (playbookId: string) =>
      recoveryService.activatePlaybook(tenant!.id, playbookId),
    onSuccess: async () => {
      await invalidatePlaybooks();
      await invalidateCases();
      toast({
        title: 'Playbook activo',
        description: 'Novos casos passam a usar este roteiro quando a API estiver com playbooks habilitados.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao activar playbook',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível activar agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const recurringChargesQuery = useQuery({
    queryKey: ['recovery-recurring-charges', tenant?.id, selectedCaseId],
    enabled: recurringOpen && Boolean(tenant?.id && selectedCaseId),
    queryFn: () => recoveryService.listRecurringCharges(tenant!.id, selectedCaseId!),
    refetchOnWindowFocus: false,
  });

  const contacts = contactsQuery.data?.data ?? [];
  const filteredContacts = useMemo(() => {
    const normalizedSearch = contactSearch.trim().toLowerCase();
    const base = !normalizedSearch
      ? contacts
      : contacts.filter((contact) => {
        const haystack = `${contact.name} ${contact.phone} ${contact.email ?? ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });

    return base.slice(0, 8);
  }, [contactSearch, contacts]);

  const selectedContact: Contact | null =
    contacts.find((contact) => contact.id === createForm.contactId) ?? null;

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / RECOVERY_PAGE_SIZE));
  const pageCases = filteredCases.slice(
    (page - 1) * RECOVERY_PAGE_SIZE,
    page * RECOVERY_PAGE_SIZE,
  );
  const summary = buildRecoverySummary(filteredCases);

  function resolveRecoveryReportJobFromList(jobId: string | null) {
    return jobId ? ((jobsQuery.data ?? []).find((job) => job.id === jobId) ?? null) : null;
  }

  const recoveryActiveReportJob = useMemo(() => {
    if (!currentReportJobId) {
      return null;
    }

    if (focusedJobQuery.data?.id === currentReportJobId) {
      return focusedJobQuery.data;
    }

    return resolveRecoveryReportJobFromList(currentReportJobId);
  }, [currentReportJobId, focusedJobQuery.data, jobsQuery.data]);

  const recoveryActiveJobItems = useMemo<AsyncOperationItem[]>(
    () =>
      (jobsQuery.data ?? [])
        .filter((job) => isActiveRecoveryJob(job))
        .map((job) => ({
          id: job.id,
          title: 'Exportação de cobranças',
          description:
            'Estamos consolidando a carteira e preparando o CSV em segundo plano.',
          status: job.status,
          progress: job.progress,
          processedItems: job.processedItems,
          totalItems: job.totalItems,
        })),
    [jobsQuery.data],
  );

  useEffect(() => {
    if (
      !recoveryActiveReportJob ||
      handledReportJobsRef.current[recoveryActiveReportJob.id] === recoveryActiveReportJob.status
    ) {
      return;
    }

    if (recoveryActiveReportJob.status === 'COMPLETED') {
      handledReportJobsRef.current[recoveryActiveReportJob.id] = recoveryActiveReportJob.status;
      setCurrentReportJobId(null);

      void recoveryService
        .downloadAsyncJobFile(
          tenant!.id,
          recoveryActiveReportJob.id,
          recoveryActiveReportJob.fileName ?? undefined,
        )
        .then(() => {
          toast({
            title: 'CSV de cobranças exportado',
            description:
              Number(recoveryActiveReportJob.resultSummary?.totalCases ?? 0) > 0
                ? `${Number(recoveryActiveReportJob.resultSummary?.totalCases ?? 0)} casos foram incluidos no arquivo.`
                : 'O arquivo foi gerado sem casos para os filtros escolhidos.',
          });
        })
        .catch((error) => {
          toast({
            title: 'CSV pronto, mas falhou o download',
            description: getFriendlyErrorMessage(error, {
              fallbackMessage: 'Tente gerar novamente ou atualizar a pagina.',
            }),
            variant: 'destructive',
          });
        });
    }

    if (recoveryActiveReportJob.status === 'FAILED') {
      handledReportJobsRef.current[recoveryActiveReportJob.id] = recoveryActiveReportJob.status;
      setCurrentReportJobId(null);
      toast({
        title: 'Falha ao exportar cobranças',
        description:
          recoveryActiveReportJob.errorMessage ??
          'não foi possível gerar o CSV da carteira.',
        variant: 'destructive',
      });
    }
  }, [recoveryActiveReportJob, tenant]);

  const invalidateCases = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['recovery-cases', tenant?.id],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['recovery-case-detail', tenant?.id],
      exact: false,
    });
  };

  const invalidateRecurringCharges = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['recovery-recurring-charges', tenant?.id],
      exact: false,
    });
  };

  const mergeCaseIntoCache = (updatedCase: RecoveryCaseDetail) => {
    queryClient.setQueryData(
      ['recovery-case-detail', tenant?.id, updatedCase.id],
      updatedCase,
    );

    queryClient.setQueriesData(
      { queryKey: ['recovery-cases', tenant?.id], exact: false },
      (current: RecoveryCaseDetail[] | undefined) => {
        if (!current) {
          return current;
        }

        const existingIndex = current.findIndex((item) => item.id === updatedCase.id);

        if (existingIndex === -1) {
          return sortRecoveryCases([updatedCase, ...current]);
        }

        const next = [...current];
        next[existingIndex] = {
          ...next[existingIndex],
          ...updatedCase,
        };

        return sortRecoveryCases(next);
      },
    );
  };

  const createCaseMutation = useMutation({
    mutationFn: async () => {
      const payload: CreateRecoveryCaseInput = {
        branchId: selectedContact?.branchId ?? activeBranchId ?? undefined,
        contactId: createForm.contactId || undefined,
        debtorName: createForm.debtorName.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        debtorCompanyName: createForm.debtorCompanyName.trim() || undefined,
        debtorDocument: createForm.debtorDocument.trim() || undefined,
        chargeType: createForm.chargeType.trim() || undefined,
        chargeTitle: createForm.chargeTitle.trim() || undefined,
        chargeDescription: createForm.chargeDescription.trim() || undefined,
        referencePeriod: createForm.referencePeriod.trim() || undefined,
        relatedEntityType: createForm.relatedEntityType.trim() || undefined,
        relatedEntityId: createForm.relatedEntityId.trim() || undefined,
        relatedEntityLabel: createForm.relatedEntityLabel.trim() || undefined,
        amountDue: parseCurrencyInput(createForm.amountDue) || undefined,
        dueDate: createForm.dueDate || undefined,
        externalReference: createForm.externalReference.trim() || undefined,
        assignedTags: splitRecoveryTags(createForm.assignedTagsText),
      };

      return recoveryService.createCase(tenant!.id, payload);
    },
    onSuccess: async (result) => {
      setRefreshKey(Date.now());
      setPage(1);
      setStatusFilter('ALL');
      setSearch('');
      setContactSearch('');

      void queryClient.invalidateQueries({ queryKey: ['recovery-cases'] });
      void queryClient.invalidateQueries({ queryKey: ['recovery-case-detail'] });

      setCreateOpen(false);
      setCreateForm(DEFAULT_CREATE_FORM);
      setSelectedCaseId(result.id);
      toast({
        title: 'Caso criado',
        description: 'O caso entrou na carteira de cobrança com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar caso',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível criar o caso agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const outreachMutation = useMutation({
    mutationFn: () =>
      recoveryService.triggerOutreach(tenant!.id, selectedCaseId!, {
        ...(outreachForm.outreachMode === 'playbook'
          ? { followPlaybook: true }
          : { messageText: outreachForm.messageText.trim() || undefined }),
      }),
    onSuccess: async (result) => {
      mergeCaseIntoCache(result);
      await invalidateCases();
      if (selectedCaseId) {
        setSentOutreachCaseIds((current) =>
          current.includes(selectedCaseId) ? current : [...current, selectedCaseId],
        );
      }
      setOutreachOpen(false);
      setOutreachForm(DEFAULT_OUTREACH_FORM);
      toast({
        title: result.playbookPhaseId ? 'Fase do roteiro enviada' : 'Primeiro contato preparado',
        description: result.conversationId
          ? 'A mensagem foi enviada para a inbox do contato.'
          : 'A mensagem inicial foi preparada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao preparar o primeiro contato',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível preparar a mensagem agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const previewOutreachMutation = useMutation({
    mutationFn: (mode: 'manual' | 'ai' | 'playbook') =>
      recoveryService.triggerOutreach(tenant!.id, selectedCaseId!, {
        previewOnly: true,
        ...(mode === 'playbook'
          ? { followPlaybook: true }
          : mode === 'ai'
            ? { generateWithAI: true }
            : { messageText: outreachForm.messageText.trim() || undefined }),
      }),
    onSuccess: (result, mode) => {
      const previewText = result.outreachText ?? '';

      setOutreachForm((current) => ({
        ...current,
        messageText: previewText || current.messageText,
        previewText,
        previewGeneratedWithAI: mode === 'ai',
      }));

      if (selectedCaseId) {
        setSentOutreachCaseIds((current) => current.filter((id) => id !== selectedCaseId));
      }

      toast({
        title:
          mode === 'playbook'
            ? 'Prévia da fase do roteiro'
            : mode === 'ai'
              ? 'sugestão pronta'
              : 'Mensagem preparada',
        description:
          mode === 'playbook'
            ? 'Revise o texto gerado conforme as regras da fase antes de enviar.'
            : mode === 'ai'
              ? 'A IA gerou um primeiro contato para voce revisar antes do envio.'
              : 'Revise a mensagem antes de confirmar o envio.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao preparar primeiro contato',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível gerar a previa agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!outreachOpen) return;
    setOutreachForm(
      selectedCase?.playbookId
        ? { ...DEFAULT_OUTREACH_FORM, outreachMode: 'playbook' }
        : { ...DEFAULT_OUTREACH_FORM },
    );
  }, [outreachOpen, selectedCaseId, selectedCase?.playbookId]);

  const regenerateGuidanceMutation = useMutation({
    mutationFn: () =>
      recoveryService.regenerateGuidance(
        tenant!.id,
        selectedCaseId!,
        guidanceForm.customerMessage.trim() || undefined,
      ),
    onSuccess: async (result) => {
      mergeCaseIntoCache(result);
      await invalidateCases();
      setGuidanceOpen(false);
      setGuidanceForm(DEFAULT_GUIDANCE_FORM);
      toast({
        title: 'sugestão atualizada',
        description: 'A nova sugestão de resposta foi gerada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar sugestão',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível gerar a sugestão agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const sendGuidanceMutation = useMutation({
    mutationFn: () => recoveryService.sendGuidance(tenant!.id, selectedCaseId!),
    onSuccess: async (result) => {
      mergeCaseIntoCache(result);
      await invalidateCases();
      toast({
        title: 'sugestão enviada',
        description: 'A resposta sugerida foi enviada ao cliente no WhatsApp.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao enviar sugestão',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível enviar a sugestão agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const paymentLinkMutation = useMutation({
    mutationFn: () =>
      recoveryService.generatePaymentLink(
        tenant!.id,
        selectedCaseId!,
        paymentLinkForm.billingType,
      ),
    onSuccess: async (result) => {
      if (selectedCase) {
        mergeCaseIntoCache({
          ...selectedCase,
          paymentReference: result.paymentReference,
          lastContactedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      await invalidateCases();
      setPaymentLinkOpen(false);
      toast({
        title: 'Link enviado ao cliente',
        description: result.conversationId
          ? 'A cobrança foi gerada e enviada automaticamente no WhatsApp.'
          : 'A cobrança foi gerada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao enviar cobrança',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível gerar a cobrança agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: () =>
      recoveryService.updateCaseStatus(tenant!.id, selectedCaseId!, {
        status: statusForm.status,
        nextActionAt:
          statusForm.status === 'PROMISE_TO_PAY' && statusForm.nextActionAt
            ? new Date(statusForm.nextActionAt).toISOString()
            : undefined,
      }),
    onSuccess: async (result) => {
      mergeCaseIntoCache(result);
      await invalidateCases();
      setStatusOpen(false);
      toast({
        title: 'Status atualizado',
        description: 'O caso foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar status',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível atualizar o status agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: () =>
      recoveryService.startReportJob(tenant!.id, {
        branchId: activeBranchId ?? undefined,
        statuses: reportFilters.statuses,
        sources: reportFilters.sources,
        search: reportFilters.search.trim() || undefined,
        dateFrom: periodRange.dateFrom,
        dateTo: periodRange.dateTo,
      }),
    onSuccess: async (job) => {
      setCurrentReportJobId(job.id);
      setReportsOpenState(false);
      await queryClient.invalidateQueries({ queryKey: ['recovery-async-jobs', tenant?.id] });
      await queryClient.invalidateQueries({
        queryKey: ['recovery-async-job', tenant?.id, job.id],
      });
      toast({
        title: 'Relatorio enfileirado',
        description:
          'Vamos processar a carteira em segundo plano e iniciar o download quando o CSV ficar pronto.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar exportação',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível enfileirar o relatorio agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const syncReportSummaryMutation = useMutation({
    mutationFn: () =>
      recoveryService.generateReportSync(tenant!.id, {
        branchId: activeBranchId ?? undefined,
        statuses: reportFilters.statuses,
        sources: reportFilters.sources,
        search: reportFilters.search.trim() || undefined,
        dateFrom: periodRange.dateFrom,
        dateTo: periodRange.dateTo,
      }),
    onSuccess: (data) => {
      const s = data.summary;
      const casesCount = s.totalCases ?? 0;
      const openLabel = formatCurrency(s.totalOpenAmount) ?? '—';
      toast({
        title: 'Resumo da carteira (instantâneo)',
        description: `${casesCount} casos · valor em aberto estimado ${openLabel}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível obter o resumo',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Tente novamente ou use o fluxo de CSV em segundo plano.',
        }),
        variant: 'destructive',
      });
    },
  });

  const scheduleRecurringChargeMutation = useMutation({
    mutationFn: async () => {
      const intervalDays = Number(recurringForm.intervalDays);
      const maxOccurrences = recurringForm.maxOccurrences.trim()
        ? Number(recurringForm.maxOccurrences)
        : undefined;

      const payload = {
        billingType: recurringForm.billingType,
        intervalDays,
        maxOccurrences:
          Number.isFinite(maxOccurrences ?? NaN) && (maxOccurrences ?? 0) > 0
            ? maxOccurrences
            : undefined,
        firstRunAt: recurringForm.firstRunAt
          ? new Date(recurringForm.firstRunAt).toISOString()
          : undefined,
        messageTemplate: recurringForm.messageTemplate.trim() || undefined,
      };

      return recoveryService.scheduleRecurringCharge(tenant!.id, selectedCaseId!, payload);
    },
    onSuccess: async () => {
      await invalidateRecurringCharges();
      await invalidateCases();
      setRecurringForm({
        intervalDays: '30',
        maxOccurrences: '6',
        firstRunAt: '',
        billingType: 'UNDEFINED',
        messageTemplate: '',
      });
      toast({
        title: 'Recorrência agendada',
        description: 'A cobrança recorrente foi criada e vai disparar conforme o intervalo definido.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao agendar recorrência',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível agendar a recorrência agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const cancelRecurringChargeMutation = useMutation({
    mutationFn: (input: { recurrenceId: string; reason?: string }) =>
      recoveryService.cancelRecurringCharge(tenant!.id, input.recurrenceId, input.reason),
    onSuccess: async (updated) => {
      await invalidateRecurringCharges();
      await invalidateCases();
      toast({
        title: 'Recorrência cancelada',
        description:
          updated.status === 'CANCELLED'
            ? 'A recorrência foi cancelada e não fará novos envios.'
            : 'A recorrência foi atualizada.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao cancelar recorrência',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível cancelar a recorrência agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  return {
    tenant,
    page,
    totalPages,
    pageSize: RECOVERY_PAGE_SIZE,
    setPage,
    search,
    setSearch(value: string) {
      setPage(1);
      setSearch(value);
    },
    statusFilter,
    setStatusFilter(value: 'ALL' | RecoveryStatus) {
      setPage(1);
      setStatusFilter(value);
    },
    sourceFilter,
    setSourceFilter(value: 'ALL' | RecoverySource) {
      setPage(1);
      setSourceFilter(value);
    },
    periodFilter,
    setPeriodFilter(value: RecoveryPeriodFilter) {
      setPage(1);
      setPeriodFilterState(value);
    },
    periodOptions: RECOVERY_PERIOD_OPTIONS,
    periodRange,
    casesQuery,
    filteredCases,
    pageCases,
    summary,
    jobsQuery,
    reportsOpen,
    setReportsOpen(open: boolean) {
      setReportsOpenState(open);
    },
    reportFilters,
    setReportFilters,
    recoveryActiveReportJob,
    recoveryActiveJobItems,
    selectedCaseId,
    selectedCase,
    outreachFlowExhausted,
    guidanceAlreadySent,
    selectedCaseQuery,
    timelineQuery,
    selectCase(caseId: string) {
      setSelectedCaseId(caseId);
    },
    closeCase() {
      setSelectedCaseId(null);
    },
    createOpen,
    setCreateOpen(open: boolean) {
      setCreateOpen(open);
      if (!open) {
        setCreateForm(DEFAULT_CREATE_FORM);
        setContactSearch('');
      }
    },
    createForm,
    setCreateForm,
    createCaseMutation,
    contactsQuery,
    filteredContacts,
    selectedContact,
    contactSearch,
    setContactSearch,
    selectContact(contactId: string) {
      const selected = contacts.find((contact) => contact.id === contactId);

      setCreateForm((current) => ({
        ...current,
        contactId,
        debtorName: selected?.name ?? current.debtorName,
        phone: selected?.phone ?? current.phone,
        debtorDocument: selected?.document ?? current.debtorDocument,
      }));
    },
    clearSelectedContact() {
      setCreateForm((current) => ({
        ...current,
        contactId: '',
        debtorName: '',
        phone: '',
        debtorDocument: '',
      }));
    },
    outreachOpen,
    setOutreachOpen(open: boolean) {
      setOutreachOpen(open);
      if (!open) {
        setOutreachForm(DEFAULT_OUTREACH_FORM);
      }
    },
    outreachForm,
    setOutreachForm,
    outreachMutation,
    previewOutreachMutation,
    guidanceOpen,
    setGuidanceOpen(open: boolean) {
      setGuidanceOpen(open);
      if (!open) {
        setGuidanceForm(DEFAULT_GUIDANCE_FORM);
      }
    },
    guidanceForm,
    setGuidanceForm,
    regenerateGuidanceMutation,
    sendGuidanceMutation,
    paymentLinkOpen,
    setPaymentLinkOpen,
    paymentLinkForm,
    setPaymentLinkForm,
    paymentLinkMutation,
    statusOpen,
    setStatusOpen(open: boolean) {
      if (open && selectedCase) {
        setStatusForm({
          status: selectedCase.status,
          nextActionAt: selectedCase.nextActionAt
            ? new Date(selectedCase.nextActionAt).toISOString().slice(0, 16)
            : '',
        });
      } else if (!open) {
        setStatusForm(DEFAULT_STATUS_FORM);
      }
      setStatusOpen(open);
    },
    statusForm,
    setStatusForm,
    updateStatusMutation,
    generateReportMutation,
    syncReportSummaryMutation,

    playbooksOpen,
    setPlaybooksOpen(open: boolean) {
      setPlaybooksOpenState(open);
    },
    playbooksQuery,
    seedPlaybookMutation,
    activatePlaybookMutation,

    recurringOpen,
    setRecurringOpen(open: boolean) {
      setRecurringOpenState(open);
      if (!open) {
        setRecurringForm({
          intervalDays: '30',
          maxOccurrences: '6',
          firstRunAt: '',
          billingType: 'UNDEFINED',
          messageTemplate: '',
        });
        setRecurringCancelReason('');
      }
    },
    recurringForm,
    setRecurringForm,
    recurringCancelReason,
    setRecurringCancelReason,
    recurringChargesQuery,
    scheduleRecurringChargeMutation,
    cancelRecurringChargeMutation,
  };
}

export type RecoveryPageViewModel = ReturnType<typeof useRecoveryPageViewModel>;
