import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { schedulingService } from '@/modules/scheduling/services/scheduling-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { formatCurrency } from '@/shared/lib/formatters';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import type { SchedulingAsyncJob } from '@/shared/types';

type SchedulingReportFilters = {
  startDate: string;
  endDate: string;
  professionalIds: string[];
  categoryIds: string[];
  statuses: Array<'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED'>;
};

type Args = {
  tenantId?: string;
  branchId?: string | null;
  reportsOpen: boolean;
  setReportsOpen: (open: boolean) => void;
  reportFilters: SchedulingReportFilters;
  setReportFilters: Dispatch<SetStateAction<SchedulingReportFilters>>;
};

function isActiveJob(job?: SchedulingAsyncJob | null) {
  return job?.status === 'QUEUED' || job?.status === 'PROCESSING';
}

export function useSchedulingReportsViewModel({
  tenantId,
  branchId,
  reportsOpen,
  setReportsOpen,
  reportFilters,
  setReportFilters,
}: Args) {
  const queryClient = useQueryClient();
  const [currentExportJobId, setCurrentExportJobId] = useState<string | null>(null);
  const handledJobsRef = useRef<Record<string, string>>({});

  const jobsQuery = useQuery({
    queryKey: ['scheduling-async-jobs', tenantId],
    queryFn: () => schedulingService.listAsyncJobs(tenantId!),
    enabled: Boolean(tenantId),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const jobs = (query.state.data ?? []) as SchedulingAsyncJob[];
      return jobs.some((job) => isActiveJob(job)) ? 3000 : false;
    },
  });

  const focusedJobQuery = useQuery({
    queryKey: ['scheduling-async-job', tenantId, currentExportJobId],
    enabled: Boolean(tenantId && currentExportJobId),
    queryFn: () => schedulingService.getAsyncJob(tenantId!, currentExportJobId!),
    refetchInterval: (query) => {
      const job = query.state.data as SchedulingAsyncJob | undefined;
      return job && isActiveJob(job) ? 2500 : false;
    },
  });

  const scopedJobs = useMemo(() => {
    const branchScope = branchId ?? null;
    return (jobsQuery.data ?? []).filter((job) => (job.branchId ?? null) === branchScope);
  }, [branchId, jobsQuery.data]);

  const activeJobItems = useMemo<AsyncOperationItem[]>(
    () =>
      scopedJobs
        .filter((job) => isActiveJob(job))
        .map((job) => ({
          id: job.id,
          title: 'Exportação de agenda',
          description:
            'Estamos consolidando slots, reservas e receita estimada para montar o CSV.',
          status: job.status,
          progress: job.progress,
          processedItems: job.processedItems,
          totalItems: job.totalItems,
        })),
    [scopedJobs],
  );

  const activeReportJob = useMemo(() => {
    if (!currentExportJobId) {
      return null;
    }

    if (focusedJobQuery.data?.id === currentExportJobId) {
      return focusedJobQuery.data;
    }

    return scopedJobs.find((job) => job.id === currentExportJobId) ?? null;
  }, [currentExportJobId, focusedJobQuery.data, scopedJobs]);

  useEffect(() => {
    if (!activeReportJob || handledJobsRef.current[activeReportJob.id] === activeReportJob.status) {
      return;
    }

    if (activeReportJob.status === 'COMPLETED') {
      handledJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentExportJobId(null);

      void schedulingService
        .downloadAsyncJobFile(tenantId!, activeReportJob.id, activeReportJob.fileName ?? undefined)
        .then(() => {
          toast({
            title: 'CSV da agenda exportado',
            description:
              Number(activeReportJob.resultSummary?.totalSlots ?? 0) > 0
                ? `${Number(activeReportJob.resultSummary?.totalSlots ?? 0)} slots foram incluidos no arquivo.`
                : 'O arquivo foi gerado sem slots para os filtros escolhidos.',
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
      setCurrentExportJobId(null);
      toast({
        title: 'Falha ao exportar agenda',
        description:
          activeReportJob.errorMessage ?? 'não foi possivel gerar o CSV da agenda.',
        variant: 'destructive',
      });
    }
  }, [activeReportJob, tenantId]);

  const generateReportMutation = useMutation({
    mutationFn: async (overrideFilters?: SchedulingReportFilters) => {
      if (!tenantId) {
        return null;
      }

      const filters = overrideFilters ?? reportFilters;
      return schedulingService.startReportJob(tenantId, {
        branchId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        professionalIds: filters.professionalIds,
        categoryIds: filters.categoryIds,
        statuses: filters.statuses,
      });
    },
    onSuccess: async (job) => {
      if (!job) {
        return;
      }

      setCurrentExportJobId(job.id);
      setReportsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['scheduling-async-jobs', tenantId] });
      await queryClient.invalidateQueries({
        queryKey: ['scheduling-async-job', tenantId, job.id],
      });
      toast({
        title: 'Relatorio enfileirado',
        description:
          'Vamos processar a agenda em segundo plano e iniciar o download quando o CSV ficar pronto.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar exportação',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel enfileirar o relatorio agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const syncReportSummaryMutation = useMutation({
    mutationFn: () => {
      if (!tenantId) {
        return Promise.reject(new Error('Tenant não disponível.'));
      }

      return schedulingService.generateReportSync(tenantId, {
        branchId,
        startDate: reportFilters.startDate,
        endDate: reportFilters.endDate,
        professionalIds: reportFilters.professionalIds,
        categoryIds: reportFilters.categoryIds,
        statuses: reportFilters.statuses,
      });
    },
    onSuccess: (data) => {
      const s = data.summary;
      const total = s.totalSlots ?? 0;
      const revenueLabel = formatCurrency(s.estimatedRevenue) ?? '—';
      toast({
        title: 'Resumo da agenda (instantâneo)',
        description: `${total} slots · receita estimada ${revenueLabel}`,
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
    reportsOpen,
    setReportsOpen,
    reportFilters,
    setReportFilters,
    jobsQuery,
    activeJobItems,
    activeReportJob,
    generateReportMutation,
    syncReportSummaryMutation,
    downloadCurrentReport() {
      generateReportMutation.mutate(reportFilters);
    },
  };
}
