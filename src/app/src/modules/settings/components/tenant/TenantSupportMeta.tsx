import { Mail, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/shared/lib/formatters';
import { getBusinessTypeLabel } from '@/shared/constants/business-types';
import type { Tenant, TenantOwner } from '@/shared/types';
import { getTenantAuditLabel } from './tenant-view-helpers';

function ChannelStatusBadge({
  label,
  connected,
  detail,
}: {
  label: string;
  connected: boolean;
  detail?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <Badge variant={connected ? 'secondary' : 'outline'}>
          {connected ? 'Ativo' : 'Pendente'}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail ?? 'Sem configuração'}</p>
    </div>
  );
}

export function TenantSupportMeta({
  tenantData,
  owner,
}: {
  tenantData?: Tenant;
  owner?: TenantOwner;
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">Dados da Empresa</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Estruture os dados institucionais que a API usa para CRM, IA e operação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
              <Mail className="h-3.5 w-3.5" />
              {owner?.email ?? 'Sem email principal'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
              <MapPin className="h-3.5 w-3.5" />
              {tenantData?.city
                ? `${tenantData.city}/${tenantData.state ?? ''}`
                : 'Endereço em construção'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Suporte</p>
            <p className="mt-2 text-sm font-medium text-foreground">Tenant ID</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {tenantData?.id ?? '--'}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Owner</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {owner?.name ?? 'não informado'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {owner?.email ?? 'Sem email principal'}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Conta</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              Plano {tenantData?.plan ?? 'ESSENCIAL'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tipo {getBusinessTypeLabel(tenantData?.businessType)}
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-3 lg:grid-cols-2">
          <ChannelStatusBadge
            label="WhatsApp"
            connected={tenantData?.channels?.whatsapp?.connected ?? false}
            detail={
              tenantData?.channels?.whatsapp?.configured
                ? `${tenantData.channels.whatsapp?.provider ?? 'Provider'} · ${tenantData.channels.whatsapp?.whatsappNumber ?? 'número configurado'
                }`
                : 'Canal ainda não configurado'
            }
          />
          <ChannelStatusBadge
            label="Instagram"
            connected={tenantData?.channels?.instagram?.connected ?? false}
            detail={
              tenantData?.channels?.instagram?.configured
                ? `Conta ${tenantData.channels.instagram?.instagramAccountId ?? 'configurada'}`
                : 'Canal ainda não configurado'
            }
          />
        </div>


      </CardContent>
    </>
  );
}
