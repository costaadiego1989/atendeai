import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { inventoryService } from '@/modules/inventory/services/inventory-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import { formatCurrency } from '@/shared/lib/formatters';
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from '@/shared/lib/masks';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { InventoryAsyncJob, InventoryItemRecord } from '@/shared/types';

const DEFAULT_CONNECTION_FORM = {
  sourceType: 'ERP_SYNC' as
    | 'MANUAL_SNAPSHOT'
    | 'CSV_IMPORT'
    | 'ERP_SYNC'
    | 'PDV_SYNC'
    | 'ECOMMERCE_SYNC'
    | 'BLING'
    | 'TINY',
  providerName: '',
  configSummary: '',
};

const DEFAULT_SYNC_FORM = {
  catalogItemId: '',
  sku: '',
  externalReference: '',
  name: '',
  availableQuantity: '0',
  availabilityStatus: 'AVAILABLE' as 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED',
  currentPrice: '',
  source: 'MANUAL_SNAPSHOT' as 'MANUAL_SNAPSHOT' | 'CSV_IMPORT' | 'IMPORT_SNAPSHOT' | 'ERP_SYNC' | 'PDV_SYNC' | 'ECOMMERCE_SYNC',
};

const DEFAULT_REPORT_FILTERS = {
  query: '',
  statuses: [] as Array<'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED'>,
  availableOnly: false,
};

function isActiveJob(job?: InventoryAsyncJob | null) {
  return job?.status === 'QUEUED' || job?.status === 'PROCESSING';
}

export function useInventoryPageViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const queryClient = useQueryClient();
  const PAGE_SIZE = 12;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'ALL' | InventoryItemRecord['availabilityStatus']>('ALL');
  const [selectedItem, setSelectedItem] = useState<InventoryItemRecord | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [reportsOpen, setReportsOpenState] = useState(false);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [connectionForm, setConnectionForm] = useState(DEFAULT_CONNECTION_FORM);
  const [syncForm, setSyncForm] = useState(DEFAULT_SYNC_FORM);
  const [reportFilters, setReportFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [currentReportJobId, setCurrentReportJobId] = useState<string | null>(null);
  const handledJobsRef = useRef<Record<string, string>>({});
  const [localSyncItems, setLocalSyncItems] = useState<AsyncOperationItem[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<{ connectionId: string; success: boolean; timestamp: number } | null>(null);
  const prefillCatalogItemId = searchParams.get('catalogItemId') ?? '';
  const prefillName = searchParams.get('name') ?? '';
  const prefillExternalReference = searchParams.get('externalReference') ?? '';
  const prefillSuggestedPrice = searchParams.get('basePrice') ?? '';

  useEffect(() => {
    if (!prefillCatalogItemId && !prefillName) {
      return;
    }

    setSyncForm((current) => ({
      ...current,
      catalogItemId: current.catalogItemId || prefillCatalogItemId,
      name: current.name || prefillName,
      externalReference: current.externalReference || prefillExternalReference,
      currentPrice:
        current.currentPrice ||
        (prefillSuggestedPrice ? formatCurrencyInput(prefillSuggestedPrice) : ''),
    }));
    setSyncDialogOpen(true);
  }, [
    prefillCatalogItemId,
    prefillName,
    prefillExternalReference,
    prefillSuggestedPrice,
  ]);

  const itemsQuery = useQuery({
    queryKey: ['inventory-items', tenant?.id, showAvailableOnly],
    enabled: Boolean(tenant?.id),
    queryFn: () =>
      inventoryService.listItems(tenant!.id, {
        availableOnly: showAvailableOnly,
      }),
  });

  const connectionsQuery = useQuery({
    queryKey: ['inventory-connections', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => inventoryService.listConnections(tenant!.id),
  });

  const jobsQuery = useQuery({
    queryKey: ['inventory-async-jobs', tenant?.id],
    queryFn: () => inventoryService.listAsyncJobs(tenant!.id),
    enabled: Boolean(tenant?.id),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const jobs = (query.state.data ?? []) as InventoryAsyncJob[];
      return jobs.some((job) => isActiveJob(job)) ? 3000 : false;
    },
  });

  const focusedJobQuery = useQuery({
    queryKey: ['inventory-async-job', tenant?.id, currentReportJobId],
    enabled: Boolean(tenant?.id && currentReportJobId),
    queryFn: () => inventoryService.getAsyncJob(tenant!.id, currentReportJobId!),
    refetchInterval: (query) => {
      const job = query.state.data as InventoryAsyncJob | undefined;
      return job && isActiveJob(job) ? 2500 : false;
    },
  });

  function resolveReportJobFromList(jobId: string | null) {
    return jobId ? ((jobsQuery.data ?? []).find((job) => job.id === jobId) ?? null) : null;
  }

  const activeReportJob = useMemo(() => {
    if (!currentReportJobId) {
      return null;
    }

    if (focusedJobQuery.data?.id === currentReportJobId) {
      return focusedJobQuery.data;
    }

    return resolveReportJobFromList(currentReportJobId);
  }, [currentReportJobId, focusedJobQuery.data, jobsQuery.data]);

  const activeJobItems = useMemo<AsyncOperationItem[]>(() => {
    const exportJobs = (jobsQuery.data ?? [])
      .filter((job) => isActiveJob(job))
      .map((job) => ({
        id: job.id,
        title: 'Exportação de estoque',
        description: 'Estamos consolidando os itens atuais para montar o CSV.',
        status: job.status,
        progress: job.progress,
        processedItems: job.processedItems,
        totalItems: job.totalItems,
      }));
    return [...localSyncItems, ...exportJobs];
  }, [jobsQuery.data, localSyncItems]);

  useEffect(() => {
    if (!activeReportJob || handledJobsRef.current[activeReportJob.id] === activeReportJob.status) {
      return;
    }

    if (activeReportJob.status === 'COMPLETED') {
      handledJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentReportJobId(null);

      void inventoryService
        .downloadAsyncJobFile(tenant!.id, activeReportJob.id, activeReportJob.fileName ?? undefined)
        .then(() => {
          toast({
            title: 'CSV de estoque exportado',
            description:
              Number(activeReportJob.resultSummary?.totalItems ?? 0) > 0
                ? `${Number(activeReportJob.resultSummary?.totalItems ?? 0)} itens foram incluidos no arquivo.`
                : 'O arquivo foi gerado sem itens para os filtros escolhidos.',
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
      handledJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentReportJobId(null);
      toast({
        title: 'Falha ao exportar estoque',
        description:
          activeReportJob.errorMessage ?? 'não foi possível gerar o CSV do estoque.',
        variant: 'destructive',
      });
    }
  }, [activeReportJob, tenant]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (itemsQuery.data ?? []).filter((item) => {
      const matchesSearch = !normalized
        ? true
        : [item.name, item.sku, item.externalReference]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      const matchesStatus =
        statusFilter === 'ALL' || item.availabilityStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [itemsQuery.data, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredItems]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, showAvailableOnly]);

  const startLocalSyncTracking = useCallback((connectionId: string, providerName: string) => {
    const item: AsyncOperationItem = {
      id: `sync-${connectionId}`,
      title: `Sincronizando ${providerName}`,
      description: 'Buscando itens do fornecedor e atualizando o estoque em segundo plano.',
      status: 'PROCESSING',
      // progress intentionally omitted — real value comes from server poll
    };

    setLocalSyncItems((prev) => [...prev.filter((i) => i.id !== item.id), item]);
  }, []);

  const stopLocalSyncTracking = useCallback((connectionId: string, success: boolean) => {
    setLocalSyncItems((prev) =>
      prev.map((i) =>
        i.id === `sync-${connectionId}`
          ? { ...i, status: success ? 'COMPLETED' : 'FAILED', progress: success ? 100 : i.progress }
          : i,
      ),
    );

    setTimeout(() => {
      setLocalSyncItems((prev) => prev.filter((i) => i.id !== `sync-${connectionId}`));
    }, 3000);

    setLastSyncResult({ connectionId, success, timestamp: Date.now() });
    setTimeout(() => setLastSyncResult(null), 5000);
  }, []);

  const createConnectionMutation = useMutation({
    mutationFn: () =>
      inventoryService.createConnection(tenant!.id, {
        sourceType: connectionForm.sourceType,
        providerName: connectionForm.providerName.trim(),
        config: connectionForm.configSummary.trim()
          ? { summary: connectionForm.configSummary.trim() }
          : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory-connections', tenant?.id] });
      setConnectionDialogOpen(false);
      setConnectionForm(DEFAULT_CONNECTION_FORM);
      toast({
        title: 'conexão criada',
        description: 'A conexão de estoque foi registrada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar conexão',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível criar a conexão agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const syncConnectionMutation = useMutation({
    mutationFn: ({ connectionId, providerName }: { connectionId: string; providerName: string }) => {
      startLocalSyncTracking(connectionId, providerName);
      return inventoryService.syncConnectionNow(tenant!.id, connectionId);
    },
    onSuccess: async (_, { connectionId }) => {
      stopLocalSyncTracking(connectionId, true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-connections', tenant?.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] }),
      ]);
      toast({
        title: 'Sincronização concluída',
        description: 'Os itens do estoque foram atualizados com os dados mais recentes.',
      });
    },
    onError: (error, { connectionId }) => {
      stopLocalSyncTracking(connectionId, false);
      toast({
        title: 'Falha na sincronização',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível sincronizar esta conexão agora. Tente novamente.',
        }),
        variant: 'destructive',
      });
    },
  });

  const syncItemMutation = useMutation({
    mutationFn: () =>
      inventoryService.syncItem(tenant!.id, {
        catalogItemId: syncForm.catalogItemId.trim() || undefined,
        sku: syncForm.sku.trim(),
        externalReference: syncForm.externalReference.trim() || undefined,
        name: syncForm.name.trim(),
        availableQuantity: Number(syncForm.availableQuantity),
        availabilityStatus: syncForm.availabilityStatus,
        currentPrice: parseCurrencyInput(syncForm.currentPrice),
        source: syncForm.source,
      }),
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setSyncDialogOpen(false);
      setSyncForm(DEFAULT_SYNC_FORM);
      setSearchParams((current) => {
        current.delete('catalogItemId');
        current.delete('name');
        current.delete('externalReference');
        current.delete('basePrice');
        return current;
      });
      setSelectedItem(item);
      toast({
        title: 'Snapshot salvo',
        description: 'O item foi sincronizado no estoque com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao sincronizar item',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível salvar o snapshot agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: (overrideFilters?: typeof DEFAULT_REPORT_FILTERS) => {
      const filters = overrideFilters ?? reportFilters;

      return inventoryService.startReportJob(tenant!.id, {
        query: filters.query.trim() || undefined,
        availableOnly: filters.availableOnly,
        statuses: filters.statuses,
      });
    },
    onSuccess: async (job) => {
      setCurrentReportJobId(job.id);
      setReportsOpenState(false);
      await queryClient.invalidateQueries({ queryKey: ['inventory-async-jobs', tenant?.id] });
      await queryClient.invalidateQueries({
        queryKey: ['inventory-async-job', tenant?.id, job.id],
      });
      toast({
        title: 'Relatorio enfileirado',
        description:
          'Vamos processar o estoque em segundo plano e iniciar o download quando o CSV ficar pronto.',
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
    mutationFn: (overrideFilters?: typeof DEFAULT_REPORT_FILTERS) => {
      const filters = overrideFilters ?? reportFilters;

      return inventoryService.generateReportSync(tenant!.id, {
        query: filters.query.trim() || undefined,
        availableOnly: filters.availableOnly,
        statuses: filters.statuses,
      });
    },
    onSuccess: (data) => {
      const s = data.summary;
      const valueLabel = formatCurrency(s.estimatedInventoryValue) ?? 'R$ 0,00';
      toast({
        title: 'Resumo do estoque (instantâneo)',
        description: `${s.totalItems} SKUs · quantidade total ${s.totalQuantity} · disponíveis ${s.availableItems} · baixo ${s.lowStockItems} · indisponíveis ${s.unavailableItems} · reservados ${s.reservedItems} · valor estimado ${valueLabel}`,
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

  return {
    tenant,
    search,
    setSearch,
    page: currentPage,
    setPage,
    totalPages,
    statusFilter,
    setStatusFilter,
    showAvailableOnly,
    setShowAvailableOnly,
    itemsQuery,
    filteredItems: paginatedItems,
    totalFilteredItems: filteredItems.length,
    connectionsQuery,
    jobsQuery,
    activeJobItems,
    activeReportJob,
    selectedItem,
    setSelectedItem,
    syncDialogOpen,
    setSyncDialogOpen(open: boolean) {
      setSyncDialogOpen(open);
      if (!open) {
        setSyncForm(DEFAULT_SYNC_FORM);
        setSearchParams((current) => {
          current.delete('catalogItemId');
          current.delete('name');
          current.delete('externalReference');
          current.delete('basePrice');
          return current;
        });
      }
    },
    openUpdateSnapshot(item: InventoryItemRecord) {
      setSyncForm({
        catalogItemId: item.catalogItemId ?? '',
        sku: item.sku,
        externalReference: item.externalReference ?? '',
        name: item.name,
        availableQuantity: String(item.availableQuantity ?? 0),
        availabilityStatus: item.availabilityStatus,
        currentPrice:
          item.currentPrice == null
            ? ''
            : formatCurrencyInput(String(Math.round(item.currentPrice * 100))),
        source: 'MANUAL_SNAPSHOT',
      });
      setSyncDialogOpen(true);
    },
    connectionDialogOpen,
    setConnectionDialogOpen(open: boolean) {
      setConnectionDialogOpen(open);
      if (!open) setConnectionForm(DEFAULT_CONNECTION_FORM);
    },
    reportsOpen,
    setReportsOpen(open: boolean) {
      setReportsOpenState(open);
    },
    reportFilters,
    setReportFilters,
    connectionForm,
    setConnectionForm,
    syncForm,
    setSyncForm,
    prefillCatalogItemId,
    setSyncCurrentPrice(value: string) {
      setSyncForm((current) => ({
        ...current,
        currentPrice: formatCurrencyInput(value),
      }));
    },
    lastSyncResult,
    createConnectionMutation,
    syncConnectionMutation,
    syncItemMutation,
    generateReportMutation,
    syncReportSummaryMutation,
    downloadCurrentReport() {
      generateReportMutation.mutate({
        query: search,
        statuses: statusFilter === 'ALL' ? [] : [statusFilter],
        availableOnly: showAvailableOnly,
      });
    },
  };
}

export type InventoryPageViewModel = ReturnType<typeof useInventoryPageViewModel>;
