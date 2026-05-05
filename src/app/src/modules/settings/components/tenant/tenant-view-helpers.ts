import type { Tenant, TenantOwner, TenantBranch } from '@/shared/types';

export const weekdayFields = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terca-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sabado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

export function buildScopedTenantData(tenant?: Tenant, branch?: TenantBranch | null): Tenant | undefined {
  if (!tenant || !branch) {
    return tenant;
  }

  return {
    ...tenant,
    name: branch.name,
    cnpj: branch.cnpj ?? tenant.cnpj,
    phone: branch.phone ?? tenant.phone,
    email: branch.email ?? tenant.email,
    zipcode: branch.zipcode || tenant.zipcode,
    street: branch.street || tenant.street,
    streetNumber: branch.streetNumber || tenant.streetNumber,
    neighborhood: branch.neighborhood || tenant.neighborhood,
    city: branch.city || tenant.city,
    state: branch.state || tenant.state,
    operatingHours: branch.operatingHours ?? tenant.operatingHours,
    channels: {
      ...tenant.channels,
      whatsapp: tenant.channels?.whatsapp
        ? {
          ...tenant.channels.whatsapp,
          whatsappNumber: branch.whatsappNumber ?? tenant.channels.whatsapp.whatsappNumber,
        }
        : undefined,
      instagram: tenant.channels?.instagram
        ? {
          ...tenant.channels.instagram,
          instagramAccountId:
            branch.instagramAccountId ?? tenant.channels.instagram.instagramAccountId,
        }
        : undefined,
    },
  };
}

export function getTenantAuditLabel(eventType: string) {
  switch (eventType) {
    case 'BUSINESS_DATA_UPDATED':
      return 'Dados institucionais atualizados';
    case 'AI_CONFIG_UPDATED':
      return 'Configuração global da IA atualizada';
    case 'WHATSAPP_CONFIGURED':
      return 'Configuração do WhatsApp alterada';
    case 'INSTAGRAM_CONFIGURED':
      return 'Configuração do Instagram alterada';
    case 'BRANCH_ADDED':
      return 'Filial criada';
    case 'BRANCH_UPDATED':
      return 'Filial atualizada';
    case 'BRANCH_DELETED':
      return 'Filial removida';
    case 'PROMOTION_ADDED':
      return 'promoção criada';
    case 'PROMOTION_UPDATED':
      return 'promoção atualizada';
    case 'PROMOTION_DELETED':
      return 'promoção removida';
    default:
      return 'Alteração do tenant';
  }
}

export function getTenantCompleteness(
  tenantData?: Tenant,
  owner?: TenantOwner,
): {
  percent: number;
  completed: number;
  total: number;
  items: Array<{ id: string; label: string; done: boolean }>;
} {
  const hasBusinessIdentity = Boolean(
    tenantData?.name && (tenantData?.cnpj || tenantData?.businessType),
  );
  const hasOwnerCore = Boolean(
    owner?.name && (owner?.email || owner?.phone),
  );
  const hasCommercialContext = Boolean(tenantData?.description || tenantData?.services);
  const hasAddress = Boolean(
    (tenantData?.zipcode && tenantData?.street) ||
    (tenantData?.city && tenantData?.state),
  );
  const hasOperatingHours = Boolean(
    tenantData?.operatingHours &&
    Object.values(tenantData.operatingHours).some(
      (day) => Boolean(day?.closed) || Boolean(day?.open && day?.close),
    ),
  );
  const hasChannels = Boolean(
    tenantData?.channels?.whatsapp?.configured || tenantData?.channels?.instagram?.configured,
  );
  const hasAiConfig = Boolean(tenantData?.aiConfig?.basePrompt);

  const items = [
    { id: 'identity', label: 'Identidade da empresa', done: hasBusinessIdentity },
    { id: 'owner', label: 'Owner principal', done: hasOwnerCore },
    { id: 'context', label: 'Contexto comercial', done: hasCommercialContext },
    { id: 'address', label: 'Endereço completo', done: hasAddress },
    { id: 'hours', label: 'Horário operacional', done: hasOperatingHours },
    { id: 'channels', label: 'Canais configurados', done: hasChannels },
    { id: 'ai', label: 'IA institucional', done: hasAiConfig },
  ];

  const completed = items.filter((item) => item.done).length;
  const total = items.length;
  const percent = Math.round((completed / total) * 100);

  return {
    percent,
    completed,
    total,
    items,
  };
}
