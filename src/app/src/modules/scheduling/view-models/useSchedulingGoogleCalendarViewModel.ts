import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { schedulingService } from '@/modules/scheduling/services/scheduling-service';
import { useAuthStore } from '@/shared/stores/auth-store';

const GOOGLE_CALENDAR_OAUTH_EVENT = 'atendeai-google-calendar-oauth';

export function useSchedulingGoogleCalendarViewModel() {
  const queryClient = useQueryClient();
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const activeBranchName =
    tenant?.branches?.find((branch) => branch.id === activeBranchId)?.name ?? null;

  const statusQuery = useQuery({
    queryKey: ['scheduling-google-calendar-connection-status', tenant?.id, activeBranchId],
    enabled: Boolean(tenant?.id),
    queryFn: () => schedulingService.getGoogleCalendarConnectionStatus(activeBranchId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const calendarsQuery = useQuery({
    queryKey: ['scheduling-google-calendar-calendars', tenant?.id, activeBranchId],
    enabled: Boolean(tenant?.id) && statusQuery.data?.connected === true,
    queryFn: () => schedulingService.listGoogleCalendars(activeBranchId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const refreshConnectionData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['scheduling-google-calendar-connection-status'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['scheduling-google-calendar-calendars'],
      }),
    ]);
  };

  const startMutation = useMutation({
    mutationFn: () => schedulingService.startGoogleCalendarConnection(activeBranchId),
    onSuccess: (result) => {
      const popup = window.open(
        result.authorizationUrl,
        'google-calendar-oauth',
        'width=640,height=760,menubar=no,toolbar=no,status=no',
      );

      if (!popup) {
        toast({
          title: 'Popup bloqueado',
          description: 'Permita popups para concluir a conexão com Google Calendar.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar conexão',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível iniciar a conexão com Google Calendar.',
        }),
        variant: 'destructive',
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => schedulingService.disconnectGoogleCalendarConnection(activeBranchId),
    onSuccess: async () => {
      await refreshConnectionData();
      toast({
        title: 'Google Calendar desconectado',
        description: 'A conexão foi removida desta agenda.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao desconectar',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível desconectar o Google Calendar agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const selectCalendarMutation = useMutation({
    mutationFn: (calendarId: string) =>
      schedulingService.selectGoogleCalendar(calendarId, activeBranchId),
    onSuccess: async () => {
      await refreshConnectionData();
      toast({
        title: 'Calendario selecionado',
        description: 'A agenda passara a sincronizar novas reservas no calendario escolhido.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao selecionar calendario',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível selecionar o calendario agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== GOOGLE_CALENDAR_OAUTH_EVENT) {
        return;
      }

      if (data.success) {
        void refreshConnectionData();
        toast({
          title: 'Google Calendar conectado',
          description: 'As reservas da agenda ja podem ser sincronizadas no calendario.',
        });
        return;
      }

      toast({
        title: 'Falha ao conectar Google Calendar',
        description: data.message || 'não foi possível concluir a autorização.',
        variant: 'destructive',
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return {
    statusQuery,
    calendarsQuery,
    startMutation,
    disconnectMutation,
    selectCalendarMutation,
    connection: statusQuery.data,
    calendars: calendarsQuery.data ?? [],
    activeBranchId,
    activeBranchName,
    startConnection() {
      startMutation.mutate();
    },
    selectCalendar(calendarId: string) {
      selectCalendarMutation.mutate(calendarId);
    },
    disconnect() {
      disconnectMutation.mutate();
    },
  };
}
