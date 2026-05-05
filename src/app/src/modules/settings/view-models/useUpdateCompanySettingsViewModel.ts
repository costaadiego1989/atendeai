import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  companySettingsService,
  type UpdateCompanySettingsInput,
} from '@/modules/settings/services/company-settings-service';

export function useUpdateCompanySettingsViewModel(tenantId?: string) {
  const queryClient = useQueryClient();
  const { tenant, updateTenant } = useAuthStore();

  return useMutation({
    mutationFn: (input: UpdateCompanySettingsInput) =>
      companySettingsService.updateBusinessData(tenantId as string, input),
    onSuccess: async (_response, variables) => {
      try {
        const freshTenant = await companySettingsService.getTenantSettings(tenantId as string);
        updateTenant(freshTenant);
      } catch (e) {
        console.error('Failed to sync tenant after update', e);
        const prevOwner = tenant?.owner;
        updateTenant({
          ...(prevOwner
            ? {
                owner: {
                  name: prevOwner.name,
                  email: prevOwner.email,
                  phone: prevOwner.phone,
                  cpf: prevOwner.cpf,
                  birthDate: variables.ownerBirthDate ?? prevOwner.birthDate ?? undefined,
                },
              }
            : {}),
          description: variables.description ?? undefined,
          services: variables.services ?? undefined,
          catalogUrl: variables.catalogUrl ?? undefined,
          catalogFiles: variables.catalogFiles ?? undefined,
          zipcode: variables.zipcode ?? undefined,
          street: variables.street ?? undefined,
          streetNumber: variables.streetNumber ?? undefined,
          neighborhood: variables.neighborhood ?? undefined,
          city: variables.city ?? undefined,
          state: variables.state ?? undefined,
          operatingHours: variables.operatingHours ?? undefined,
        });
      }

      void queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['tenant-profile-sections', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['tenant-onboarding-checklist', tenantId] });

      toast({
        title: 'Dados atualizados',
        description: 'As informações da empresa foram salvas com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao salvar',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel salvar os dados da empresa agora.',
        }),
        variant: 'destructive',
      });
    },
  });
}
