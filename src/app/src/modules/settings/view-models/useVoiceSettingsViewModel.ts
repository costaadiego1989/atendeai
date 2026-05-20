import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { toast } from '@/components/ui/use-toast';
import {
  voiceService,
  type VoiceConfig,
  type VoiceMetrics,
  type VoiceCallsResponse,
} from '../services/voice-service';

const CONFIG_KEY = 'voice-config';
const METRICS_KEY = 'voice-metrics';
const CALLS_KEY = 'voice-calls';

export function useVoiceSettingsViewModel() {
  const queryClient = useQueryClient();
  const tenant = useAuthStore((s) => s.tenant);
  const tenantId = tenant?.id;

  const [metricsPeriod, setMetricsPeriod] = useState<string>('30d');
  const [callsPage, setCallsPage] = useState(1);
  const [callsFilter, setCallsFilter] = useState<string | undefined>();

  // Config
  const { data: config, isLoading: isLoadingConfig } = useQuery<VoiceConfig>({
    queryKey: [CONFIG_KEY, tenantId],
    queryFn: () => voiceService.getConfig(tenantId!),
    enabled: !!tenantId,
  });

  // Metrics
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery<VoiceMetrics>({
    queryKey: [METRICS_KEY, tenantId, metricsPeriod],
    queryFn: () => voiceService.getMetrics(tenantId!, metricsPeriod),
    enabled: !!tenantId,
  });

  // Calls
  const { data: callsData, isLoading: isLoadingCalls } = useQuery<VoiceCallsResponse>({
    queryKey: [CALLS_KEY, tenantId, callsPage, callsFilter],
    queryFn: () =>
      voiceService.listCalls(tenantId!, {
        page: callsPage,
        limit: 20,
        status: callsFilter,
      }),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: (input: Partial<VoiceConfig>) =>
      voiceService.updateConfig(tenantId!, input),
    onSuccess: () => {
      toast({ title: 'Configuração salva', description: 'Agente de voz atualizado.' });
      void queryClient.invalidateQueries({ queryKey: [CONFIG_KEY, tenantId] });
    },
    onError: () => {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a configuração de voz.',
        variant: 'destructive',
      });
    },
  });

  return {
    config: config ?? null,
    metrics: metrics ?? null,
    calls: callsData?.items ?? [],
    callsTotal: callsData?.total ?? 0,
    callsPage,
    callsTotalPages: callsData?.totalPages ?? 0,

    isLoading: isLoadingConfig || isLoadingMetrics,
    isLoadingCalls,
    isSaving: saveMutation.isPending,

    metricsPeriod,
    setMetricsPeriod,
    setCallsPage,
    callsFilter,
    setCallsFilter,

    saveConfig: (input: Partial<VoiceConfig>) => saveMutation.mutateAsync(input),
  };
}
