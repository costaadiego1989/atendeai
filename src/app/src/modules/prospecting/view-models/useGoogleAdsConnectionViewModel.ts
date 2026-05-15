import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { prospectingAdsService } from '@/modules/prospecting/services/prospecting-ads-service';

const GOOGLE_ADS_OAUTH_EVENT = 'atendeai-google-ads-oauth';

export function useGoogleAdsConnectionViewModel() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['google-ads-connection-status'],
    queryFn: () => prospectingAdsService.getGoogleAdsConnectionStatus(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const accountsQuery = useQuery({
    queryKey: ['google-ads-connection-accounts'],
    enabled:
      statusQuery.data?.connected === true &&
      statusQuery.data?.accountSelected === false,
    queryFn: () => prospectingAdsService.listGoogleAdsAccounts(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const refreshConnectionData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['google-ads-connection-status'] }),
      queryClient.invalidateQueries({ queryKey: ['google-ads-connection-accounts'] }),
    ]);
  };

  const startMutation = useMutation({
    mutationFn: () => prospectingAdsService.startGoogleAdsConnection(),
    onSuccess: (result) => {
      const popup = window.open(
        result.authorizationUrl,
        'google-ads-oauth',
        'width=640,height=760,menubar=no,toolbar=no,status=no',
      );

      if (!popup) {
        toast({
          title: 'Popup bloqueado',
          description:
            'Permita popups para concluir a conexão com Google Ads.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar conexão',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível iniciar a conexão com Google Ads.',
        }),
        variant: 'destructive',
      });
    },
  });

  const selectAccountMutation = useMutation({
    mutationFn: (customerId: string) =>
      prospectingAdsService.selectGoogleAdsAccount(customerId),
    onSuccess: async () => {
      await refreshConnectionData();
      toast({
        title: 'Conta selecionada',
        description: 'A conta Google Ads foi vinculada ao tenant.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao selecionar conta',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage:
            'não foi possível selecionar a conta Google Ads agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => prospectingAdsService.disconnectGoogleAdsConnection(),
    onSuccess: async () => {
      await refreshConnectionData();
      toast({
        title: 'Google Ads desconectado',
        description: 'A conexão foi removida deste tenant.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao desconectar',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível desconectar o Google Ads agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== GOOGLE_ADS_OAUTH_EVENT) {
        return;
      }

      if (data.success) {
        void refreshConnectionData();
        toast({
          title: 'Google Ads conectado',
          description:
            'Agora escolha a conta que sera usada pela prospecção.',
        });
        return;
      }

      toast({
        title: 'Falha ao conectar Google Ads',
        description: data.message || 'não foi possível concluir a autorização.',
        variant: 'destructive',
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const status = statusQuery.data;
    const accounts = accountsQuery.data;
    if (
      status?.connected &&
      !status.accountSelected &&
      accounts &&
      accounts.length === 1 &&
      !selectAccountMutation.isPending
    ) {
      selectAccountMutation.mutate(accounts[0].customerId);
    }
  }, [accountsQuery.data, selectAccountMutation, statusQuery.data]);

  return {
    statusQuery,
    accountsQuery,
    startMutation,
    selectAccountMutation,
    disconnectMutation,
    connection: statusQuery.data,
    accounts: accountsQuery.data ?? [],
    startConnection() {
      startMutation.mutate();
    },
    selectAccount(customerId: string) {
      selectAccountMutation.mutate(customerId);
    },
    disconnect() {
      disconnectMutation.mutate();
    },
  };
}
