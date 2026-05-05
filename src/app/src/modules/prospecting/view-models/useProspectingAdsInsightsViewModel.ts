import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { prospectingAdsService } from '@/modules/prospecting/services/prospecting-ads-service';

export function useProspectingAdsInsightsViewModel() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [form, setForm] = useState({
    segment: '',
    city: '',
    state: '',
    country: 'BR',
    ageRange: '',
    gender: '',
    interest: '',
  });

  const queriesQuery = useQuery({
    queryKey: ['prospecting-ads-insight-queries'],
    queryFn: () => prospectingAdsService.listAdsInsightQueries(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!selectedQueryId && queriesQuery.data?.[0]?.id) {
      setSelectedQueryId(queriesQuery.data[0].id);
    }
  }, [queriesQuery.data, selectedQueryId]);

  const selectedQuery =
    queriesQuery.data?.find((query) => query.id === selectedQueryId) ?? null;

  const resultsQuery = useQuery({
    queryKey: ['prospecting-ads-insight-results', selectedQueryId],
    enabled: !!selectedQueryId,
    queryFn: () => prospectingAdsService.listAdsInsightResults(selectedQueryId!),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createQueryMutation = useMutation({
    mutationFn: () =>
      prospectingAdsService.createAdsInsightQuery({
        segment: form.segment.trim(),
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country.trim() || undefined,
        ageRange: form.ageRange.trim() || undefined,
        gender: form.gender.trim() || undefined,
        interest: form.interest.trim() || undefined,
      }),
    onSuccess: async (query) => {
      await queryClient.invalidateQueries({
        queryKey: ['prospecting-ads-insight-queries'],
      });
      setSelectedQueryId(query.id);
      setCreateOpen(false);
      setForm({
        segment: '',
        city: '',
        state: '',
        country: 'BR',
        ageRange: '',
        gender: '',
        interest: '',
      });
      toast({
        title: 'Consulta de demanda criada',
        description: 'Os insights do Google Ads foram atualizados para esse segmento.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao gerar insights',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel consultar os insights do Google Ads agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const queries = queriesQuery.data ?? [];
  const results = resultsQuery.data ?? [];

  const summary = useMemo(() => {
    const demand = results.find((item) => item.resultType === 'DEMAND_ESTIMATE');
    const topInterest = results.find((item) => item.resultType === 'INTEREST');
    const topRegion = results.find((item) => item.resultType === 'REGION');
    const topTheme = results.find((item) => item.resultType === 'KEYWORD_THEME');

    return {
      demand,
      topInterest,
      topRegion,
      topTheme,
    };
  }, [results]);

  return {
    createOpen,
    setCreateOpen,
    selectedQueryId,
    setSelectedQueryId,
    selectedQuery,
    queries,
    results,
    summary,
    form,
    queriesQuery,
    resultsQuery,
    createQueryMutation,
    updateForm<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
      setForm((current) => ({ ...current, [field]: value }));
    },
    submit() {
      if (!form.segment.trim()) {
        toast({
          title: 'Defina o segmento',
          description: 'Informe o tema ou segmento para consultar a demanda.',
          variant: 'destructive',
        });
        return;
      }

      createQueryMutation.mutate();
    },
  };
}
