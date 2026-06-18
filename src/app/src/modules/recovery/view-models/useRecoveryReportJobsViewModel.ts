import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import {
  recoveryService,
} from '@/modules/recovery/services/RecoveryService';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import type { RecoveryAsyncJob } from '@/shared/types';
import {
  DEFAULT_REPORT_FILTERS,
  isActiveRecoveryJob,
} from './useRecoveryViewModelHelper';
import { formatCurrency } from '@/shared/lib/formatters';

export function useRecoveryReportJobsViewModel(params: {
  tenantId: string | undefined;
  activeBranchId: string | null | undefined;
  periodRange: { dateFrom?: string; dateTo?: string };
  reportFilters: { statuses: string[]; sources: string[]; search: string };
}) {
  const { tenantId, activeBranchId, periodRange } = params;
  // reportFilters param is part of the public signature for future callers;
  // the hook manages its own reportFilters state internally.
  const queryClient = useQueryClient();

  const [reportsOpen, setReportsOpenState] = useState(false);
  const [reportFilters, setReportFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [currentReportJobId, setCurrentReportJobId] = useState<string | null>(null);
  const handledReportJobsRef = useRef<Record<string, string>>({});

  const jobsQuery = useQuery({
    queryKey: ['recovery-async-jobs', tenantId],
    queryFn: () => recoveryService.listAsyncJobs(tenantId!),
    enabled: Boolean(tenantId),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const jobs = (query.state.data ?? []) as RecoveryAsyncJob[];
      return jobs.some((job) => isActiveRecoveryJob(job)) ? 3000 : false;
    },
  });

  const focusedJobQuery = useQuery({
    queryKey: ['recovery-async-job', tenantId, currentReportJobId],
    enabled: Boolean(tenantId && currentReportJobId),
    queryFn: () => recoveryService.getAsyncJob(tenantId!, currentReportJobId!),
    refetchInterval: (query) => {
      const job = query.state.data as RecoveryAsyncJob | undefined;
      return job && isActiveRecoveryJob(job) ? 2500 : false;
    },
  });

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
          tenantId!,
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
  }, [recoveryActiveReportJob, tenantId]);

  const generateReportMutation = useMutation({
    mutationFn: () =>
      recoveryService.startReportJob(tenantId!, {
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
      await queryClient.invalidateQueries({ queryKey: ['recovery-async-jobs', tenantId] });
      await queryClient.invalidateQueries({
        queryKey: ['recovery-async-job', tenantId, job.id],
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
      recoveryService.generateReportSync(tenantId!, {
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

  return {
    jobsQuery,
    recoveryActiveReportJob,
    recoveryActiveJobItems,
    reportsOpen,
    setReportsOpen(open: boolean) {
      setReportsOpenState(open);
    },
    reportFilters,
    setReportFilters,
    generateReportMutation,
    syncReportSummaryMutation,
  };
}
