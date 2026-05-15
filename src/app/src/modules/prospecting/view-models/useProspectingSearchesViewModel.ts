import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import type { ProspectCampaignChannel, ProspectingAsyncJob } from '@/shared/types';
import { contactsService } from '@/modules/contacts/services/contacts-service';
import { prospectingCampaignService } from '@/modules/prospecting/services/prospecting-campaign-service';
import { prospectingSearchService } from '@/modules/prospecting/services/prospecting-search-service';
import { prospectingService } from '@/modules/prospecting/services/prospecting-service';
import { prospectMessageHasNameTokens } from '@/modules/prospecting/utils/prospect-message-template';

export function useProspectingSearchesViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [prospectOpen, setProspectOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [selectedResultDetailsId, setSelectedResultDetailsId] = useState<string | null>(null);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [resultsPage, setResultsPage] = useState(1);
  const [reportFilters, setReportFilters] = useState({
    query: '',
    statuses: [] as Array<'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'>,
    sources: [] as Array<'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE'>,
    dateFrom: '',
    dateTo: '',
  });
  const [currentReportJobId, setCurrentReportJobId] = useState<string | null>(null);
  const handledReportJobsRef = useRef<Record<string, string>>({});
  const [searchForm, setSearchForm] = useState({
    businessTypeQuery: '',
    city: '',
    state: '',
    neighborhood: '',
    maxResults: '20',
  });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [prospectForm, setProspectForm] = useState({
    campaignName: '',
    objective: '',
    channel: 'WHATSAPP' as ProspectCampaignChannel,
    messageTemplate: '',
  });

  const searchesQuery = useQuery({
    queryKey: ['prospecting-searches', tenant?.id, activeBranchId ?? 'tenant'],
    enabled: !!tenant?.id,
    queryFn: () => prospectingSearchService.listSearches(activeBranchId),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const searches = query.state.data ?? [];
      const currentSearch =
        searches.find((search) => search.id === selectedSearchId) ?? searches[0];

      return currentSearch &&
        (currentSearch.status === 'PENDING' || currentSearch.status === 'RUNNING')
        ? 5000
        : false;
    },
  });

  useEffect(() => {
    if (!selectedSearchId && searchesQuery.data?.[0]?.id) {
      setSelectedSearchId(searchesQuery.data[0].id);
    }
  }, [searchesQuery.data, selectedSearchId]);

  const selectedSearch =
    searchesQuery.data?.find((search) => search.id === selectedSearchId) ?? null;

  const formatTerritory = (search: NonNullable<typeof selectedSearch>) =>
    [search.neighborhood, search.city, search.state].filter(Boolean).join(' / ');

  const resultsQuery = useQuery({
    queryKey: ['prospecting-search-results', selectedSearchId, activeBranchId ?? 'tenant'],
    enabled: !!tenant?.id && !!selectedSearchId,
    queryFn: () => prospectingSearchService.listSearchResults(selectedSearchId!, activeBranchId),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval:
      selectedSearch &&
        (selectedSearch.status === 'PENDING' || selectedSearch.status === 'RUNNING')
        ? 5000
        : false,
  });

  const contactsQuery = useQuery({
    queryKey: ['prospecting-search-contacts', tenant?.id, activeBranchId],
    enabled: !!tenant?.id && !!selectedSearchId,
    queryFn: () =>
      contactsService.listContacts(tenant!.id, {
        page: 1,
        limit: 500,
        branchId: activeBranchId ?? undefined,
      }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const jobsQuery = useQuery({
    queryKey: ['prospecting-async-jobs', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: () => prospectingService.listAsyncJobs(),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const jobs = (query.state.data ?? []) as ProspectingAsyncJob[];
      return jobs.some((job) => job.status === 'QUEUED' || job.status === 'PROCESSING')
        ? 3000
        : false;
    },
  });

  useEffect(() => {
    setSelectedResultIds([]);
    setSelectedResultDetailsId(null);
    setResultsPage(1);
  }, [selectedSearchId]);

  const createSearchMutation = useMutation({
    mutationFn: () =>
      prospectingSearchService.createSearch({
        businessTypeQuery: searchForm.businessTypeQuery.trim(),
        city: searchForm.city.trim(),
        state: searchForm.state.trim() || undefined,
        neighborhood: searchForm.neighborhood.trim() || undefined,
        maxResults: Number(searchForm.maxResults) || 20,
      }),
    onMutate: () => {
      setSearchError(null);
    },
    onSuccess: async (search) => {
      await queryClient.invalidateQueries({ queryKey: ['prospecting-searches'] });
      setSelectedSearchId(search.id);
      setCreateOpen(false);
      setSearchError(null);
      setSearchForm({
        businessTypeQuery: '',
        city: '',
        state: '',
        neighborhood: '',
        maxResults: '20',
      });
      toast({
        title: 'Busca iniciada',
        description:
          'A pesquisa foi enfileirada e os resultados vão aparecer assim que o Google responder.',
      });
    },
    onError: (error) => {
      const message = getFriendlyErrorMessage(error, {
        fallbackMessage: 'Não foi possível iniciar a captação agora.',
      });

      setSearchError(message);
      toast({
        title: 'Falha ao iniciar busca',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: () =>
      prospectingSearchService.importSearchResults(
        selectedSearchId!,
        selectedResultIds.length ? selectedResultIds : undefined,
        activeBranchId ?? undefined,
      ),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['prospecting-search-contacts', tenant?.id, activeBranchId],
        }),
        queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] }),
      ]);
      toast({
        title: 'Prospects importados',
        description: `${result.importedCount} contatos entraram no CRM. ${result.skippedDuplicates} duplicados foram ignorados.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao importar resultados',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível importar os resultados agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const prospectMutation = useMutation({
    mutationFn: (resultIds: string[]) =>
      prospectingSearchService.prospectSelectedResults({
        searchId: selectedSearchId!,
        resultIds,
        campaignName: prospectForm.campaignName.trim() || undefined,
        objective: prospectForm.objective.trim() || undefined,
        channel: prospectForm.channel,
        messageTemplate: prospectForm.messageTemplate.trim(),
        branchId: activeBranchId ?? undefined,
      }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prospecting-campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] }),
        queryClient.invalidateQueries({
          queryKey: ['conversations', tenant?.id],
          exact: false,
        }),
      ]);
      setProspectOpen(false);
      setProspectForm({
        campaignName: '',
        objective: '',
        channel: 'WHATSAPP',
        messageTemplate: '',
      });
      toast({
        title: 'Abordagem preparada',
        description: `${result.targetContactIds.length} contatos foram organizados na fila comercial. Nenhuma mensagem foi enviada automaticamente.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao prospectar resultados',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível preparar a abordagem a partir desta busca.',
        }),
        variant: 'destructive',
      });
    },
  });

  const dispatchProspectMutation = useMutation({
    mutationFn: (resultIds: string[]) =>
      prospectingSearchService.prospectAndDispatchSelectedResults({
        searchId: selectedSearchId!,
        resultIds,
        campaignName: prospectForm.campaignName.trim() || undefined,
        objective: prospectForm.objective.trim() || undefined,
        channel: prospectForm.channel,
        messageTemplate: prospectForm.messageTemplate.trim(),
        branchId: activeBranchId ?? undefined,
      }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prospecting-campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] }),
        queryClient.invalidateQueries({
          queryKey: ['conversations', tenant?.id],
          exact: false,
        }),
      ]);
      setProspectOpen(false);
      setSelectedResultDetailsId(null);
      setProspectForm({
        campaignName: '',
        objective: '',
        channel: 'WHATSAPP',
        messageTemplate: '',
      });
      const conversationId = result.dispatch.conversationId;
      toast({
        title: 'Primeira mensagem enviada',
        description: `A conversa foi criada e a mensagem saiu para 1 empresa. ${result.dispatch.remainingPendingExecutions} contatos continuam na fila.`,
        action: React.createElement(
          ToastAction,
          {
            altText: 'Abrir conversa',
            onClick: () => navigate(`/app/conversations/${conversationId}`),
          },
          'Abrir conversa',
        ),
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao enviar mensagem',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage:
            'Nao foi possível enviar a primeira mensagem agora. A fila nao foi disparada novamente.',
        }),
        variant: 'destructive',
      });
    },
  });

  const searches = searchesQuery.data ?? [];
  const results = resultsQuery.data ?? [];
  const contacts = contactsQuery.data?.data ?? [];
  const resultsPageSize = 10;
  const totalResultsPages = Math.max(1, Math.ceil(results.length / resultsPageSize));
  const paginatedResults = results.slice(
    (resultsPage - 1) * resultsPageSize,
    resultsPage * resultsPageSize,
  );
  const selectedProspects = results.filter((result) =>
    selectedResultIds.includes(result.id),
  );
  const selectedResultDetails =
    results.find((result) => result.id === selectedResultDetailsId) ?? null;
  const channelReadySelectedProspects = selectedProspects.filter((result) =>
    prospectForm.channel === 'INSTAGRAM' ? !!result.instagramUrl : !!result.whatsappPhone,
  );
  const visibleSelectedProspects = selectedProspects.slice(0, 10);
  const visibleChannelReadySelectedProspects = channelReadySelectedProspects.slice(0, 10);
  const importedResultIds = new Set(
    results
      .filter((result) =>
        contacts.some((contact) => {
          const normalizedContactPhone = contact.phone.replace(/\D/g, '');
          const candidatePhones = [
            result.whatsappPhone,
            result.phone,
          ]
            .filter(Boolean)
            .map((value) => value!.replace(/\D/g, ''));

          const normalizedEmail = result.email?.trim().toLowerCase();
          const contactEmail = contact.email?.trim().toLowerCase();

          return (
            candidatePhones.includes(normalizedContactPhone) ||
            (!!normalizedEmail && normalizedEmail === contactEmail)
          );
        }),
      )
      .map((result) => result.id),
  );
  const allResultsImported = results.length > 0 && importedResultIds.size === results.length;

  const suggestMessageMutation = useMutation({
    mutationFn: () =>
      prospectingCampaignService.suggestCampaignMessage({
        branchId: activeBranchId,
        objective:
          prospectForm.objective.trim() ||
          `abrir abordagem com ${channelReadySelectedProspects.length} empresas da busca ${selectedSearch
            ? `${selectedSearch.businessTypeQuery} em ${formatTerritory(selectedSearch)}`
            : 'atual'
          }`,
        audienceType: 'CONTACT_LIST',
        channels: [prospectForm.channel],
        searchTerm: selectedSearch
          ? `${selectedSearch.businessTypeQuery} em ${formatTerritory(selectedSearch)}`
          : undefined,
        selectedCount: channelReadySelectedProspects.length,
        selectedContacts: channelReadySelectedProspects.slice(0, 10).map((result) => ({
          name: result.businessName,
          phone: result.whatsappPhone || result.phone,
          email: result.email,
        })),
      }),
    onSuccess: (result) => {
      setProspectForm((current) => ({
        ...current,
        messageTemplate: result.messageTemplate,
      }));
      toast({
        title: 'Mensagem sugerida',
        description: 'A IA preparou um texto inicial para a abordagem desta busca.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao gerar mensagem',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível gerar a mensagem com IA agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const metrics = useMemo(() => {
    const totalSearches = searches.length;
    const runningSearches = searches.filter(
      (search) => search.status === 'PENDING' || search.status === 'RUNNING',
    ).length;
    const completedSearches = searches.filter(
      (search) => search.status === 'COMPLETED',
    ).length;
    const totalDiscovered = searches.reduce(
      (accumulator, search) => accumulator + search.discoveredCount,
      0,
    );

    return {
      totalSearches,
      runningSearches,
      completedSearches,
      totalDiscovered,
    };
  }, [searches]);

  const activeReportJob = useMemo(
    () =>
      (jobsQuery.data ?? []).find(
        (job) =>
          job.id === currentReportJobId && job.type === 'EXPORT_PROSPECT_SEARCHES_CSV',
      ) ?? null,
    [currentReportJobId, jobsQuery.data],
  );

  const activeJobItems = useMemo<AsyncOperationItem[]>(
    () =>
      (jobsQuery.data ?? [])
        .filter(
          (job) =>
            job.type === 'EXPORT_PROSPECT_SEARCHES_CSV' &&
            (job.status === 'QUEUED' || job.status === 'PROCESSING'),
        )
        .map((job) => ({
          id: job.id,
          title: 'Exportação de prospeccao local',
          description:
            'Estamos consolidando buscas, territorio e sinais de contato para montar o CSV.',
          status: job.status,
          progress: job.progress,
          processedItems: job.processedItems,
          totalItems: job.totalItems,
        })),
    [jobsQuery.data],
  );

  useEffect(() => {
    if (!activeReportJob || handledReportJobsRef.current[activeReportJob.id] === activeReportJob.status) {
      return;
    }

    if (activeReportJob.status === 'COMPLETED') {
      handledReportJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentReportJobId(null);

      void prospectingService
        .downloadAsyncJobFile(activeReportJob.id, activeReportJob.fileName ?? undefined)
        .then(() => {
          toast({
            title: 'CSV de prospeccao exportado',
            description:
              Number(activeReportJob.resultSummary?.totalSearches ?? 0) > 0
                ? `${Number(activeReportJob.resultSummary?.totalSearches ?? 0)} buscas foram incluidas no arquivo.`
                : 'O arquivo foi gerado sem buscas para os filtros escolhidos.',
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

    if (activeReportJob.status === 'FAILED') {
      handledReportJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentReportJobId(null);
      toast({
        title: 'Falha ao exportar prospeccao',
        description:
          activeReportJob.errorMessage ?? 'não foi possível gerar o CSV deste Relatório.',
        variant: 'destructive',
      });
    }
  }, [activeReportJob]);

  const generateReportMutation = useMutation({
    mutationFn: () =>
      prospectingService.startSearchReportJob({
        query: reportFilters.query.trim() || undefined,
        statuses: reportFilters.statuses,
        sources: reportFilters.sources,
        dateFrom: reportFilters.dateFrom || undefined,
        dateTo: reportFilters.dateTo || undefined,
      }),
    onSuccess: async (job) => {
      setCurrentReportJobId(job.id);
      setReportsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['prospecting-async-jobs', tenant?.id] });
      toast({
        title: 'Relatorio enfileirado',
        description:
          'Vamos processar a prospeccao em segundo plano e iniciar o download quando o CSV ficar pronto.',
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

  return {
    tenant,
    createOpen,
    setCreateOpen,
    prospectOpen,
    setProspectOpen,
    reportsOpen,
    setReportsOpen,
    searches,
    selectedSearch,
    results,
    allResultsImported,
    importedResultIds,
    paginatedResults,
    resultsPage,
    totalResultsPages,
    resultsPageSize,
    selectedResultIds,
    searchesQuery,
    resultsQuery,
    contactsQuery,
    jobsQuery,
    searchForm,
    searchError,
    prospectForm,
    reportFilters,
    setReportFilters,
    metrics,
    activeReportJob,
    activeJobItems,
    createSearchMutation,
    importMutation,
    prospectMutation,
    dispatchProspectMutation,
    suggestMessageMutation,
    generateReportMutation,
    setSelectedSearchId,
    setResultsPage,
    selectedResultDetails,
    setSelectedResultDetailsId,
    updateSearchForm<K extends keyof typeof searchForm>(
      field: K,
      value: (typeof searchForm)[K],
    ) {
      setSearchError(null);
      setSearchForm((current) => ({ ...current, [field]: value }));
    },
    updateProspectForm<K extends keyof typeof prospectForm>(
      field: K,
      value: (typeof prospectForm)[K],
    ) {
      setProspectForm((current) => ({ ...current, [field]: value }));
    },
    toggleResult(resultId: string) {
      setSelectedResultIds((current) =>
        current.includes(resultId)
          ? current.filter((item) => item !== resultId)
          : [...current, resultId],
      );
    },
    toggleAllResults() {
      setSelectedResultIds((current) =>
        current.length === results.length ? [] : results.map((result) => result.id),
      );
    },
    openResultDetails(resultId: string) {
      setSelectedResultDetailsId(resultId);
    },
    prepareSingleResult(resultId: string) {
      setSelectedResultIds([resultId]);
      if (selectedSearch) {
        const territory = formatTerritory(selectedSearch);
        setProspectForm({
          campaignName: `${selectedSearch.businessTypeQuery} - ${territory}`,
          objective: `apresentar a solucao para empresas de ${selectedSearch.businessTypeQuery} em ${territory} e iniciar uma conversa comercial qualificada`,
          channel: 'WHATSAPP',
          messageTemplate: '',
        });
      }
      setSelectedResultDetailsId(null);
      setProspectOpen(true);
    },
    submitSearch() {
      if (!searchForm.businessTypeQuery.trim() || !searchForm.city.trim()) {
        toast({
          title: 'Preencha a busca',
          description: 'Informe o tipo de negócio e a cidade para pesquisar no Google Places.',
          variant: 'destructive',
        });
        return;
      }

      createSearchMutation.mutate();
    },
    importSelected() {
      if (!selectedSearchId) {
        return;
      }

      importMutation.mutate();
    },
    openProspectDialog() {
      if (!selectedSearchId || results.length === 0) {
        toast({
          title: 'Sem empresas carregadas',
          description: 'Espere os resultados aparecerem para preparar a abordagem.',
          variant: 'destructive',
        });
        return;
      }

      setSelectedResultIds((current) =>
        current.length > 0 ? current : results.map((result) => result.id),
      );

      if (selectedSearch) {
        const territory = formatTerritory(selectedSearch);
        setProspectForm({
          campaignName: `${selectedSearch.businessTypeQuery} • ${territory}`,
          objective: `apresentar a solução para empresas de ${selectedSearch.businessTypeQuery} em ${territory} e iniciar conversas comerciais qualificadas`,
          channel: 'WHATSAPP',
          messageTemplate: '',
        });
      }

      setProspectOpen(true);
    },
    prospectSelected() {
      if (!selectedSearchId || selectedResultIds.length === 0) {
        toast({
          title: 'Selecione empresas',
          description: 'Escolha pelo menos um resultado antes de preparar a abordagem.',
          variant: 'destructive',
        });
        return;
      }

      if (channelReadySelectedProspects.length === 0) {
        toast({
          title: 'Sem leads com este canal',
          description:
            prospectForm.channel === 'INSTAGRAM'
              ? 'Nenhum prospect selecionado possui Instagram identificado.'
              : 'Nenhum prospect selecionado possui WhatsApp identificado.',
          variant: 'destructive',
        });
        return;
      }

      if (!prospectForm.messageTemplate.trim()) {
        toast({
          title: 'Mensagem obrigatória',
          description: 'Escreva a mensagem inicial da abordagem para continuar.',
          variant: 'destructive',
        });
        return;
      }

      if (!prospectMessageHasNameTokens(prospectForm.messageTemplate)) {
        toast({
          title: 'Personalização obrigatória',
          description:
            'Inclua {{first_name}} ou {{name}} na mensagem para o mesmo padrao das campanhas.',
          variant: 'destructive',
        });
        return;
      }

      prospectMutation.mutate(
        channelReadySelectedProspects.map((result) => result.id),
      );
    },
    dispatchSelectedProspect() {
      if (!selectedSearchId || selectedResultIds.length === 0) {
        toast({
          title: 'Selecione empresas',
          description: 'Escolha pelo menos um resultado antes de enviar a mensagem.',
          variant: 'destructive',
        });
        return;
      }

      if (channelReadySelectedProspects.length === 0) {
        toast({
          title: 'Sem leads com este canal',
          description:
            prospectForm.channel === 'INSTAGRAM'
              ? 'Nenhum prospect selecionado possui Instagram identificado.'
              : 'Nenhum prospect selecionado possui WhatsApp identificado.',
          variant: 'destructive',
        });
        return;
      }

      if (!prospectForm.messageTemplate.trim()) {
        toast({
          title: 'Mensagem obrigatoria',
          description: 'Escreva a mensagem inicial antes de enviar.',
          variant: 'destructive',
        });
        return;
      }

      if (!prospectMessageHasNameTokens(prospectForm.messageTemplate)) {
        toast({
          title: 'Personalização obrigatória',
          description:
            'Inclua {{first_name}} ou {{name}} na mensagem antes de enviar.',
          variant: 'destructive',
        });
        return;
      }

      dispatchProspectMutation.mutate(
        channelReadySelectedProspects.map((result) => result.id),
      );
    },
    suggestProspectMessage() {
      if (selectedResultIds.length === 0) {
        toast({
          title: 'Selecione empresas',
          description: 'Escolha pelo menos um resultado antes de gerar a mensagem.',
          variant: 'destructive',
        });
        return;
      }

      if (channelReadySelectedProspects.length === 0) {
        toast({
          title: 'Sem leads com este canal',
          description:
            prospectForm.channel === 'INSTAGRAM'
              ? 'Nenhum prospect selecionado possui Instagram identificado.'
              : 'Nenhum prospect selecionado possui WhatsApp identificado.',
          variant: 'destructive',
        });
        return;
      }

      suggestMessageMutation.mutate();
    },
    selectedProspects,
    channelReadySelectedProspects,
    visibleSelectedProspects,
    visibleChannelReadySelectedProspects,
  };
}
