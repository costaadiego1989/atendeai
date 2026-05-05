import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import type { Tenant, TenantBranch } from '@/shared/types';
import { useAuthStore } from '@/shared/stores/auth-store';
import { authService } from '@/modules/auth/services/auth-service';
import { companySettingsService } from '@/modules/settings/services/company-settings-service';
import { useCompanySettingsQuery } from '@/modules/settings/view-models/useCompanySettingsQuery';
import { useUpdateCompanySettingsViewModel } from '@/modules/settings/view-models/useUpdateCompanySettingsViewModel';
import { cepService } from '@/shared/services/cep-service';
import { buildScopedTenantData } from '@/modules/settings/components/tenant/tenant-view-helpers';

const operatingDaySchema = z.object({
  open: z.string(),
  close: z.string(),
  closed: z.boolean(),
});

const tenantDataSchema = z.object({
  ownerBirthDate: z.string().optional(),
  description: z.string().optional(),
  services: z.string().optional(),
  catalogUrl: z.string().optional(),
  catalogFiles: z.array(z.string()).optional(),
  zipcode: z.string().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  operatingHours: z.object({
    monday: operatingDaySchema,
    tuesday: operatingDaySchema,
    wednesday: operatingDaySchema,
    thursday: operatingDaySchema,
    friday: operatingDaySchema,
    saturday: operatingDaySchema,
    sunday: operatingDaySchema,
  }),
});

export type TenantDataForm = z.infer<typeof tenantDataSchema>;

function getDefaultOperatingHours(): TenantDataForm['operatingHours'] {
  return {
    monday: { open: '08:00', close: '18:00', closed: false },
    tuesday: { open: '08:00', close: '18:00', closed: false },
    wednesday: { open: '08:00', close: '18:00', closed: false },
    thursday: { open: '08:00', close: '18:00', closed: false },
    friday: { open: '08:00', close: '18:00', closed: false },
    saturday: { open: '08:00', close: '13:00', closed: false },
    sunday: { open: '08:00', close: '13:00', closed: true },
  };
}

function normalizeOperatingHours(
  value?: Record<string, { open: string; close: string; closed?: boolean }>,
): TenantDataForm['operatingHours'] {
  const defaults = getDefaultOperatingHours();

  return {
    monday: { ...defaults.monday, ...value?.monday },
    tuesday: { ...defaults.tuesday, ...value?.tuesday },
    wednesday: { ...defaults.wednesday, ...value?.wednesday },
    thursday: { ...defaults.thursday, ...value?.thursday },
    friday: { ...defaults.friday, ...value?.friday },
    saturday: { ...defaults.saturday, ...value?.saturday },
    sunday: { ...defaults.sunday, ...value?.sunday },
  };
}

function buildFormValues(tenant?: Tenant): TenantDataForm {
  return {
    ownerBirthDate: tenant?.owner?.birthDate ?? '',
    description: tenant?.description ?? '',
    services: tenant?.services ?? '',
    catalogUrl: tenant?.catalogUrl ?? '',
    catalogFiles: tenant?.catalogFiles ?? [],
    zipcode: tenant?.zipcode ?? '',
    street: tenant?.street ?? '',
    streetNumber: tenant?.streetNumber ?? '',
    neighborhood: tenant?.neighborhood ?? '',
    city: tenant?.city ?? '',
    state: tenant?.state ?? '',
    operatingHours: normalizeOperatingHours(tenant?.operatingHours),
  };
}

export function useTenantDataViewModel() {
  const { tenant, user, activeBranchId, setSession } = useAuthStore();
  const queryClient = useQueryClient();
  const [isBranchSaving, setIsBranchSaving] = useState(false);
  const tenantId = tenant?.id;
  const tenantQuery = useCompanySettingsQuery(tenantId);
  const updateMutation = useUpdateCompanySettingsViewModel(tenantId);

  const form = useForm<TenantDataForm>({
    resolver: zodResolver(tenantDataSchema),
    defaultValues: buildFormValues(),
  });

  const handleZipcodeChange = async (cep: string) => {
    const sanitizedCep = cep.replace(/\D/g, '');
    if (sanitizedCep.length === 8) {
      const address = await cepService.fetchAddress(sanitizedCep);
      if (address) {
        form.setValue('street', address.logradouro);
        form.setValue('neighborhood', address.bairro);
        form.setValue('city', address.localidade);
        form.setValue('state', address.uf);
      }
    }
  };

  const baseTenantData = tenantQuery.data ?? tenant;
  const activeBranch = useMemo(
    () =>
      activeBranchId
        ? (baseTenantData?.branches ?? []).find((branch) => branch.id === activeBranchId) ??
          null
        : null,
    [activeBranchId, baseTenantData?.branches],
  );
  const tenantData = useMemo(
    () => buildScopedTenantData(baseTenantData, activeBranch),
    [baseTenantData, activeBranch],
  );

  useEffect(() => {
    if (tenantData) {
      form.reset(buildFormValues(tenantData));
    }
  }, [form, tenantData]);

  const owner =
    tenantQuery.data?.owner ??
    (user
      ? {
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        cpf: user.cpf ?? null,
        birthDate: tenantQuery.data?.owner?.birthDate ?? null,
      }
      : undefined);

  const submit = form.handleSubmit(async (values) => {
    if (tenantId && activeBranch) {
      try {
        setIsBranchSaving(true);
        await companySettingsService.updateBranch(tenantId, activeBranch.id, {
          name: activeBranch.name,
          cnpj: activeBranch.cnpj ?? null,
          phone: activeBranch.phone ?? null,
          email: activeBranch.email ?? null,
          whatsappNumber: activeBranch.whatsappNumber ?? null,
          instagramAccountId: activeBranch.instagramAccountId ?? null,
          whatsAppConfigOverride: activeBranch.whatsAppConfigOverride ?? null,
          zipcode: values.zipcode?.trim() || null,
          street: values.street?.trim() || null,
          streetNumber: values.streetNumber?.trim() || null,
          neighborhood: values.neighborhood?.trim() || null,
          city: values.city?.trim() || null,
          state: values.state?.trim() || null,
          operatingHours: values.operatingHours as any,
          isHeadquarters: activeBranch.isHeadquarters,
          active: activeBranch.active,
        });

        await queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });
        await queryClient.invalidateQueries({ queryKey: ['tenant-profile-sections', tenantId] });
        await queryClient.invalidateQueries({ queryKey: ['tenant-onboarding-checklist', tenantId] });
        const session = await authService.getCurrentSession();
        setSession(session.user, session.tenant);

        toast({
          title: 'Filial atualizada',
          description: 'Os dados operacionais da filial foram salvos com sucesso.',
        });
      } catch (error) {
        toast({
          title: 'Falha ao salvar filial',
          description: getFriendlyErrorMessage(error, {
            fallbackMessage: 'não foi possivel salvar os dados da filial agora.',
          }),
          variant: 'destructive',
        });
      } finally {
        setIsBranchSaving(false);
      }
      return;
    }

    updateMutation.mutate({
      ownerBirthDate: values.ownerBirthDate?.trim() || null,
      description: values.description?.trim() || null,
      services: values.services?.trim() || null,
      catalogUrl: values.catalogUrl?.trim() || null,
      catalogFiles: values.catalogFiles || [],
      zipcode: values.zipcode?.trim() || null,
      street: values.street?.trim() || null,
      streetNumber: values.streetNumber?.trim() || null,
      neighborhood: values.neighborhood?.trim() || null,
      city: values.city?.trim() || null,
      state: values.state?.trim() || null,
      operatingHours: values.operatingHours as any,
    });
  });

  return {
    form,
    owner,
    submit,
    tenantId,
    tenantData,
    activeBranch,
    isBranchScope: Boolean(activeBranch),
    isLoading: !tenantId || (tenantQuery.isLoading && !tenantQuery.data),
    isSaving: updateMutation.isPending || isBranchSaving,
    handleZipcodeChange,
  };
}
