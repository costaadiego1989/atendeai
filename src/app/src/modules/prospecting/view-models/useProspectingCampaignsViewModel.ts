import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import type {
  ContactStage,
  ProspectCampaignAudienceType,
  ProspectCampaignChannel,
  ProspectingAsyncJob,
} from '@/shared/types';
import { contactsService } from '@/modules/contacts/services/contacts-service';
import { prospectingCampaignService } from '@/modules/prospecting/services/prospecting-campaign-service';
import { prospectingService } from '@/modules/prospecting/services/prospecting-service';
import { prospectMessageHasNameTokens } from '@/modules/prospecting/utils/prospect-message-template';

export function useProspectingCampaignsViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'ALL' | ContactStage>('ALL');
  const [reportFilters, setReportFilters] = useState({
    query: '',
    statuses: [] as Array<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'>,
    channels: [] as Array<'WHATSAPP' | 'INSTAGRAM'>,
    audienceTypes: [] as Array<'REENGAGEMENT' | 'CONTACT_LIST'>,
    dateFrom: '',
    dateTo: '',
  });
  const [currentReportJobId, setCurrentReportJobId] = useState<string | null>(null);
  const [lastDispatchedConversationId, setLastDispatchedConversationId] = useState<string | null>(null);
  const handledReportJobsRef = useRef<Record<string, string>>({});
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    objective: '',
    audienceType: 'CONTACT_LIST' as ProspectCampaignAudienceType,
    channels: ['WHATSAPP'] as ProspectCampaignChannel[],
    messageTemplate: '',
    dailyLimit: '50',
    targetContactIds: [] as string[],
  });

  const campaignsQuery = useQuery({
    queryKey: ['prospecting-campaigns', tenant?.id, activeBranchId ?? 'tenant'],
    enabled: !!tenant?.id,
    queryFn: () => prospectingCampaignService.listCampaigns(activeBranchId),
  });

  const contactsQuery = useQuery({
    queryKey: ['prospecting-campaign-contacts', tenant?.id, activeBranchId ?? 'tenant'],
    enabled: !!tenant?.id && createOpen,
    queryFn: () =>
      contactsService.listContacts(tenant!.id, {
        page: 1,
        limit: 200,
        branchId: activeBranchId ?? undefined,
      }),
  });

  const jobsQuery = useQuery({
    queryKey: ['prospecting-async-jobs', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: () => prospectingService.listAsyncJobs(),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const jobs = (query.state.data ?? []) as ProspectingAsyncJob[];
      return jobs.some((job) => job.status === 'QUEUED' || job.status === 'PROCESSING')
        ? 3000
        : false;
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const channels = campaignForm.channels.length
        ? campaignForm.channels
        : (['WHATSAPP'] as ProspectCampaignChannel[]);

      return Promise.all(
        channels.map((channel) =>
          prospectingCampaignService.createCampaign({
            name:
              channels.length > 1
                ? `${campaignForm.name.trim()} • ${channel === 'INSTAGRAM' ? 'Instagram' : 'WhatsApp'}`
                : campaignForm.name.trim(),
            objective: campaignForm.objective.trim(),
            audienceType: campaignForm.audienceType,
            channel,
            targetContactIds:
              campaignForm.audienceType === 'CONTACT_LIST'
                ? campaignForm.targetContactIds
                : undefined,
            messageTemplate: campaignForm.messageTemplate.trim() || undefined,
            dailyLimit: Number(campaignForm.dailyLimit) || 50,
          }),
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prospecting-campaigns'] });
      setCreateOpen(false);
      setContactSearch('');
      setStageFilter('ALL');
      setCampaignForm({
        name: '',
        objective: '',
        audienceType: 'CONTACT_LIST',
        channels: ['WHATSAPP'],
        messageTemplate: '',
        dailyLimit: '50',
        targetContactIds: [],
      });
      toast({
        title: 'Campanha criada',
        description: 'A campanha foi salva e ja pode ser ativada ou iniciada.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar campanha',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível criar a campanha agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const suggestMessageMutation = useMutation({
    mutationFn: () =>
      prospectingCampaignService.suggestCampaignMessage({
        branchId: activeBranchId,
        objective: campaignForm.objective.trim(),
        audienceType: campaignForm.audienceType,
        channels: campaignForm.channels,
        stageFilter: stageFilter === 'ALL' ? undefined : stageFilter,
        searchTerm: contactSearch.trim() || undefined,
        selectedCount: campaignForm.targetContactIds.length,
        selectedContacts: contacts
          .filter((contact) => campaignForm.targetContactIds.includes(contact.id))
          .slice(0, 10)
          .map((contact) => ({
            name: contact.name,
            stage: contact.stage,
            phone: contact.phone,
            email: contact.email,
          })),
      }),
    onSuccess: (result) => {
      setCampaignForm((current) => ({
        ...current,
        messageTemplate: result.messageTemplate,
      }));
      toast({
        title: 'Mensagem sugerida',
        description: 'A IA montou um texto inicial com base no público e no objetivo selecionados.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao gerar mensagem',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível gerar a mensagem agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const activateCampaignMutation = useMutation({
    mutationFn: (campaignId: string) =>
      prospectingCampaignService.activateCampaign(campaignId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prospecting-campaigns'] });
      toast({
        title: 'Campanha ativada',
        description: 'A campanha agora esta pronta para iniciar os disparos.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao ativar campanha',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível ativar a campanha agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: (campaignId: string) =>
      prospectingCampaignService.pauseCampaign(campaignId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prospecting-campaigns'] });
      toast({
        title: 'Campanha pausada',
        description: 'Os novos disparos foram interrompidos.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao pausar campanha',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível pausar a campanha agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const startCampaignMutation = useMutation({
    mutationFn: (campaignId: string) =>
      prospectingCampaignService.startCampaign(campaignId),
    onSuccess: (result) => {
      toast({
        title: 'Disparos iniciados',
        description: `${result.createdExecutions} novos contatos entraram no fluxo da campanha.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar campanha',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível iniciar os disparos agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const dispatchNextCampaignMutation = useMutation({
    mutationFn: (campaignId: string) =>
      prospectingCampaignService.dispatchNextCampaignExecution(campaignId),
    onSuccess: async (result) => {
      setLastDispatchedConversationId(result.conversationId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prospecting-campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['conversations', tenant?.id] }),
      ]);
      toast({
        title: 'Mensagem enviada',
        description:
          result.remainingPendingExecutions > 0
            ? `A conversa foi iniciada. Restam ${result.remainingPendingExecutions} contatos pendentes nessa campanha.`
            : 'A conversa foi iniciada e não restam contatos pendentes nessa campanha.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao enviar próxima mensagem',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível enviar a próxima mensagem agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const campaigns = campaignsQuery.data ?? [];
  const contacts = contactsQuery.data?.data ?? [];

  const filteredContacts = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesStage = stageFilter === 'ALL' || contact.stage === stageFilter;
      const matchesSearch =
        !term ||
        contact.name.toLowerCase().includes(term) ||
        contact.phone.toLowerCase().includes(term) ||
        (contact.email ?? '').toLowerCase().includes(term);

      return matchesStage && matchesSearch;
    });
  }, [contactSearch, contacts, stageFilter]);

  const visibleContacts = filteredContacts.slice(0, 10);

  const metrics = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'ACTIVE').length;
    const draftCampaigns = campaigns.filter((campaign) => campaign.status === 'DRAFT').length;
    const pausedCampaigns = campaigns.filter((campaign) => campaign.status === 'PAUSED').length;
    const totalAudience = campaigns.reduce(
      (accumulator, campaign) => accumulator + campaign.targetContactIds.length,
      0,
    );

    return {
      totalCampaigns,
      activeCampaigns,
      draftCampaigns,
      pausedCampaigns,
      totalAudience,
    };
  }, [campaigns]);

  const activeReportJob = useMemo(
    () =>
      (jobsQuery.data ?? []).find(
        (job) =>
          job.id === currentReportJobId && job.type === 'EXPORT_PROSPECT_CAMPAIGNS_CSV',
      ) ?? null,
    [currentReportJobId, jobsQuery.data],
  );

  const activeJobItems = useMemo<AsyncOperationItem[]>(
    () =>
      (jobsQuery.data ?? [])
        .filter(
          (job) =>
            job.type === 'EXPORT_PROSPECT_CAMPAIGNS_CSV' &&
            (job.status === 'QUEUED' || job.status === 'PROCESSING'),
        )
        .map((job) => ({
          id: job.id,
          title: 'Exportação de campanhas',
          description:
            'Estamos consolidando campanhas, publico e execucoes para montar o CSV.',
          status: job.status,
          progress: job.progress,
          processedItems: job.processedItems,
          totalItems: job.totalItems,
        })),
    [jobsQuery.data],
  );

  useEffect(() => {
    if (!activeReportJob || handledReportJobsRef.current[activeReportJob.id] === activeReportJob.status) {
      return;
    }

    if (activeReportJob.status === 'COMPLETED') {
      handledReportJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentReportJobId(null);

      void prospectingService
        .downloadAsyncJobFile(activeReportJob.id, activeReportJob.fileName ?? undefined)
        .then(() => {
          toast({
            title: 'CSV de campanhas exportado',
            description:
              Number(activeReportJob.resultSummary?.totalCampaigns ?? 0) > 0
                ? `${Number(activeReportJob.resultSummary?.totalCampaigns ?? 0)} campanhas foram incluidas no arquivo.`
                : 'O arquivo foi gerado sem campanhas para os filtros escolhidos.',
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
      handledReportJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentReportJobId(null);
      toast({
        title: 'Falha ao exportar campanhas',
        description:
          activeReportJob.errorMessage ?? 'não foi possível gerar o CSV deste Relatório.',
        variant: 'destructive',
      });
    }
  }, [activeReportJob]);

  const generateReportMutation = useMutation({
    mutationFn: () =>
      prospectingService.startCampaignReportJob({
        query: reportFilters.query.trim() || undefined,
        statuses: reportFilters.statuses,
        channels: reportFilters.channels,
        audienceTypes: reportFilters.audienceTypes,
        dateFrom: reportFilters.dateFrom || undefined,
        dateTo: reportFilters.dateTo || undefined,
      }),
    onSuccess: async (job) => {
      setCurrentReportJobId(job.id);
      setReportsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['prospecting-async-jobs', tenant?.id] });
      toast({
        title: 'Relatorio enfileirado',
        description:
          'Vamos processar as campanhas em segundo plano e iniciar o download quando o CSV ficar pronto.',
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

  return {
    tenant,
    createOpen,
    setCreateOpen,
    reportsOpen,
    setReportsOpen,
    contactSearch,
    setContactSearch,
    stageFilter,
    setStageFilter,
    campaigns,
    contacts,
    filteredContacts,
    visibleContacts,
    campaignsQuery,
    contactsQuery,
    jobsQuery,
    campaignForm,
    metrics,
    reportFilters,
    setReportFilters,
    activeReportJob,
    activeJobItems,
    createCampaignMutation,
    suggestMessageMutation,
    activateCampaignMutation,
    pauseCampaignMutation,
    startCampaignMutation,
    generateReportMutation,
    updateCampaignForm<K extends keyof typeof campaignForm>(
      field: K,
      value: (typeof campaignForm)[K],
    ) {
      setCampaignForm((current) => ({ ...current, [field]: value }));
    },
    toggleChannel(channel: ProspectCampaignChannel) {
      setCampaignForm((current) => {
        const exists = current.channels.includes(channel);
        if (exists) {
          const nextChannels = current.channels.filter((item) => item !== channel);
          return {
            ...current,
            channels: nextChannels.length ? nextChannels : current.channels,
          };
        }

        return {
          ...current,
          channels: [...current.channels, channel],
        };
      });
    },
    toggleTargetContact(contactId: string) {
      setCampaignForm((current) => ({
        ...current,
        targetContactIds: current.targetContactIds.includes(contactId)
          ? current.targetContactIds.filter((id) => id !== contactId)
          : [...current.targetContactIds, contactId],
      }));
    },
    toggleAllVisibleContacts() {
      setCampaignForm((current) => {
        const visibleIds = visibleContacts.map((contact) => contact.id);
        const allVisibleSelected = visibleIds.every((id) =>
          current.targetContactIds.includes(id),
        );

        return {
          ...current,
          targetContactIds: allVisibleSelected
            ? current.targetContactIds.filter((id) => !visibleIds.includes(id))
            : [...new Set([...current.targetContactIds, ...visibleIds])],
        };
      });
    },
    submitCreateCampaign() {
      if (!campaignForm.name.trim() || !campaignForm.objective.trim()) {
        toast({
          title: 'Preencha a campanha',
          description: 'Nome e objetivo sao obrigatorios para criar a campanha.',
          variant: 'destructive',
        });
        return;
      }

      if (
        campaignForm.audienceType === 'CONTACT_LIST' &&
        campaignForm.targetContactIds.length === 0
      ) {
        toast({
          title: 'Selecione o publico',
          description: 'Escolha pelo menos um contato para campanhas por lista.',
          variant: 'destructive',
        });
        return;
      }

      if (campaignForm.channels.length === 0) {
        toast({
          title: 'Selecione o canal',
          description: 'Marque ao menos um canal para criar a campanha.',
          variant: 'destructive',
        });
        return;
      }

      const template = campaignForm.messageTemplate.trim();
      if (!template) {
        toast({
          title: 'Mensagem obrigatoria',
          description:
            'Defina o modelo da mensagem antes de criar a campanha; ele sera usado nos disparos.',
          variant: 'destructive',
        });
        return;
      }

      if (!prospectMessageHasNameTokens(template)) {
        toast({
          title: 'Personalização obrigatória',
          description:
            'Inclua {{first_name}} ou {{name}} na mensagem para alinhar com a validação do envio.',
          variant: 'destructive',
        });
        return;
      }

      createCampaignMutation.mutate();
    },
    suggestMessage() {
      if (!campaignForm.objective.trim()) {
        toast({
          title: 'Defina o objetivo',
          description: 'Informe o objetivo da campanha antes de pedir a sugestão de mensagem.',
          variant: 'destructive',
        });
        return;
      }

      if (
        campaignForm.audienceType === 'CONTACT_LIST' &&
        campaignForm.targetContactIds.length === 0
      ) {
        toast({
          title: 'Selecione o público',
          description: 'Escolha pelo menos um contato antes de gerar a mensagem com IA.',
          variant: 'destructive',
        });
        return;
      }

      suggestMessageMutation.mutate();
    },
    activateCampaign(campaignId: string) {
      activateCampaignMutation.mutate(campaignId);
    },
    pauseCampaign(campaignId: string) {
      pauseCampaignMutation.mutate(campaignId);
    },
    startCampaign(campaignId: string) {
      const campaign = campaigns.find((item) => item.id === campaignId);
      const template = campaign?.messageTemplate?.trim() ?? '';
      if (!template || !prospectMessageHasNameTokens(template)) {
        toast({
          title: 'Modelo de mensagem invalido',
          description:
            'Inclua {{first_name}} ou {{name}} no texto da campanha antes de iniciar os disparos.',
          variant: 'destructive',
        });
        return;
      }
      startCampaignMutation.mutate(campaignId);
    },
    dispatchNextCampaign(campaignId: string) {
      const campaign = campaigns.find((item) => item.id === campaignId);
      const template = campaign?.messageTemplate?.trim() ?? '';
      if (!template || !prospectMessageHasNameTokens(template)) {
        toast({
          title: 'Modelo de mensagem invalido',
          description:
            'O envio exige {{first_name}} ou {{name}} no modelo de mensagem da campanha.',
          variant: 'destructive',
        });
        return;
      }
      dispatchNextCampaignMutation.mutate(campaignId);
    },
    dispatchNextCampaignMutation,
    lastDispatchedConversationId,
    navigateToConversation(conversationId: string) {
      navigate(`/app/conversations/${conversationId}`);
    },
  };
}
