import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/shared/stores/auth-store';
import { salesService } from '@/modules/sales/services/sales-service';
import { catalogService } from '@/modules/catalog/services/catalog-service';
import type { SalesPromotionTarget } from '@/modules/sales/services/sales-types';

export function useCouponsViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount: '',
    type: 'PERCENTAGE',
    maxUses: '0',
    isUnlimited: true,
    startsAt: new Date().toISOString().split('T')[0],
    expiresAt: '',
    itemTargetIds: [] as string[],
    categoryTargetIds: [] as string[],
  });

  const queryKey = ['sales-coupons', tenant?.id];

  const query = useQuery({
    queryKey,
    enabled: Boolean(tenant?.id),
    queryFn: () => salesService.listCoupons(tenant!.id),
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

  const coupons = query.data ?? [];

  const filteredCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      const matchesSearch =
        !search.trim() ||
        coupon.code.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && coupon.active) ||
        (statusFilter === 'EXPIRED' && !coupon.active);
      return matchesSearch && matchesStatus;
    });
  }, [coupons, search, statusFilter]);

  const stats = useMemo(() => {
    const fixedAmountCoupons = coupons.filter(c => c.discountType === 'FIXED_AMOUNT');
    const pctCoupons = coupons.filter(c => c.discountType === 'PERCENTAGE');
    
    // Calcula economia SOMENTE para cupons de valor fixo, pois o % dependeria do checkout
    const estimatedSavings = fixedAmountCoupons.reduce((acc, c) => acc + (c.usedCount * c.discountValue), 0);
    const avgDiscountPct = pctCoupons.length 
      ? Math.round(pctCoupons.reduce((acc, c) => acc + c.discountValue, 0) / pctCoupons.length) 
      : 0;

    return {
      active: coupons.filter((c) => c.active).length,
      totalUsages: coupons.reduce((acc, c) => acc + c.usedCount, 0),
      estimatedSavings,
      avgDiscountPct,
    };
  }, [coupons]);

  const resetForm = () => {
    setForm({
      code: '',
      description: '',
      discount: '',
      type: 'PERCENTAGE',
      maxUses: '0',
      isUnlimited: true,
      startsAt: new Date().toISOString().split('T')[0],
      expiresAt: '',
      itemTargetIds: [],
      categoryTargetIds: [],
    });
    setEditingCouponId(null);
  };

  const openCreateSheet = () => {
    resetForm();
    setSheetOpen(true);
  };

  const openEditSheet = (couponId: string) => {
    const coupon = coupons.find((c) => c.id === couponId);
    if (!coupon) return;

    const targets = coupon.targets && coupon.targets.length > 0
      ? coupon.targets
      : coupon.catalogItemId
        ? [{ targetType: 'ITEM' as const, targetId: coupon.catalogItemId }]
        : [];

    setEditingCouponId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discount: String(coupon.discountValue),
      type: coupon.discountType,
      maxUses: String(coupon.maxUses),
      isUnlimited: coupon.maxUses === 0,
      startsAt: new Date(coupon.startsAt).toISOString().split('T')[0],
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().split('T')[0] : '',
      itemTargetIds: targets.filter((target) => target.targetType === 'ITEM').map((target) => target.targetId),
      categoryTargetIds: targets.filter((target) => target.targetType === 'CATEGORY').map((target) => target.targetId),
    });
    setSheetOpen(true);
  };

  const buildTargets = (): SalesPromotionTarget[] => [
    ...form.itemTargetIds.map((targetId) => ({ targetType: 'ITEM' as const, targetId })),
    ...form.categoryTargetIds.map((targetId) => ({ targetType: 'CATEGORY' as const, targetId })),
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
      salesService.createCoupon(tenant!.id, {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        discountType: form.type as any,
        discountValue: Number(form.discount),
        maxUses: form.isUnlimited ? 0 : Number(form.maxUses),
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        targets: buildTargets(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setSheetOpen(false);
      resetForm();
      toast({
        title: 'Cupom criado',
      });
    },
    onError: () => {
      toast({
        title: 'Falha ao criar cupom',
        description: 'Pode ser que este código já exista.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      salesService.updateCoupon(tenant!.id, editingCouponId!, {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        discountType: form.type as any,
        discountValue: Number(form.discount),
        maxUses: form.isUnlimited ? 0 : Number(form.maxUses),
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        targets: buildTargets(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setSheetOpen(false);
      resetForm();
      toast({
        title: 'Cupom atualizado',
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
      salesService.updateCoupon(tenant!.id, id, {
        active,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => {
      toast({
        title: 'Falha ao alterar status do cupom',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesService.deleteCoupon(tenant!.id, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Cupom excluído' });
    },
    onError: () => {
      toast({
        title: 'Falha ao excluir cupom',
        variant: 'destructive',
      });
    },
  });

  const saveCoupon = () => {
    if (editingCouponId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  return {
    query,
    coupons: filteredCoupons,
    stats,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sheetOpen,
    setSheetOpen,
    editingCouponId,
    form,
    setForm,
    itemOptions: itemOptionsQuery.data ?? [],
    categoryOptions: categoryOptionsQuery.data ?? [],
    describeTargets,
    resetForm,
    openCreateSheet,
    openEditSheet,
    saveCoupon,
    isSaving: createMutation.isPending || updateMutation.isPending,
    toggleStatusMutation,
    deleteMutation,
  };
}
