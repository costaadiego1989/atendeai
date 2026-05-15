import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { useLocation } from 'react-router-dom';
import {
  type BootstrapTenantFinancialAccountInput,
  type CreateSalesSplitChargeResponse,
  type CreateSalesSplitChargeInput,
} from '@/modules/sales/services/sales-types';
import { salesFinancialAccountService } from '@/modules/sales/services/sales-financial-account-service';
import { salesPaymentLinksService } from '@/modules/sales/services/sales-payment-links-service';
import { contactsService } from '@/modules/contacts/services/contacts-service';
import { useCompanySettingsQuery } from '@/modules/settings/view-models/useCompanySettingsQuery';
import type { Contact } from '@/shared/types';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import { parseCurrencyInput } from '@/shared/lib/masks';

type ChargeForm = Omit<CreateSalesSplitChargeInput, 'value'> & {
  value: string;
};

const DEFAULT_FORM: ChargeForm = {
  contactId: '',
  customerDocument: '',
  name: '',
  description: '',
  label: '',
  value: '',
  billingType: 'PIX',
  dueDate: '',
  sendViaWhatsApp: true,
  recurring: false,
  recurrenceFrequency: 'MONTHLY',
  recurrenceStartDate: '',
  recurrenceEndDate: '',
};

const DEFAULT_SETUP_FORM: BootstrapTenantFinancialAccountInput = {
  companyType: 'LIMITED',
  addressNumber: 'S/N',
  complement: '',
  birthDate: '',
};

export type SalesPeriodFilter = 'today' | '7d' | '30d';

const SALES_PERIOD_OPTIONS: Array<{
  value: SalesPeriodFilter;
  label: string;
  description: string;
}> = [
    { value: 'today', label: 'Hoje', description: 'Cobranças criadas hoje' },
    { value: '7d', label: '7 dias', description: 'Cobranças criadas nos ultimos 7 dias' },
    { value: '30d', label: '30 dias', description: 'Cobranças criadas nos ultimos 30 dias' },
  ];

function buildSalesPeriodRange(period: SalesPeriodFilter) {
  const now = new Date();
  const dateFrom = new Date(now);

  if (period === 'today') {
    dateFrom.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    dateFrom.setDate(dateFrom.getDate() - 7);
  } else {
    dateFrom.setDate(dateFrom.getDate() - 30);
  }

  return {
    dateFrom: dateFrom.toISOString(),
    dateTo: now.toISOString(),
  };
}

export function usePaymentLinksPageViewModel() {
  const queryClient = useQueryClient();
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const updateTenant = useAuthStore((state) => state.updateTenant);
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [periodFilter, setPeriodFilterState] = useState<SalesPeriodFilter>('30d');
  const [createOpen, setCreateOpenState] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [reportsOpen, setReportsOpenState] = useState(false);
  const [form, setForm] = useState<ChargeForm>(DEFAULT_FORM);
  const [setupForm, setSetupForm] = useState<BootstrapTenantFinancialAccountInput>(DEFAULT_SETUP_FORM);
  const [contactSearch, setContactSearch] = useState('');
  const [pauseTarget, setPauseTarget] = useState<{ id: string; name: string } | null>(null);
  const [resumeTarget, setResumeTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [paymentLinkPrefillApplied, setPaymentLinkPrefillApplied] = useState(false);

  const periodRange = useMemo(() => buildSalesPeriodRange(periodFilter), [periodFilter]);

  const [reportFilters, setReportFilters] = useState(() => ({
    search: '',
    status: 'ALL' as string,
    source: 'ALL' as string,
    dateFrom: new Date(periodRange.dateFrom).toISOString().slice(0, 10),
    dateTo: new Date(periodRange.dateTo).toISOString().slice(0, 10),
  }));

  useEffect(() => {
    // Mantém o modal alinhado ao período selecionado (sem sobrescrever quando estiver aberto)
    if (reportsOpen) return;
    setReportFilters((current) => ({
      ...current,
      dateFrom: new Date(periodRange.dateFrom).toISOString().slice(0, 10),
      dateTo: new Date(periodRange.dateTo).toISOString().slice(0, 10),
    }));
  }, [periodRange.dateFrom, periodRange.dateTo, reportsOpen]);

  const paymentLinksQuery = useQuery({
    queryKey: [
      'sales-payment-links',
      activeBranchId ?? 'tenant',
      page,
      pageSize,
      search,
      statusFilter,
      sourceFilter,
      periodFilter,
      periodRange.dateFrom,
      periodRange.dateTo,
    ],
    queryFn: () =>
      salesPaymentLinksService.listPaymentLinks({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        branchId: activeBranchId || undefined,
        dateFrom: periodRange.dateFrom,
        dateTo: periodRange.dateTo,
      }),
  });

  const financialAccountQuery = useQuery({
    queryKey: ['tenant-financial-account-status', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => salesFinancialAccountService.getTenantFinancialAccountStatus(tenant!.id),
  });
  const tenantSettingsQuery = useCompanySettingsQuery(tenant?.id);

  const contactsQuery = useQuery({
    queryKey: ['sales-charge-contacts', tenant?.id],
    enabled: createOpen && Boolean(tenant?.id),
    queryFn: () => contactsService.listContacts(tenant!.id, { page: 1, limit: 200 }),
  });

  const selectedContactQuery = useQuery({
    queryKey: ['sales-charge-contact', tenant?.id, form.contactId],
    enabled: createOpen && Boolean(tenant?.id && form.contactId),
    queryFn: () => contactsService.getContact(tenant!.id, form.contactId),
  });

  const contacts = contactsQuery.data?.data ?? [];
  const selectedContact =
    selectedContactQuery.data ??
    contacts.find((contact) => contact.id === form.contactId) ??
    null;
  const filteredContacts = useMemo(() => {
    const normalized = contactSearch.trim().toLowerCase();
    const normalizedDigits = contactSearch.replace(/\D/g, '');
    if (!normalized) return contacts.slice(0, 8);
    return contacts
      .filter((contact) => {
        const haystack = `${contact.name} ${contact.phone} ${contact.email ?? ''} ${contact.document ?? ''}`.toLowerCase();
        const phoneDigits = contact.phone.replace(/\D/g, '');
        const documentDigits = (contact.document ?? '').replace(/\D/g, '');
        return (
          haystack.includes(normalized) ||
          (normalizedDigits.length > 0 &&
            (phoneDigits.includes(normalizedDigits) ||
              documentDigits.includes(normalizedDigits)))
        );
      })
      .slice(0, 8);
  }, [contactSearch, contacts]);

  const activeBranch = useMemo(
    () => (tenant?.branches ?? []).find(b => b.id === activeBranchId),
    [tenant?.branches, activeBranchId]
  );

  const hasCompanyAddress = useMemo(() => {
    const target = activeBranchId && activeBranch ? activeBranch : tenant;

    return Boolean(
      target?.zipcode &&
      target?.zipcode.trim() !== '' &&
      target?.street &&
      target?.neighborhood
    );
  }, [tenant, activeBranch, activeBranchId]);

  const savedOwnerBirthDate =
    tenantSettingsQuery.data?.owner?.birthDate ??
    tenant?.owner?.birthDate ??
    '';

  const hasOwnerBirthDate = Boolean(savedOwnerBirthDate && savedOwnerBirthDate.trim() !== '');
  const isTenantReadyForPayments = hasCompanyAddress && hasOwnerBirthDate;

  useEffect(() => {
    const prefill = (
      location.state as
      | {
        paymentLinkPrefill?: {
          contactId?: string;
          contactName?: string;
          conversationId?: string;
        };
      }
      | undefined
    )?.paymentLinkPrefill;

    if (paymentLinkPrefillApplied || !prefill?.contactId) {
      return;
    }

    setForm((current) => ({
      ...current,
      contactId: prefill.contactId ?? current.contactId,
      name:
        current.name.trim() ||
        (prefill.contactName ? `cobrança para ${prefill.contactName}` : current.name),
      sendViaWhatsApp: true,
    }));
    setContactSearch(prefill.contactName ?? '');
    setPaymentLinkPrefillApplied(true);

    if (financialAccountQuery.data?.configured) {
      setCreateOpenState(true);
      return;
    }

    setSetupOpen(true);
  }, [financialAccountQuery.data?.configured, location.state, paymentLinkPrefillApplied]);

  const invalidateLinks = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sales-payment-links'] });
  };



  const invalidateFinancialAccount = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tenant-financial-account-status'] });
  };

  const closeCreateDialog = () => {
    setCreateOpenState(false);
    setForm(DEFAULT_FORM);
    setContactSearch('');
  };

  const downloadReportMutation = useMutation({
    mutationFn: async () => {
      await salesPaymentLinksService.downloadPaymentLinksReport({
        search: reportFilters.search.trim() || undefined,
        status: reportFilters.status !== 'ALL' ? reportFilters.status : undefined,
        source: reportFilters.source !== 'ALL' ? reportFilters.source : undefined,
        branchId: activeBranchId || undefined,
        dateFrom: reportFilters.dateFrom ? new Date(`${reportFilters.dateFrom}T00:00:00.000Z`).toISOString() : undefined,
        dateTo: reportFilters.dateTo ? new Date(`${reportFilters.dateTo}T23:59:59.000Z`).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      setReportsOpenState(false);
      toast({
        title: 'Relatorio gerado',
        description: 'O download do CSV foi iniciado com os filtros selecionados.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao baixar relatório',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível baixar o CSV agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const createChargeMutation = useMutation({
    mutationFn: () => {
      const customerDocument =
        selectedContact?.document?.trim() || form.customerDocument?.trim();

      if (!customerDocument) {
        throw new Error('O contato selecionado ainda não possui CPF/CNPJ salvo no CRM.');
      }

      const numericValue = Number(parseCurrencyInput(form.value) || 0);
      if (form.recurring && !form.recurrenceEndDate) {
        throw new Error('Informe a data final da recorrência.');
      }

      return salesPaymentLinksService.createSplitCharge({
        ...form,
        value: numericValue,
        branchId: activeBranchId,
        customerDocument,
        description: form.description?.trim() || undefined,
        label: form.label?.trim() || undefined,
        dueDate: form.dueDate || undefined,
        recurrenceStartDate: form.recurring
          ? form.recurrenceStartDate || form.dueDate || undefined
          : undefined,
        recurrenceEndDate: form.recurring ? form.recurrenceEndDate || undefined : undefined,
        recurrenceFrequency: form.recurring ? form.recurrenceFrequency : undefined,
      });
    },
    onSuccess: async () => {
      setPage(1);
      setSearch('');
      setStatusFilter('ALL');
      setSourceFilter('ALL');
      setPeriodFilterState('30d');
      await queryClient.invalidateQueries({ queryKey: ['sales-payment-links'] });
      closeCreateDialog();
      toast({
        title: 'cobrança criada',
        description: form.sendViaWhatsApp
          ? 'A cobrança foi criada e enviada no WhatsApp do contato.'
          : 'A cobrança com repasse foi criada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar cobrança',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível criar a cobrança agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const bootstrapFinancialAccountMutation = useMutation({
    mutationFn: () =>
      salesFinancialAccountService.bootstrapTenantFinancialAccount(tenant!.id, {
        companyType: 'LIMITED',
        addressNumber: 'S/N',
        birthDate: setupForm.birthDate || savedOwnerBirthDate || undefined,
      }),
    onSuccess: () => {
      void invalidateFinancialAccount();
      void queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenant?.id] });
      if (setupForm.birthDate) {
        updateTenant({
          owner: {
            name: tenant?.owner?.name ?? '',
            email: tenant?.owner?.email ?? '',
            ...(tenant?.owner ?? {}),
            birthDate: setupForm.birthDate,
          },
        });
      }
      setSetupOpen(false);
      toast({
        title: 'Recebimentos habilitados',
        description: 'A conta financeira da empresa foi configurada com sucesso.',
      });
      setCreateOpenState(true);
    },
    onError: (error) => {
      toast({
        title: 'Falha ao habilitar recebimentos',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível configurar a conta financeira agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (paymentLinkId: string) => salesPaymentLinksService.pausePaymentLink(paymentLinkId),
    onSuccess: () => {
      void invalidateLinks();
      setPauseTarget(null);
      toast({ title: 'Item pausado', description: 'A cobrança foi pausada com sucesso.' });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao pausar',
        description: getFriendlyErrorMessage(error, { fallbackMessage: 'Não foi possível pausar agora.' }),
        variant: 'destructive',
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (paymentLinkId: string) => salesPaymentLinksService.resumePaymentLink(paymentLinkId),
    onSuccess: () => {
      void invalidateLinks();
      setResumeTarget(null);
      toast({ title: 'Item reativado', description: 'A cobrança voltou a ficar ativa.' });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao reativar',
        description: getFriendlyErrorMessage(error, { fallbackMessage: 'Não foi possível reativar agora.' }),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (paymentLinkId: string) => salesPaymentLinksService.deletePaymentLink(paymentLinkId),
    onSuccess: () => {
      void invalidateLinks();
      setDeleteTarget(null);
      toast({ title: 'Item excluído', description: 'A cobrança foi removida da operação.' });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao excluir',
        description: getFriendlyErrorMessage(error, { fallbackMessage: 'Não foi possível excluir agora.' }),
        variant: 'destructive',
      });
    },
  });

  const summary = paymentLinksQuery.data?.summary;
  const pagination = paymentLinksQuery.data?.pagination;
  const items = paymentLinksQuery.data?.items ?? [];
  const hasFilters = Boolean(search || statusFilter !== 'ALL' || sourceFilter !== 'ALL');

  return {
    tenant,
    activeBranchId,
    page,
    pageSize,
    search,
    setSearch(value: string) {
      setPage(1);
      setSearch(value);
    },
    statusFilter,
    setStatusFilter(value: string) {
      setPage(1);
      setStatusFilter(value);
    },
    sourceFilter,
    setSourceFilter(value: string) {
      setPage(1);
      setSourceFilter(value);
    },
    periodFilter,
    setPeriodFilter(value: SalesPeriodFilter) {
      setPage(1);
      setPeriodFilterState(value);
    },
    reportsOpen,
    setReportsOpen(open: boolean) {
      setReportsOpenState(open);
      if (open) {
        setReportFilters({
          search,
          status: statusFilter,
          source: sourceFilter,
          dateFrom: new Date(periodRange.dateFrom).toISOString().slice(0, 10),
          dateTo: new Date(periodRange.dateTo).toISOString().slice(0, 10),
        });
      }
    },
    reportFilters,
    setReportFilters,
    periodOptions: SALES_PERIOD_OPTIONS,
    periodRange,
    createOpen,
    setCreateOpen(open: boolean) {
      if (!open) {
        closeCreateDialog();
        return;
      }

      if (financialAccountQuery.data?.configured) {
        setCreateOpenState(true);
        return;
      }

      if (isTenantReadyForPayments) {
        bootstrapFinancialAccountMutation.mutate();
        return;
      }

      toast({
        title: 'Dados pendentes',
        description: 'Complete as informações da empresa e do responsável antes de habilitar recebimentos.',
        variant: 'destructive',
      });
    },
    setupOpen,
    setSetupOpen(open: boolean) {
      if (!open) {
        setSetupOpen(false);
        return;
      }

      setSetupOpen(true);
    },
    form,
    setForm,
    setupForm,
    setSetupForm,
    contactSearch,
    setContactSearch,
    contactsQuery,
    filteredContacts,
    selectedContact,
    financialAccountQuery,
    tenantSettingsQuery,
    hasCompanyAddress,
    hasOwnerBirthDate,
    isTenantReadyForPayments,
    savedOwnerBirthDate,
    selectContact(contact: Contact) {
      setForm((current) => ({
        ...current,
        contactId: contact.id,
        customerDocument: contact.document ?? '',
        name: current.name.trim() ? current.name : `cobrança para ${contact.name}`,
      }));
      setContactSearch(contact.name);
    },
    clearSelectedContact() {
      setForm((current) => ({ ...current, contactId: '', customerDocument: '' }));
      setContactSearch('');
    },
    pauseTarget,
    setPauseTarget,
    resumeTarget,
    setResumeTarget,
    deleteTarget,
    setDeleteTarget,
    paymentLinksQuery,
    createChargeMutation,
    bootstrapFinancialAccountMutation,
    pauseMutation,
    resumeMutation,
    deleteMutation,
    items,
    summary,
    pagination,
    hasFilters,
    submitCreate() {
      createChargeMutation.mutate();
    },
    submitBootstrap() {
      bootstrapFinancialAccountMutation.mutate();
    },
    confirmPause() {
      if (pauseTarget) pauseMutation.mutate(pauseTarget.id);
    },
    confirmResume() {
      if (resumeTarget) resumeMutation.mutate(resumeTarget.id);
    },
    confirmDelete() {
      if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
    },
    resetFilters() {
      setPage(1);
      setSearch('');
      setStatusFilter('ALL');
      setSourceFilter('ALL');
      setPeriodFilterState('30d');
    },
    goToPage(nextPage: number) {
      setPage(nextPage);
    },
    downloadReportMutation,
    confirmDownloadReport() {
      downloadReportMutation.mutate();
    },
    downloadReport() {
      setReportsOpenState(true);
      setReportFilters({
        search,
        status: statusFilter,
        source: sourceFilter,
        dateFrom: new Date(periodRange.dateFrom).toISOString().slice(0, 10),
        dateTo: new Date(periodRange.dateTo).toISOString().slice(0, 10),
      });
    },
  };
}

export type PaymentLinksPageViewModel = ReturnType<typeof usePaymentLinksPageViewModel>;
