import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { ProspectCampaignChannel } from '@/shared/types';
import { prospectingAdsService } from '@/modules/prospecting/services/prospecting-ads-service';
import { prospectingCampaignService } from '@/modules/prospecting/services/prospecting-campaign-service';
import { prospectMessageHasNameTokens } from '@/modules/prospecting/utils/prospect-message-template';

export function useProspectingAdsLeadsViewModel() {
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    campaignName: '',
    importStatus: 'ALL',
    channel: 'WHATSAPP' as 'WHATSAPP' | 'INSTAGRAM',
    dateFrom: '',
    dateTo: '',
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [prospectOpen, setProspectOpen] = useState(false);
  const [form, setForm] = useState({
    campaignName: '',
    objective: '',
    channel: 'WHATSAPP' as ProspectCampaignChannel,
    messageTemplate: '',
  });

  const leadsQuery = useQuery({
    queryKey: ['prospecting-ads-leads', page, filters],
    queryFn: () =>
      prospectingAdsService.listAdsLeads({
        page,
        limit: 10,
        campaignName: filters.campaignName.trim() || undefined,
        importStatus:
          filters.importStatus === 'ALL' ? undefined : filters.importStatus,
        channel: filters.channel,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const syncMutation = useMutation({
    mutationFn: () => prospectingAdsService.syncAdsLeads(50),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['prospecting-ads-leads'] });
      toast({
        title: 'Leads sincronizados',
        description: `${result.syncedCount} leads do Google Ads foram atualizados.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao sincronizar leads',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível sincronizar os leads agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: (leadIds: string[]) => prospectingAdsService.importAdsLeads(leadIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prospecting-ads-leads'] });
      toast({
        title: 'Leads importados',
        description: 'Os leads selecionados foram reconciliados com o CRM.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao importar leads',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível importar os leads agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const suggestMessageMutation = useMutation({
    mutationFn: () =>
      prospectingCampaignService.suggestCampaignMessage({
        branchId: activeBranchId,
        objective:
          form.objective.trim() ||
          `trabalhar leads captados via Google Ads na campanha ${selectedLeads[0]?.campaignName || 'selecionada'}`,
        audienceType: 'CONTACT_LIST',
        channels: [form.channel],
        selectedCount: selectedLeads.length,
        selectedContacts: selectedLeads.slice(0, 10).map((lead) => ({
          name: lead.fullName || 'Lead Google Ads',
          phone: lead.phone,
          email: lead.email,
        })),
      }),
    onSuccess: (result) => {
      setForm((current) => ({ ...current, messageTemplate: result.messageTemplate }));
    },
    onError: (error) => {
      toast({
        title: 'Falha ao gerar mensagem',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível gerar a mensagem com IA agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const prospectMutation = useMutation({
    mutationFn: (leadIds: string[]) =>
      prospectingAdsService.prospectAdsLeads({
        leadIds,
        campaignName: form.campaignName.trim() || undefined,
        objective: form.objective.trim() || undefined,
        channel: form.channel,
        messageTemplate: form.messageTemplate.trim(),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prospecting-ads-leads'] }),
        queryClient.invalidateQueries({ queryKey: ['prospecting-campaigns'] }),
      ]);
      setProspectOpen(false);
      setForm({
        campaignName: '',
        objective: '',
        channel: 'WHATSAPP',
        messageTemplate: '',
      });
      toast({
        title: 'Campanha criada',
        description: 'Os leads captados foram transformados em campanha e entraram no fluxo.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao prospectar leads',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível criar a campanha a partir dos leads agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const pageData = leadsQuery.data ?? {
    items: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
    },
  };
  const leads = pageData.items;
  const selectedLeads = leads.filter((lead) => selectedLeadIds.includes(lead.id));

  return {
    page,
    setPage,
    filters,
    leads,
    pagination: pageData.pagination,
    selectedLeadIds,
    selectedLeads,
    prospectOpen,
    setProspectOpen,
    form,
    leadsQuery,
    syncMutation,
    importMutation,
    suggestMessageMutation,
    prospectMutation,
    updateFilters<K extends keyof typeof filters>(field: K, value: (typeof filters)[K]) {
      setFilters((current) => ({ ...current, [field]: value }));
      setPage(1);
    },
    updateForm<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
      setForm((current) => ({ ...current, [field]: value }));
    },
    toggleLead(leadId: string) {
      setSelectedLeadIds((current) =>
        current.includes(leadId)
          ? current.filter((id) => id !== leadId)
          : [...current, leadId],
      );
    },
    toggleAllVisible() {
      const visibleIds = leads.map((lead) => lead.id);
      setSelectedLeadIds((current) =>
        current.length === visibleIds.length ? [] : visibleIds,
      );
    },
    importSelected() {
      if (!selectedLeadIds.length) {
        toast({
          title: 'Selecione os leads',
          description: 'Marque pelo menos um lead antes de importar no CRM.',
          variant: 'destructive',
        });
        return;
      }

      importMutation.mutate(selectedLeadIds);
    },
    openProspectDialog() {
      if (!selectedLeadIds.length) {
        toast({
          title: 'Selecione os leads',
          description: 'Marque pelo menos um lead antes de criar a campanha.',
          variant: 'destructive',
        });
        return;
      }

      const firstCampaignName = selectedLeads[0]?.campaignName || 'Google Ads';
      setForm({
        campaignName: `Leads Google Ads • ${firstCampaignName}`,
        objective: `trabalhar leads captados via Google Ads na campanha ${firstCampaignName}`,
        channel: 'WHATSAPP',
        messageTemplate: '',
      });
      setProspectOpen(true);
    },
    suggestMessage() {
      if (!selectedLeadIds.length) {
        toast({
          title: 'Selecione os leads',
          description: 'Marque pelo menos um lead antes de pedir a sugestão.',
          variant: 'destructive',
        });
        return;
      }

      suggestMessageMutation.mutate();
    },
    submitProspect() {
      if (!selectedLeadIds.length) {
        toast({
          title: 'Selecione os leads',
          description: 'Marque pelo menos um lead antes de criar a campanha.',
          variant: 'destructive',
        });
        return;
      }

      if (!form.messageTemplate.trim()) {
        toast({
          title: 'Mensagem obrigatoria',
          description: 'Defina a mensagem da campanha antes de continuar.',
          variant: 'destructive',
        });
        return;
      }

      if (!prospectMessageHasNameTokens(form.messageTemplate)) {
        toast({
          title: 'Personalização obrigatória',
          description:
            'Inclua {{first_name}} ou {{name}} na mensagem para alinhar com o envio pela campanha.',
          variant: 'destructive',
        });
        return;
      }

      prospectMutation.mutate(selectedLeadIds);
    },
    metrics: useMemo(
      () => ({
        total: pageData.pagination.total,
        imported: leads.filter((lead) => lead.importStatus === 'IMPORTED').length,
        whatsappReady: leads.filter((lead) => !!lead.phone).length,
      }),
      [leads, pageData.pagination.total],
    ),
  };
}
