import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/shared/stores/auth-store';
import { salesService } from '@/modules/sales/services/sales-service';
import { catalogService } from '@/modules/catalog/services/catalog-service';
import type { SalesPromotionTarget } from '@/modules/sales/services/sales-types';

/**
 * ViewModel para promoções COMERCIAIS (descontos em links/charges).
 * Dados vêm de /sales/promotions (tabela sales_promotions).
 *
 * Promoções informativas do chatbot/integração ficam em Settings
 * (usePromotionsSettingsViewModel → /tenants/:id/promotions).
 */
export function usePromotionsViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [promotionForm, setPromotionForm] = useState({
    title: '',
    description: '',
    discount: '',
    type: 'PERCENTAGE',
    startsAt: new Date().toISOString().split('T')[0],
    expiresAt: '',
    itemTargetIds: [] as string[],
    categoryTargetIds: [] as string[],
  });

  const queryKey = ['sales-promotions', tenant?.id];

  const query = useQuery({
    queryKey,
    enabled: Boolean(tenant?.id),
    queryFn: () => salesService.listPromotions(tenant!.id),
  });

  const itemOptionsQuery = useQuery({
    queryKey: ['catalog-item-options', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => catalogService.listItemOptions(tenant!.id),
  });

  const categoryOptionsQuery = useQuery({
    queryKey: ['catalog-category-options', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => catalogService.listCategoryOptions(tenant!.id),
  });

  const promotions = query.data ?? [];

  const filteredPromotions = useMemo(() => {
    return promotions.filter((promo) => {
      const matchesSearch =
        !search.trim() ||
        promo.title.toLowerCase().includes(search.toLowerCase()) ||
        (promo.description ?? '').toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && promo.active) ||
        (statusFilter === 'EXPIRED' && !promo.active);
      return matchesSearch && matchesStatus;
    });
  }, [promotions, search, statusFilter]);

  const stats = useMemo(() => {
    const fixedAmountPromos = promotions.filter(p => p.discountType === 'FIXED_AMOUNT');
    const pctPromos = promotions.filter(p => p.discountType === 'PERCENTAGE');
    
    const avgDiscountPct = pctPromos.length 
      ? Math.round(pctPromos.reduce((acc, p) => acc + p.discountValue, 0) / pctPromos.length) 
      : 0;

    const maxDiscountFixed = fixedAmountPromos.length
      ? Math.max(...fixedAmountPromos.map(p => p.discountValue))
      : 0;

    return {
      active: promotions.filter((p) => p.active).length,
      avgDiscountPct,
      maxDiscountFixed,
      withCondition: promotions.filter(p => !!p.minimumOrder).length,
    };
  }, [promotions]);

  const resetForm = () => {
    setPromotionForm({
      title: '',
      description: '',
      discount: '',
      type: 'PERCENTAGE',
      startsAt: new Date().toISOString().split('T')[0],
      expiresAt: '',
      itemTargetIds: [],
      categoryTargetIds: [],
    });
    setEditingPromotionId(null);
  };

  const openCreateSheet = () => {
    resetForm();
    setSheetOpen(true);
  };

  const openEditSheet = (promotionId: string) => {
    const promotion = promotions.find((promo) => promo.id === promotionId);
    if (!promotion) return;

    const targets = promotion.targets && promotion.targets.length > 0
      ? promotion.targets
      : promotion.catalogItemId
        ? [{ targetType: 'ITEM' as const, targetId: promotion.catalogItemId }]
        : [];

    setEditingPromotionId(promotion.id);
    setPromotionForm({
      title: promotion.title,
      description: promotion.description || '',
      discount: String(promotion.discountValue),
      type: promotion.discountType,
      startsAt: new Date(promotion.startsAt).toISOString().split('T')[0],
      expiresAt: promotion.expiresAt ? new Date(promotion.expiresAt).toISOString().split('T')[0] : '',
      itemTargetIds: targets.filter((target) => target.targetType === 'ITEM').map((target) => target.targetId),
      categoryTargetIds: targets.filter((target) => target.targetType === 'CATEGORY').map((target) => target.targetId),
    });
    setSheetOpen(true);
  };

  const buildTargets = (): SalesPromotionTarget[] => [
    ...promotionForm.itemTargetIds.map((targetId) => ({ targetType: 'ITEM' as const, targetId })),
    ...promotionForm.categoryTargetIds.map((targetId) => ({ targetType: 'CATEGORY' as const, targetId })),
  ];

  const targetLabel = (target: SalesPromotionTarget) => {
    const options = target.targetType === 'ITEM'
      ? itemOptionsQuery.data ?? []
      : categoryOptionsQuery.data ?? [];
    return options.find((option) => option.value === target.targetId)?.label ?? target.targetId;
  };

  const describeTargets = (targets?: SalesPromotionTarget[], catalogItemId?: string | null) => {
    const effectiveTargets = targets && targets.length > 0
      ? targets
      : catalogItemId
        ? [{ targetType: 'ITEM' as const, targetId: catalogItemId }]
        : [];
    if (effectiveTargets.length === 0) return ['Todos os itens'];
    return effectiveTargets.map(targetLabel);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      salesService.createPromotion(tenant!.id, {
        title: promotionForm.title.trim(),
        description: promotionForm.description.trim(),
        discountType: promotionForm.type as any,
        discountValue: Number(promotionForm.discount),
        startsAt: new Date(promotionForm.startsAt).toISOString(),
        expiresAt: promotionForm.expiresAt ? new Date(promotionForm.expiresAt).toISOString() : null,
        targets: buildTargets(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setSheetOpen(false);
      resetForm();
      toast({
        title: 'Promoção criada',
        description: 'A campanha foi registrada com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Falha ao criar promoção',
        description: 'Verifique os dados informados.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      salesService.updatePromotion(tenant!.id, editingPromotionId!, {
        title: promotionForm.title.trim(),
        description: promotionForm.description.trim(),
        discountType: promotionForm.type as any,
        discountValue: Number(promotionForm.discount),
        startsAt: new Date(promotionForm.startsAt).toISOString(),
        expiresAt: promotionForm.expiresAt ? new Date(promotionForm.expiresAt).toISOString() : null,
        targets: buildTargets(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setSheetOpen(false);
      resetForm();
      toast({
        title: 'Promoção atualizada',
      });
    },
    onError: () => {
      toast({
        title: 'Falha ao atualizar',
        variant: 'destructive',
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      salesService.updatePromotion(tenant!.id, id, {
        active,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesService.deletePromotion(tenant!.id, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Promoção excluída' });
    },
  });

  const savePromotion = () => {
    if (editingPromotionId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  return {
    query,
    promotions: filteredPromotions,
    stats,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sheetOpen,
    setSheetOpen,
    editingPromotionId,
    promotionForm,
    setPromotionForm,
    itemOptions: itemOptionsQuery.data ?? [],
    categoryOptions: categoryOptionsQuery.data ?? [],
    describeTargets,
    resetForm,
    openCreateSheet,
    openEditSheet,
    savePromotion,
    isSaving: createMutation.isPending || updateMutation.isPending,
    toggleStatusMutation,
    deleteMutation,
  };
}
