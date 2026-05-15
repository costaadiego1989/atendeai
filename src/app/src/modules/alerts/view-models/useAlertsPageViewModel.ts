import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useCompanySettingsQuery } from '@/modules/settings/view-models/useCompanySettingsQuery';
import {
  alertsService,
  type CreateAlertReminderInput,
} from '@/modules/alerts/services/alerts-service';

function resolveAlertTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

export const DEFAULT_FORM: CreateAlertReminderInput = {
  title: '',
  message: '',
  frequency: 'ONCE',
  scheduledAt: '',
  timeOfDay: '09:00',
};

export function useAlertsPageViewModel() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const [form, setForm] = useState<CreateAlertReminderInput>(DEFAULT_FORM);
  const tenantSettingsQuery = useCompanySettingsQuery(tenant?.id);

  const remindersQuery = useQuery({
    queryKey: ['alert-reminders', activeBranchId],
    queryFn: () => alertsService.listReminders(activeBranchId ?? undefined),
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'SENT'>('ALL');

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['alert-reminders'] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      alertsService.createReminder({
        ...form,
        branchId: activeBranchId ?? undefined,
        scheduledAt: form.frequency === 'ONCE' ? form.scheduledAt || undefined : undefined,
        timeOfDay: form.frequency === 'DAILY' ? form.timeOfDay || undefined : undefined,
        timezone: resolveAlertTimezone(),
      }),
    onSuccess: async () => {
      await invalidate();
      setForm(DEFAULT_FORM);
      toast({
        title: 'Lembrete criado',
        description: 'O alerta foi agendado para o seu proprio WhatsApp.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar alerta',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível criar o alerta agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      reminderId,
      status,
    }: {
      reminderId: string;
      status: 'ACTIVE' | 'PAUSED';
    }) => alertsService.updateReminder(reminderId, { status }),
    onSuccess: async (_, variables) => {
      await invalidate();
      toast({
        title:
          variables.status === 'PAUSED' ? 'Alerta pausado' : 'Alerta reativado',
        description:
          variables.status === 'PAUSED'
            ? 'O lembrete não vai mais disparar ate ser retomado.'
            : 'O lembrete voltou para a agenda de envios.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar alerta',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível atualizar o alerta agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (reminderId: string) => alertsService.deleteReminder(reminderId),
    onSuccess: async () => {
      await invalidate();
      toast({
        title: 'Alerta removido',
        description: 'O lembrete foi excluido da sua agenda.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao excluir alerta',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível excluir o alerta agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const allReminders = remindersQuery.data ?? [];
  const filteredReminders = useMemo(() => {
    return allReminders.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.message.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allReminders, search, statusFilter]);

  const resolvedPhone =
    user?.phone ?? tenantSettingsQuery.data?.owner?.phone ?? undefined;
  const summary = useMemo(
    () => ({
      total: allReminders.length,
      active: allReminders.filter((item) => item.status === 'ACTIVE').length,
      paused: allReminders.filter((item) => item.status === 'PAUSED').length,
      sent: allReminders.filter((item) => item.status === 'SENT').length,
    }),
    [allReminders],
  );

  return {
    user,
    tenant,
    resolvedPhone,
    tenantSettingsQuery,
    form,
    setForm,
    reminders: filteredReminders,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    summary,
    remindersQuery,
    createMutation,
    updateStatusMutation,
    deleteMutation,
    submitCreate() {
      createMutation.mutate();
    },
    toggleReminder(reminderId: string, active: boolean) {
      updateStatusMutation.mutate({
        reminderId,
        status: active ? 'PAUSED' : 'ACTIVE',
      });
    },
    removeReminder(reminderId: string) {
      deleteMutation.mutate(reminderId);
    },
  };
}
