import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { formatPhone, normalizeBrazilPhone } from '@/shared/lib/masks';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  channelsService,
  type InstagramMetaDiscoveredAccount,
  type RegisterTwilioSenderInput,
} from '@/modules/settings/services/channels-service';
import { startTwilioEmbeddedSignup } from '@/modules/settings/services/twilio-embedded-signup';
import { useCompanySettingsQuery } from '@/modules/settings/view-models/useCompanySettingsQuery';

const META_INSTAGRAM_OAUTH_EVENT = 'atendeai-meta-instagram-oauth';

type ChannelScope = {
  id: string;
  type: 'TENANT' | 'BRANCH';
  branchId: string | null;
  label: string;
  subtitle: string;
  whatsappNumber?: string | null;
  instagramAccountId?: string | null;
  whatsappProvider?: string | null;
  whatsappStatus?: string | null;
  whatsappConnected: boolean;
  instagramConnected: boolean;
};

const TENANT_SCOPE_ID = '__tenant__';

export function useChannelsSettingsViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [selectedScopeId, setSelectedScopeId] = useState<string>(
    activeBranchId ?? TENANT_SCOPE_ID,
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [instagramAccountId, setInstagramAccountId] = useState('');
  const [instagramAccounts, setInstagramAccounts] = useState<
    InstagramMetaDiscoveredAccount[]
  >([]);

  const companySettingsQuery = useCompanySettingsQuery(tenantId);
  const normalizedPhoneNumber = normalizeBrazilPhone(phoneNumber);

  const scopes = useMemo<ChannelScope[]>(() => {
    const data = companySettingsQuery.data;
    if (!data) {
      return [];
    }

    const tenantScope: ChannelScope = {
      id: TENANT_SCOPE_ID,
      type: 'TENANT',
      branchId: null,
      label: 'Matriz',
      subtitle: 'Canal principal da empresa',
      whatsappNumber: data.channels?.whatsapp?.whatsappNumber ?? null,
      instagramAccountId: data.channels?.instagram?.instagramAccountId ?? null,
      whatsappProvider: data.channels?.whatsapp?.provider ?? null,
      whatsappStatus: data.channels?.whatsapp?.status ?? null,
      whatsappConnected: data.channels?.whatsapp?.connected ?? false,
      instagramConnected: data.channels?.instagram?.connected ?? false,
    };

    const branchScopes: ChannelScope[] = (data.branches ?? []).map((branch) => ({
      id: branch.id,
      type: 'BRANCH',
      branchId: branch.id,
      label: branch.name,
      subtitle: branch.isHeadquarters ? 'Filial principal' : 'Escopo local da filial',
      whatsappNumber: branch.whatsappNumber ?? null,
      instagramAccountId: branch.instagramAccountId ?? null,
      whatsappProvider: branch.whatsAppConfigOverride?.provider ?? null,
      whatsappStatus:
        branch.whatsAppConfigOverride?.credentials?.senderStatus ?? null,
      whatsappConnected:
        branch.whatsAppConfigOverride?.provider === 'TWILIO' &&
        branch.whatsAppConfigOverride?.credentials?.senderStatus === 'ACTIVE',
      instagramConnected: Boolean(branch.instagramAccountId),
    }));

    return [tenantScope, ...branchScopes];
  }, [companySettingsQuery.data]);

  useEffect(() => {
    if (!scopes.length) {
      return;
    }

    if (!scopes.some((scope) => scope.id === selectedScopeId)) {
      setSelectedScopeId(activeBranchId ?? TENANT_SCOPE_ID);
    }
  }, [activeBranchId, scopes, selectedScopeId]);

  const selectedScope =
    scopes.find((scope) => scope.id === selectedScopeId) ?? scopes[0] ?? null;
  const selectedBranchId =
    selectedScope?.type === 'BRANCH' ? selectedScope.branchId : null;

  const connectionQuery = useQuery({
    queryKey: ['whatsapp-connection', tenantId, selectedBranchId],
    queryFn: () =>
      channelsService.getWhatsAppConnection(tenantId as string, selectedBranchId),
    enabled: Boolean(tenantId && selectedScope),
  });

  useEffect(() => {
    setPhoneNumber(
      formatPhone(
        connectionQuery.data?.connection?.whatsappNumber ??
        selectedScope?.whatsappNumber ??
        '',
      ),
    );
    setInstagramAccountId(selectedScope?.instagramAccountId ?? '');
    setInstagramAccounts([]);
    setVerificationCode('');
  }, [
    connectionQuery.data?.connection?.whatsappNumber,
    selectedScope?.id,
    selectedScope?.instagramAccountId,
    selectedScope?.whatsappNumber,
  ]);

  const invalidateChannelsData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connection', tenantId] }),
      queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] }),
    ]);
  };

  const registerMutation = useMutation({
    mutationFn: (input: RegisterTwilioSenderInput) =>
      channelsService.registerTwilioSender(tenantId as string, input),
    onSuccess: async (result) => {
      await invalidateChannelsData();
      toast({
        title: 'Onboarding iniciado',
        description:
          result.verificationRequired
            ? 'O sender foi criado. Se o número precisar de OTP, informe o codigo recebido para concluir.'
            : 'O sender Twilio foi criado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar onboarding',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível iniciar a conexão do WhatsApp agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const startEmbeddedSignupMutation = useMutation({
    mutationFn: async (input: Omit<RegisterTwilioSenderInput, 'wabaId'>) => {
      const embeddedSignup = connectionQuery.data?.embeddedSignup;
      if (
        !embeddedSignup?.appId ||
        !embeddedSignup.configurationId ||
        !embeddedSignup.solutionId
      ) {
        throw new Error(
          'O Embedded Signup da Twilio ainda não foi configurado no workspace.',
        );
      }

      const signupResult = await startTwilioEmbeddedSignup({
        appId: embeddedSignup.appId,
        configurationId: embeddedSignup.configurationId,
        solutionId: embeddedSignup.solutionId,
      });

      return channelsService.registerTwilioSender(tenantId as string, {
        ...input,
        phoneNumber: normalizedPhoneNumber,
        branchId: selectedBranchId ?? undefined,
        wabaId: signupResult.wabaId,
      });
    },
    onSuccess: async (result) => {
      await invalidateChannelsData();
      setPhoneNumber(formatPhone(result.whatsappNumber));
      toast({
        title: 'Onboarding iniciado',
        description:
          result.verificationRequired
            ? 'O Facebook concluiu a conexão. Se a Twilio pedir OTP, informe o codigo recebido para concluir.'
            : 'O sender Twilio foi criado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao conectar WhatsApp',
        description:
          error instanceof Error && error.message
            ? error.message
            : getFriendlyErrorMessage(error, {
              fallbackMessage: 'não foi possível iniciar a conexão do WhatsApp agora.',
            }),
        variant: 'destructive',
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) =>
      channelsService.verifyTwilioSender(
        tenantId as string,
        code,
        selectedBranchId,
      ),
    onSuccess: async (result) => {
      await invalidateChannelsData();
      const isConnected = result.status === 'ACTIVE' || result.status === 'ONLINE';
      toast({
        title: isConnected ? 'WhatsApp conectado' : 'Codigo enviado',
        description:
          isConnected
            ? 'O número foi verificado e ja esta pronto para uso.'
            : 'O sender ainda esta em verificação. Atualize o status em instantes.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao verificar codigo',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível validar o codigo OTP agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      channelsService.refreshTwilioSenderStatus(
        tenantId as string,
        selectedBranchId,
      ),
    onSuccess: async () => {
      await invalidateChannelsData();
      toast({
        title: 'Status atualizado',
        description: 'Consultamos a Twilio e atualizamos o estado do sender.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar status',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível consultar o status do sender agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const configureInstagramMutation = useMutation({
    mutationFn: (accountId: string) =>
      channelsService.configureInstagram(tenantId as string, {
        instagramAccountId: accountId,
        branchId: selectedBranchId ?? undefined,
      }),
    onSuccess: async () => {
      await invalidateChannelsData();
      toast({
        title: 'Instagram configurado',
        description: 'A conta da Meta foi vinculada a este escopo operacional.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao configurar Instagram',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível salvar a configuração do Instagram agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const startInstagramMetaConnectionMutation = useMutation({
    mutationFn: () =>
      channelsService.startInstagramMetaConnection(selectedBranchId),
    onSuccess: (result) => {
      const popup = window.open(
        result.authorizationUrl,
        'meta-instagram-oauth',
        'width=640,height=760,menubar=no,toolbar=no,status=no',
      );

      if (!popup) {
        toast({
          title: 'Popup bloqueado',
          description:
            'Permita popups para concluir a conexão com Meta/Facebook.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar Meta',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível iniciar a conexão com Meta agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== META_INSTAGRAM_OAUTH_EVENT) {
        return;
      }

      if ((data.branchId ?? null) !== (selectedBranchId ?? null)) {
        toast({
          title: 'Escopo alterado durante a conexão',
          description:
            'Abra novamente a conexão da Meta no escopo atual para evitar vincular a conta no lugar errado.',
          variant: 'destructive',
        });
        return;
      }

      if (!data.success) {
        toast({
          title: 'Falha ao conectar Instagram',
          description:
            data.message || 'não foi possível concluir a autorização na Meta.',
          variant: 'destructive',
        });
        return;
      }

      const discoveredAccounts = Array.isArray(data.accounts)
        ? (data.accounts as InstagramMetaDiscoveredAccount[])
        : [];

      if (!discoveredAccounts.length) {
        setInstagramAccounts([]);
        toast({
          title: 'Nenhuma conta encontrada',
          description:
            'A Meta autorizou o acesso, mas nenhuma conta do Instagram Business foi localizada neste login.',
          variant: 'destructive',
        });
        return;
      }

      setInstagramAccounts(discoveredAccounts);

      if (discoveredAccounts.length === 1) {
        const [singleAccount] = discoveredAccounts;
        setInstagramAccountId(singleAccount.instagramAccountId);
        configureInstagramMutation.mutate(singleAccount.instagramAccountId);
        return;
      }

      setInstagramAccountId(discoveredAccounts[0].instagramAccountId);
      toast({
        title: 'Escolha a conta do Instagram',
        description:
          'Encontramos mais de uma conta. Selecione a correta para este escopo.',
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [configureInstagramMutation, selectedBranchId]);

  const connection = connectionQuery.data?.connection;
  const embeddedSignupReady =
    connectionQuery.data?.embeddedSignupReady &&
    !!connectionQuery.data?.embeddedSignup?.appId &&
    !!connectionQuery.data?.embeddedSignup?.configurationId &&
    !!connectionQuery.data?.embeddedSignup?.solutionId;
  const requiresVerification =
    connection?.provider === 'TWILIO' &&
    connection?.status === 'PENDING_VERIFICATION';
  const stats = {
    totalScopes: scopes.length,
    whatsappConnectedCount: scopes.filter((scope) => scope.whatsappConnected).length,
    instagramConnectedCount: scopes.filter((scope) => scope.instagramConnected).length,
  };

  return {
    tenantId,
    companySettingsQuery,
    connectionQuery,
    scopes,
    selectedScope,
    selectedScopeId,
    setSelectedScopeId,
    selectedBranchId,
    registerMutation,
    startEmbeddedSignupMutation,
    verifyMutation,
    refreshMutation,
    configureInstagramMutation,
    startInstagramMetaConnectionMutation,
    phoneNumber,
    setPhoneNumber(value: string) {
      setPhoneNumber(formatPhone(value));
    },
    normalizedPhoneNumber,
    verificationCode,
    setVerificationCode,
    instagramAccountId,
    setInstagramAccountId,
    instagramAccounts,
    connection,
    embeddedSignupReady,
    requiresVerification,
    isConnected: connection?.status === 'ACTIVE',
    stats,
  };
}
