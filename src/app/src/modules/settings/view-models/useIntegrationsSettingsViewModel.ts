import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  inventoryService,
  type CreateInventoryConnectionInput,
} from '@/modules/inventory/services/inventory-service';

interface ProviderConfig {
  sourceType: string;
  providerName: string;
  logo: string;
  description: string;
  fields: { name: string; label: string; placeholder: string; type?: string }[];
}

export const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  {
    sourceType: 'SHOPIFY',
    providerName: 'Shopify',
    logo: 'S',
    description: 'Conecte sua loja virtual Shopify.',
    fields: [
      { name: 'shopUrl', label: 'URL da Loja', placeholder: 'sua-loja.myshopify.com' },
      { name: 'accessToken', label: 'Access Token', placeholder: 'shpat_...', type: 'password' },
    ],
  },
  {
    sourceType: 'NUVEMSHOP',
    providerName: 'Nuvemshop',
    logo: 'N',
    description: 'Integração direta com Tiendanube/Nuvemshop.',
    fields: [
      { name: 'storeId', label: 'ID da Loja', placeholder: 'Ex: 123456' },
      { name: 'accessToken', label: 'Access Token', placeholder: 'Token gerado no painel', type: 'password' },
    ],
  },
  {
    sourceType: 'BLING',
    providerName: 'Bling ERP',
    logo: 'B',
    description: 'Sincronize saldo e preço do ERP Bling v3.',
    fields: [
      { name: 'accessToken', label: 'Access Token', placeholder: 'Token OAuth2', type: 'password' },
    ],
  },
  {
    sourceType: 'TINY',
    providerName: 'Tiny ERP',
    logo: 'T',
    description: 'Sincronize saldo e catálogo via Tiny V2.',
    fields: [
      { name: 'token', label: 'Token de API', placeholder: 'Token gerado nas configurações do Tiny', type: 'password' },
    ],
  },
  {
    sourceType: 'WOOCOMMERCE',
    providerName: 'WooCommerce',
    logo: 'W',
    description: 'Integração via API REST nativa do WooCommerce.',
    fields: [
      { name: 'storeUrl', label: 'URL da Loja', placeholder: 'https://sua-loja.com' },
      { name: 'consumerKey', label: 'Consumer Key', placeholder: 'ck_...' },
      { name: 'consumerSecret', label: 'Consumer Secret', placeholder: 'cs_...', type: 'password' },
    ],
  },
  {
    sourceType: 'MERCADOLIVRE',
    providerName: 'Mercado Livre',
    logo: 'ML',
    description: 'Importe e atualize estoque no marketplace.',
    fields: [
      { name: 'userId', label: 'ID do Vendedor', placeholder: 'Ex: 123456789' },
      { name: 'accessToken', label: 'Access Token', placeholder: 'APP_USR-...', type: 'password' },
    ],
  },
  {
    sourceType: 'SHOPEE',
    providerName: 'Shopee',
    logo: 'SH',
    description: 'Integração com Shopee Open Platform.',
    fields: [
      { name: 'partnerId', label: 'Partner ID', placeholder: 'Ex: 12345' },
      { name: 'partnerKey', label: 'Partner Key', placeholder: 'Hash secreta', type: 'password' },
      { name: 'shopId', label: 'Shop ID', placeholder: 'Ex: 987654' },
      { name: 'accessToken', label: 'Access Token', placeholder: 'Token de acesso', type: 'password' },
    ],
  },
];

export function useIntegrationsSettingsViewModel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tenant = useAuthStore((s) => s.tenant);
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [activeTab, setActiveTab] = useState('catalog');
  const [configForm, setConfigForm] = useState<Record<string, string>>({});

  const connectionsQuery = useQuery({
    queryKey: ['inventory-connections', tenant?.id],
    queryFn: () => inventoryService.listConnections(tenant!.id),
    enabled: Boolean(tenant?.id),
  });

  const createConnectionMutation = useMutation({
    mutationFn: (data: CreateInventoryConnectionInput) =>
      inventoryService.createConnection(tenant!.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory-connections'] });
      toast({
        title: 'Integração concluída',
        description: 'As credenciais foram validadas e salvas com sucesso.',
      });
      closeModal();
      setActiveTab('active');
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao conectar',
        description: error.message || 'Ocorreu um problema ao validar a integração.',
        variant: 'destructive',
      });
    },
  });

  const openProviderModal = (provider: ProviderConfig) => {
    setSelectedProvider(provider);
    setConfigForm({});
  };

  const closeModal = () => {
    setSelectedProvider(null);
    setConfigForm({});
  };

  const handleConfigChange = (field: string, value: string) => {
    setConfigForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitConnection = () => {
    if (!selectedProvider) return;
    createConnectionMutation.mutate({
      sourceType: selectedProvider.sourceType,
      providerName: selectedProvider.providerName,
      config: configForm as Record<string, unknown>,
    });
  };

  return {
    activeTab,
    setActiveTab,
    connectionsQuery,
    SUPPORTED_PROVIDERS,
    selectedProvider,
    openProviderModal,
    closeModal,
    configForm,
    handleConfigChange,
    submitConnection,
    isSubmitting: createConnectionMutation.isPending,
  };
}
