import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { contactsService } from '@/modules/contacts/services/contacts-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import type {
  ContactAsyncJob,
  ContactImportResult,
  ContactStage,
} from '@/shared/types';

function isActiveJob(job?: ContactAsyncJob | null) {
  return job?.status === 'QUEUED' || job?.status === 'PROCESSING';
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function useContactsJobsViewModel(params: {
  tenantId: string | undefined;
  activeBranchId: string | null | undefined;
  reportFilters: {
    tags: string;
    stages: ContactStage[];
    timelineTypes: string[];
    channels: string[];
    dateFrom: string;
    dateTo: string;
  };
  stageFilter: ContactStage | 'ALL';
  importForm: { rawText: string; defaultStage: ContactStage; defaultTags: string };
  onImportSuccess: (params: { jobId: string }) => void;
  onReportSuccess: () => void;
}) {
  const { tenantId, activeBranchId, reportFilters, stageFilter, importForm, onImportSuccess, onReportSuccess } = params;
  const queryClient = useQueryClient();

  const [lastImportResult, setLastImportResult] = useState<ContactImportResult | null>(null);
  const [currentImportJobId, setCurrentImportJobId] = useState<string | null>(null);
  const [currentExportJobId, setCurrentExportJobId] = useState<string | null>(null);
  const handledJobsRef = useRef<Record<string, string>>({});

  const jobsQuery = useQuery({
    queryKey: ['contact-async-jobs', tenantId],
    queryFn: () => contactsService.listAsyncJobs(tenantId!),
    enabled: Boolean(tenantId),
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
        void queryClient.invalidateQueries({ queryKey: ['contacts', tenantId] });
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
          .downloadAsyncJobFile(tenantId!, exportJob.id, exportJob.fileName ?? undefined)
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
    tenantId,
  ]);

  const importContactsMutation = useMutation({
    mutationFn: () =>
      contactsService.startImportJob(
        tenantId!,
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
      onImportSuccess({ jobId: job.id });
      await queryClient.invalidateQueries({ queryKey: ['contact-async-jobs', tenantId] });
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
      return contactsService.startReportJob(tenantId!, {
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
      onReportSuccess();
      await queryClient.invalidateQueries({ queryKey: ['contact-async-jobs', tenantId] });
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

  function downloadReport() {
    if (isActiveJob(latestReportJob)) {
      toast({
        title: 'CSV já em andamento',
        description: 'Espere o arquivo atual terminar antes de gerar outro no mesmo escopo.',
        variant: 'destructive',
      });
      return;
    }

    reportMutation.mutate();
  }

  function downloadCurrentReport() {
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
  }

  function submitImport() {
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
  }

  return {
    jobsQuery,
    latestImportJob: visibleImportJob,
    latestReportJob: visibleReportJob,
    activeJobsCount,
    activeJobItems,
    lastImportResult,
    setLastImportResult,
    importContactsMutation,
    reportMutation,
    downloadReport,
    downloadCurrentReport,
    submitImport,
  };
}
