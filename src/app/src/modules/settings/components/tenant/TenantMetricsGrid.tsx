import { Building2, Clock3, Phone, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCnpj, formatCpf, formatPhone } from '@/shared/lib/masks';
import type { Tenant, TenantOwner } from '@/shared/types';

function formatKpiPhone(value?: string) {
  if (!value) return 'não informado';

  const digits = value.replace(/\D/g, '');
  const localDigits = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;

  return formatPhone(localDigits);
}

function CompanyMetric({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof Building2;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="mt-2 break-words text-lg font-semibold leading-tight text-foreground xl:text-xl">
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="shrink-0 rounded-xl bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TenantMetricsGrid({
  tenantData,
  owner,
  mondayClosed,
}: {
  tenantData?: Tenant;
  owner?: TenantOwner;
  mondayClosed: boolean;
}) {
  return (
    <div className="card-grid mb-6">
      <CompanyMetric
        title="Empresa"
        value={tenantData?.name ?? 'Empresa'}
        subtitle={tenantData?.cnpj ? formatCnpj(tenantData.cnpj) : 'CNPJ não informado'}
        icon={Building2}
      />
      <CompanyMetric
        title="responsável"
        value={owner?.name ?? 'não informado'}
        subtitle={owner?.cpf ? formatCpf(owner.cpf) : 'CPF não informado'}
        icon={ShieldCheck}
      />
      <CompanyMetric
        title="Contato principal"
        value={formatKpiPhone(owner?.phone)}
        subtitle={owner?.email ?? 'Email não informado'}
        icon={Phone}
      />
      <CompanyMetric
        title="Funcionamento"
        value={mondayClosed ? 'horário customizado' : 'Agenda configuravel'}
        subtitle="Defina o ritmo padrao da operação comercial."
        icon={Clock3}
      />
    </div>
  );
}
