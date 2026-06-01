import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkoutService } from '@/modules/checkout/services/checkout-service';
import { toast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/shared/stores/auth-store';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { buildOpenStreetMapEmbedUrl } from '@/shared/lib/maps';
import type { CommerceDeliverySchedule, CommerceDeliveryWeekday } from '@/shared/types';
import type { AbandonmentConfig } from '@/modules/checkout/components/AbandonmentConfigSheet';

type CheckoutMapLocation = {
  latitude: number;
  longitude: number;
  source: 'browser';
};

const DELIVERY_WEEKDAY_ORDER: CommerceDeliveryWeekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

function buildDefaultDeliverySchedule(): CommerceDeliverySchedule[] {
  return DELIVERY_WEEKDAY_ORDER.map((weekday, index) => ({
    weekday,
    enabled: index < 5,
    startTime: '09:00',
    endTime: '18:00',
  }));
}

function normalizeShippingFormMode(mode?: string | null): 'FIXED' | 'PER_KM' {
  return mode === 'PER_KM' ? 'PER_KM' : 'FIXED';
}

function normalizeDeliverySchedule(
  schedule?: CommerceDeliverySchedule[] | null,
): CommerceDeliverySchedule[] {
  const source = schedule?.length ? schedule : buildDefaultDeliverySchedule();
  return DELIVERY_WEEKDAY_ORDER.map((weekday) => {
    const existing = source.find((slot) => slot.weekday === weekday);
    return {
      weekday,
      enabled: existing?.enabled ?? false,
      startTime: existing?.startTime ?? '09:00',
      endTime: existing?.endTime ?? '18:00',
    };
  });
}

export function useCheckoutConfigViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const user = useAuthStore((state) => state.user);
  const effectiveTenantId = tenant?.id || user?.tenantId;
  const queryClient = useQueryClient();

  const [shippingPolicySheetOpen, setShippingPolicySheetOpen] = useState(false);
  const [abandonmentConfigOpen, setAbandonmentConfigOpen] = useState(false);
  const [mapLocation, setMapLocation] = useState<CheckoutMapLocation | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [shippingPolicyForm, setShippingPolicyForm] = useState({
    mode: 'FIXED' as 'FIXED' | 'PER_KM',
    fixedAmount: '',
    pricePerKm: '',
    minimumAmount: '',
    maxRadiusKm: '',
    servicedNeighborhoods: '',
    deliverySchedule: buildDefaultDeliverySchedule(),
    notes: '',
    carrierShippingEnabled: false,
  });
  const [abandonmentConfigForm, setAbandonmentConfigForm] = useState<AbandonmentConfig>({
    active: true,
    message: '',
    useAiMessage: true,
    mode: 'SINGLE',
    maxTouches: 1,
    intervalMinutes: 60,
  });

  const shippingPolicyQuery = useQuery({
    queryKey: ['checkout-shipping-policy', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => checkoutService.getShippingPolicy(tenant!.id),
  });

  const abandonmentConfigQuery = useQuery({
    queryKey: ['checkout-abandonment-config', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => checkoutService.getAbandonmentConfig(tenant!.id),
  });

  useEffect(() => {
    const config = abandonmentConfigQuery.data;
    if (!config) return;
    setAbandonmentConfigForm({
      active: config.active,
      message: config.message ?? '',
      useAiMessage: config.useAiMessage,
      mode: config.mode,
      maxTouches: config.maxTouches,
      intervalMinutes: config.intervalMinutes,
    });
  }, [abandonmentConfigQuery.data]);

  useEffect(() => {
    const policy = shippingPolicyQuery.data;
    if (!policy) {
      return;
    }

    setShippingPolicyForm({
      mode: normalizeShippingFormMode(policy.mode),
      fixedAmount: policy.fixedAmount != null ? String(policy.fixedAmount) : '',
      pricePerKm: policy.pricePerKm != null ? String(policy.pricePerKm) : '',
      minimumAmount: policy.minimumAmount != null ? String(policy.minimumAmount) : '',
      maxRadiusKm: policy.maxRadiusKm != null ? String(policy.maxRadiusKm) : '',
      servicedNeighborhoods: (policy.servicedNeighborhoods ?? []).join(', '),
      deliverySchedule: normalizeDeliverySchedule(policy.deliverySchedule),
      notes: policy.notes ?? '',
      carrierShippingEnabled: policy.carrierShippingEnabled ?? false,
    });
  }, [shippingPolicyQuery.data]);

  useEffect(() => {
    if (!shippingPolicySheetOpen) {
      return;
    }

    const policy = shippingPolicyQuery.data;
    if (policy) {
      setShippingPolicyForm({
        mode: normalizeShippingFormMode(policy.mode),
        fixedAmount: policy.fixedAmount != null ? String(policy.fixedAmount) : '',
        pricePerKm: policy.pricePerKm != null ? String(policy.pricePerKm) : '',
        minimumAmount: policy.minimumAmount != null ? String(policy.minimumAmount) : '',
        maxRadiusKm: policy.maxRadiusKm != null ? String(policy.maxRadiusKm) : '',
        servicedNeighborhoods: (policy.servicedNeighborhoods ?? []).join(', '),
        deliverySchedule: normalizeDeliverySchedule(policy.deliverySchedule),
        notes: policy.notes ?? '',
        carrierShippingEnabled: policy.carrierShippingEnabled ?? false,
      });
      return;
    }

    setShippingPolicyForm({
      mode: 'FIXED',
      fixedAmount: '',
      pricePerKm: '',
      minimumAmount: '',
      maxRadiusKm: '',
      servicedNeighborhoods: '',
      deliverySchedule: buildDefaultDeliverySchedule(),
      notes: '',
      carrierShippingEnabled: false,
    });
    setMapLocation(null);
  }, [shippingPolicyQuery.data, shippingPolicySheetOpen]);

  useEffect(() => {
    if (!shippingPolicySheetOpen || mapLocation || tenant?.street || tenant?.city) {
      return;
    }

    if (shippingPolicyForm.mode !== 'PER_KM') {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    setMapLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'browser',
        });
        setMapLoading(false);
      },
      () => {
        setMapLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, [
    mapLocation,
    shippingPolicyForm.mode,
    shippingPolicySheetOpen,
    tenant?.city,
    tenant?.street,
  ]);

  const updateShippingPolicyMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveTenantId) {
        throw new Error('Empresa não identificada.');
      }

      return checkoutService.updateShippingPolicy(effectiveTenantId, {
        mode: shippingPolicyForm.mode,
        fixedAmount:
          shippingPolicyForm.mode === 'FIXED' && shippingPolicyForm.fixedAmount.trim()
            ? Number(shippingPolicyForm.fixedAmount)
            : null,
        pricePerKm:
          shippingPolicyForm.mode === 'PER_KM' && shippingPolicyForm.pricePerKm.trim()
            ? Number(shippingPolicyForm.pricePerKm)
            : null,
        minimumAmount:
          shippingPolicyForm.mode === 'PER_KM' && shippingPolicyForm.minimumAmount.trim()
            ? Number(shippingPolicyForm.minimumAmount)
            : null,
        maxRadiusKm:
          shippingPolicyForm.mode === 'PER_KM' && shippingPolicyForm.maxRadiusKm.trim()
            ? Number(shippingPolicyForm.maxRadiusKm)
            : null,
        servicedNeighborhoods:
          shippingPolicyForm.mode === 'FIXED'
            ? shippingPolicyForm.servicedNeighborhoods
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
            : [],
        deliverySchedule: shippingPolicyForm.deliverySchedule.map((slot) => ({
          weekday: slot.weekday,
          enabled: slot.enabled,
          startTime: slot.enabled ? slot.startTime ?? null : null,
          endTime: slot.enabled ? slot.endTime ?? null : null,
        })),
        notes: shippingPolicyForm.notes.trim() || null,
        carrierShippingEnabled: shippingPolicyForm.carrierShippingEnabled,
      });
    },
    onSuccess: async () => {
      if (!tenant?.id) return;

      await queryClient.invalidateQueries({
        queryKey: ['checkout-shipping-policy', tenant.id],
      });

      toast({
        title: 'Frete atualizado',
        description: 'As regras de entrega e atendimento já foram salvas.',
      });
      setShippingPolicySheetOpen(false);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao salvar frete',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível salvar a política de frete.',
        }),
      });
    },
  });

  const updateAbandonmentConfigMutation = useMutation({
    mutationFn: async () => {
      const state = useAuthStore.getState();
      const tid = state.tenant?.id || state.user?.tenantId;
      if (!tid) {
        throw new Error('Empresa não identificada.');
      }
      return checkoutService.updateAbandonmentConfig(tid, abandonmentConfigForm);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['checkout-abandonment-config', tenant?.id],
      });
      setAbandonmentConfigOpen(false);
      toast({
        title: 'Configuração salva',
        description: 'As regras de carrinho abandonado foram atualizadas.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao salvar',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível salvar a configuração.',
        }),
        variant: 'destructive',
      });
    },
  });

  const generateAbandonmentMessageMutation = useMutation({
    mutationFn: async () => {
      const state = useAuthStore.getState();
      const tid = state.tenant?.id || state.user?.tenantId;
      if (!tid) {
        throw new Error('Empresa não identificada.');
      }
      return checkoutService.generateAbandonmentMessage(tid);
    },
    onSuccess: (result) => {
      setAbandonmentConfigForm((prev) => ({ ...prev, message: result.message, useAiMessage: false }));
      toast({
        title: 'Mensagem gerada',
        description: 'A IA criou uma sugestão de mensagem de retomada.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao gerar',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível gerar a mensagem.',
        }),
        variant: 'destructive',
      });
    },
  });

  const shippingRadiusKm = Number(shippingPolicyForm.maxRadiusKm || '5') || 5;
  const companyAddress = [
    tenant?.street,
    tenant?.streetNumber,
    tenant?.neighborhood,
    tenant?.city,
    tenant?.state,
  ]
    .filter(Boolean)
    .join(', ');
  const mapEmbedUrl = mapLocation
    ? buildOpenStreetMapEmbedUrl(mapLocation.latitude, mapLocation.longitude, shippingRadiusKm)
    : null;
  const mapCoverageDiameter = Math.max(72, Math.min(220, 64 + shippingRadiusKm * 6));

  return {
    shippingPolicyQuery,
    shippingPolicyForm,
    setShippingPolicyForm,
    shippingPolicySheetOpen,
    setShippingPolicySheetOpen,
    updateShippingPolicyMutation,
    mapLocation,
    mapLoading,
    companyAddress,
    mapEmbedUrl,
    shippingRadiusKm,
    mapCoverageDiameter,
    abandonmentConfigOpen,
    setAbandonmentConfigOpen,
    abandonmentConfigForm,
    setAbandonmentConfigForm,
    abandonmentConfigQuery,
    updateAbandonmentConfigMutation,
    generateAbandonmentMessageMutation,
    requestBrowserLocation() {
      if (!navigator.geolocation) {
        toast({
          title: 'Geolocalização indisponível',
          description: 'Seu navegador não liberou acesso à localização atual.',
        });
        return;
      }

      setMapLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            source: 'browser',
          });
          setMapLoading(false);
        },
        () => {
          setMapLoading(false);
          toast({
            title: 'Não foi possível obter a localização',
            description: 'Libere a localização do navegador para ajustar o raio no mapa.',
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
      );
    },
  };
}
