import { Badge } from '@/components/ui/badge';
import { getBusinessTypeLabel } from '@/shared/constants/business-types';
import type { Tenant } from '@/shared/types';

export function TenantPageHeader({ tenantData }: { tenantData?: Tenant }) {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">Dados da empresa</h1>
        <p className="page-description">
          Painel do tenant com posicionamento comercial, endereço e horário de funcionamento.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="px-3 py-1 text-xs">
          Tenant {tenantData?.id ?? '--'}
        </Badge>
        <Badge variant="outline" className="px-3 py-1 text-xs">
          Plano {tenantData?.plan ?? 'ESSENCIAL'}
        </Badge>
        <Badge variant="secondary" className="px-3 py-1 text-xs">
          {getBusinessTypeLabel(tenantData?.businessType)}
        </Badge>
      </div>
    </div>
  );
}
