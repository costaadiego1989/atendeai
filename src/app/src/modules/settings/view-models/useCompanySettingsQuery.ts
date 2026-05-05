import { useQuery } from '@tanstack/react-query';
import { companySettingsService } from '@/modules/settings/services/company-settings-service';

export function useCompanySettingsQuery(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => companySettingsService.getTenantSettings(tenantId as string),
    enabled: Boolean(tenantId),
  });
}
