import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { resolveFeedbackAppModule } from '@/shared/constants/feedback-app-module';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  supportService,
  type CreateSupportFeedbackInput,
} from '@/modules/support/services/support-service';

const DEFAULT_FORM: CreateSupportFeedbackInput = {
  type: 'BUG',
  title: '',
  description: '',
  pagePath: '',
};

export function useSupportPageViewModel() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const currentAppModule = useMemo(
    () => resolveFeedbackAppModule(location.pathname),
    [location.pathname],
  );
  const [form, setForm] = useState<CreateSupportFeedbackInput>(DEFAULT_FORM);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUG' | 'SUGGESTION' | 'IMPROVEMENT'>('ALL');

  const feedbacksQuery = useQuery({
    queryKey: ['support-feedbacks', activeBranchId],
    queryFn: () => supportService.listFeedbacks(activeBranchId ?? undefined),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      supportService.createFeedback({
        ...form,
        branchId: activeBranchId ?? undefined,
        pagePath: form.pagePath?.trim() || location.pathname,
        appModule: currentAppModule.code,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['support-feedbacks'] });
      setForm(DEFAULT_FORM);
      toast({
        title: 'Feedback enviado',
        description: 'Obrigado. O feedback foi registrado para o time técnico.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao enviar feedback',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível registrar o feedback agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const allFeedbacks = feedbacksQuery.data ?? [];

  const filteredFeedbacks = useMemo(() => {
    return allFeedbacks.filter((item) => {
      const matchesSearch =
        !search.trim() ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [allFeedbacks, search, typeFilter]);

  const summary = useMemo(
    () => ({
      total: allFeedbacks.length,
      bugs: allFeedbacks.filter((item) => item.type === 'BUG').length,
      suggestions: allFeedbacks.filter((item) => item.type === 'SUGGESTION').length,
      improvements: allFeedbacks.filter((item) => item.type === 'IMPROVEMENT').length,
    }),
    [allFeedbacks],
  );

  return {
    form,
    setForm,
    feedbacks: filteredFeedbacks,
    summary,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    feedbacksQuery,
    createMutation,
    currentAppModule,
    submitCreate() {
      createMutation.mutate();
    },
  };
}
