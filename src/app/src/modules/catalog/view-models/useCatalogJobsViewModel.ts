/**
 * useCatalogJobsViewModel
 *
 * Owns all async-job orchestration for the catalog module:
 * - jobsQuery (polling list)
 * - focusedJobQuery (single-job polling while active)
 * - activeReportJob / activeImportJob resolution
 * - activeJobItems for AsyncOperationsPanel
 * - COMPLETED/FAILED useEffects (download, invalidate, toast)
 * - generateReportMutation / syncReportSummaryMutation / importItemsMutation
 * - reportsOpen / importOpen state
 *
 * Extracted from useCatalogPageViewModel to reduce its size from ~886 → ~560 lines.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { catalogService } from '@/modules/catalog/services/catalog-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import { formatCurrency } from '@/shared/lib/formatters';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { CatalogAsyncJob } from '@/shared/types';

const DEFAULT_REPORT_FILTERS = {
  query: '',
  types: [] as Array<'SERVICE' | 'PRODUCT' | 'RENTAL'>,
  categoryIds: [] as string[],
  includeInactive: false,
};

const DEFAULT_IMPORT_FORM = {
  rawText: '',
  defaultType: 'PRODUCT' as 'PRODUCT' | 'SERVICE' | 'RENTAL',
  defaultCategoryName: '',
  defaultSource: 'IMPORT' as 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT',
  defaultTags: '',
  syncInventory: true,
};

function isActiveJob(job?: CatalogAsyncJob | null) {
  return job?.status === 'QUEUED' || job?.status === 'PROCESSING';
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface UseCatalogJobsViewModelOptions {
  /** Called when an import job completes so the main VM can invalidate item/category queries */
  onImportSuccess: () => Promise<void>;
  /** Called when an import dialog should be closed */
  onImportClose?: () => void;
}

export function useCatalogJobsViewModel({
  onImportSuccess,
  onImportClose,
}: UseCatalogJobsViewModelOptions) {
  const tenant = useAuthStore((state) => state.tenant);
  const queryClient = useQueryClient();

  const [currentReportJobId, setCurrentReportJobId] = useState<string | null>(null);
  const [currentImportJobId, setCurrentImportJobId] = useState<string | null>(null);
  const [reportsOpen, setReportsOpenState] = useState(false);
  const [importOpen, setImportOpenState] = useState(false);
  const [reportFilters, setReportFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [importForm, setImportForm] = useState(DEFAULT_IMPORT_FORM);
  const handledJobsRef = useRef<Record<string, string>>({});

  const jobsQuery = useQuery({
    queryKey: ['catalog-async-jobs', tenant?.id],
    queryFn: () => catalogService.listAsyncJobs(tenant!.id),
    enabled: Boolean(tenant?.id),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const jobs = (query.state.data ?? []) as CatalogAsyncJob[];
      return jobs.some((job) => isActiveJob(job)) ? 3000 : false;
    },
  });

  const pollingJobId = currentReportJobId ?? currentImportJobId ?? null;

  const focusedJobQuery = useQuery({
    queryKey: ['catalog-async-job', tenant?.id, pollingJobId],
    enabled: Boolean(tenant?.id && pollingJobId),
    queryFn: () => catalogService.getAsyncJob(tenant!.id, pollingJobId!),
    refetchInterval: (query) => {
      const job = query.state.data as CatalogAsyncJob | undefined;
      return job && isActiveJob(job) ? 2500 : false;
    },
  });

  function resolveJobFromList(jobId: string | null) {
    return jobId ? ((jobsQuery.data ?? []).find((job) => job.id === jobId) ?? null) : null;
  }

  const activeReportJob = useMemo(() => {
    if (!currentReportJobId) return null;
    if (focusedJobQuery.data?.id === currentReportJobId) return focusedJobQuery.data;
    return resolveJobFromList(currentReportJobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentReportJobId, focusedJobQuery.data, jobsQuery.data]);

  const activeImportJob = useMemo(() => {
    if (!currentImportJobId) return null;
    if (focusedJobQuery.data?.id === currentImportJobId) return focusedJobQuery.data;
    return resolveJobFromList(currentImportJobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImportJobId, focusedJobQuery.data, jobsQuery.data]);

  const activeJobItems = useMemo<AsyncOperationItem[]>(
    () =>
      (jobsQuery.data ?? [])
        .filter((job) => isActiveJob(job))
        .map((job) => ({
          id: job.id,
          title:
            job.type === 'IMPORT_CATALOG_ITEMS'
              ? 'Importação de catalogo'
              : 'Exportação de catalogo',
          description:
            job.type === 'IMPORT_CATALOG_ITEMS'
              ? 'Estamos ajustando a planilha ao modelo do produto e criando itens em segundo plano.'
              : 'Estamos consolidando os itens e categorias para montar o CSV.',
          status: job.status,
          progress: job.progress,
          processedItems: job.processedItems,
          totalItems: job.totalItems,
        })),
    [jobsQuery.data],
  );

  // Report job completion handler
  useEffect(() => {
    if (!activeReportJob || handledJobsRef.current[activeReportJob.id] === activeReportJob.status) {
      return;
    }

    if (activeReportJob.status === 'COMPLETED') {
      handledJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentReportJobId(null);

      void catalogService
        .downloadAsyncJobFile(tenant!.id, activeReportJob.id, activeReportJob.fileName ?? undefined)
        .then(() => {
          toast({
            title: 'CSV do catalogo exportado',
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
        title: 'Falha ao exportar catalogo',
        description:
          activeReportJob.errorMessage ?? 'não foi possível gerar o CSV do catalogo.',
        variant: 'destructive',
      });
    }
  }, [activeReportJob, tenant]);

  // Import job completion handler
  useEffect(() => {
    if (!activeImportJob || handledJobsRef.current[activeImportJob.id] === activeImportJob.status) {
      return;
    }

    if (activeImportJob.status === 'COMPLETED') {
      handledJobsRef.current[activeImportJob.id] = activeImportJob.status;
      setCurrentImportJobId(null);
      void onImportSuccess();
      toast({
        title: 'Importaç��o concluida',
        description:
          Number(activeImportJob.resultSummary?.created ?? 0) > 0 ||
            Number(activeImportJob.resultSummary?.updated ?? 0) > 0
            ? `${Number(activeImportJob.resultSummary?.created ?? 0)} itens criados e ${Number(activeImportJob.resultSummary?.updated ?? 0)} atualizados.`
            : 'A importação terminou sem alterar itens.',
      });
    }

    if (activeImportJob.status === 'FAILED') {
      handledJobsRef.current[activeImportJob.id] = activeImportJob.status;
      setCurrentImportJobId(null);
      toast({
        title: 'Falha ao importar catalogo',
        description:
          activeImportJob.errorMessage ?? 'não foi possível processar a base agora.',
        variant: 'destructive',
      });
    }
  }, [activeImportJob, onImportSuccess]);

  const generateReportMutation = useMutation({
    mutationFn: (overrideFilters?: typeof DEFAULT_REPORT_FILTERS) => {
      const filters = overrideFilters ?? reportFilters;
      return catalogService.startReportJob(tenant!.id, {
        query: filters.query.trim() || undefined,
        types: filters.types,
        categoryIds: filters.categoryIds,
        includeInactive: filters.includeInactive,
      });
    },
    onSuccess: async (job) => {
      setCurrentReportJobId(job.id);
      setReportsOpenState(false);
      await queryClient.invalidateQueries({ queryKey: ['catalog-async-jobs', tenant?.id] });
      toast({
        title: 'Relatorio enfileirado',
        description:
          'Vamos processar o catalogo em segundo plano e iniciar o download quando o CSV ficar pronto.',
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
      return catalogService.generateReportSync(tenant!.id, {
        query: filters.query.trim() || undefined,
        types: filters.types,
        categoryIds: filters.categoryIds,
        includeInactive: filters.includeInactive,
      });
    },
    onSuccess: (data) => {
      const s = data.summary;
      const valueLabel = formatCurrency(s.estimatedBaseValue) ?? 'R$ 0,00';
      toast({
        title: 'Resumo do catálogo (instantâneo)',
        description: `${s.totalItems} itens · ${s.activeItems} ativos · ${s.inactiveItems} inativos · serviços ${s.services} · produtos ${s.products} · locações ${s.rentals} · valor base estimado ${valueLabel}`,
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

  const importItemsMutation = useMutation({
    mutationFn: () =>
      catalogService.startImportJob(tenant!.id, {
        rawText: importForm.rawText,
        defaultType: importForm.defaultType,
        defaultCategoryName: importForm.defaultCategoryName.trim() || undefined,
        defaultSource: importForm.defaultSource,
        defaultTags: splitTags(importForm.defaultTags),
        syncInventory: importForm.syncInventory,
      }),
    onSuccess: async (job) => {
      setCurrentImportJobId(job.id);
      setImportOpenState(false);
      setImportForm(DEFAULT_IMPORT_FORM);
      onImportClose?.();
      await queryClient.invalidateQueries({ queryKey: ['catalog-async-jobs', tenant?.id] });
      toast({
        title: 'Importação enfileirada',
        description:
          'Vamos processar a planilha em segundo plano e atualizar o catalogo sem travar a operação.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar importação',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível enfileirar a importação agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  return {
    jobsQuery,
    activeJobItems,
    activeReportJob,
    activeImportJob,
    reportsOpen,
    setReportsOpen: setReportsOpenState,
    importOpen,
    setImportOpen(open: boolean) {
      setImportOpenState(open);
      if (!open && !isActiveJob(activeImportJob)) {
        setImportForm(DEFAULT_IMPORT_FORM);
      }
    },
    reportFilters,
    setReportFilters,
    importForm,
    setImportForm,
    importPreviewCount: importForm.rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length,
    generateReportMutation,
    syncReportSummaryMutation,
    importItemsMutation,
  };
}
