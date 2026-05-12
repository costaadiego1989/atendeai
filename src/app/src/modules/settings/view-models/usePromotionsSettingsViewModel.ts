import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useUndo } from '@/shared/hooks/useUndo';
import { ToastAction } from '@/components/ui/toast';
import { companySettingsService } from '@/modules/settings/services/company-settings-service';
import { useCompanySettingsQuery } from '@/modules/settings/view-models/useCompanySettingsQuery';
import { usersService } from '@/modules/users/services/users-service';

/**
 * ViewModel para promoções INFORMATIVAS/MARKETING do tenant.
 * Dados vêm de /tenants/:id/promotions (JSON no aggregate do tenant).
 * Expostas ao chatbot e integrações externas via IntegrationController.
 *
 * Promoções comerciais com desconto real ficam no módulo Sales
 * (usePromotionsViewModel → /sales/promotions).
 */
export function usePromotionsSettingsViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [deletePromotionId, setDeletePromotionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [promotionForm, setPromotionForm] = useState({
    title: '',
    discount: '',
    type: 'PERCENTAGE',
    expiresAt: '',
    assignedUserId: 'unassigned',
    description: '',
  });

  const tenantSettingsQuery = useCompanySettingsQuery(tenant?.id);
  const allPromotions = tenantSettingsQuery.data?.promotions ?? [];

  const usersQuery = useQuery({
    queryKey: ['promotion-settings-users', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => usersService.listUsers(tenant!.id),
  });

  const filteredPromotions = useMemo(() => {
    return allPromotions.filter((promo) => {
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
  }, [allPromotions, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: allPromotions.length,
      active: allPromotions.filter((p) => p.active).length,
      expired: allPromotions.filter((p) => !p.active).length,
      withOwner: allPromotions.filter((p) => p.assignedUserId).length,
    };
  }, [allPromotions]);

  const resetPromotionForm = () => {
    setPromotionForm({
      title: '',
      discount: '',
      type: 'PERCENTAGE',
      expiresAt: '',
      assignedUserId: 'unassigned',
      description: '',
    });
    setEditingPromotionId(null);
  };

  const openCreateSheet = () => {
    resetPromotionForm();
    setSheetOpen(true);
  };

  const openEditSheet = (promotionId: string) => {
    const promotion = allPromotions.find((promo) => promo.id === promotionId);
    if (!promotion) return;

    const normalizedValue = (promotion.value ?? '')
      .replace('R$', '')
      .replace('%', '')
      .trim();

    setEditingPromotionId(promotion.id);
    setPromotionForm({
      title: promotion.title,
      discount: normalizedValue,
      type: promotion.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
      expiresAt: promotion.expiresAt ?? promotion.validTo ?? '',
      assignedUserId: promotion.assignedUserId ?? 'unassigned',
      description: promotion.description ?? '',
    });
    setSheetOpen(true);
  };

  const createPromotionMutation = useMutation({
    mutationFn: () =>
      companySettingsService.addPromotion(tenant!.id, {
        title: promotionForm.title.trim(),
        description: promotionForm.description.trim(),
        value:
          promotionForm.type === 'PERCENTAGE'
            ? `${promotionForm.discount.trim()}%`
            : `R$ ${promotionForm.discount.trim()}`,
        expiresAt: promotionForm.expiresAt || undefined,
        assignedUserId:
          promotionForm.assignedUserId === 'unassigned'
            ? undefined
            : promotionForm.assignedUserId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenant?.id] });
      setSheetOpen(false);
      resetPromotionForm();
      toast({
        title: 'Promoção salva',
        description: 'A campanha foi registrada com validade e responsável.',
      });
    },
    onError: () => {
      toast({
        title: 'Falha ao salvar promoção',
        description: 'Não foi possível registrar a promoção agora.',
        variant: 'destructive',
      });
    },
  });

  const updatePromotionMutation = useMutation({
    mutationFn: () =>
      companySettingsService.updatePromotion(tenant!.id, {
        promotionId: editingPromotionId!,
        title: promotionForm.title.trim(),
        description: promotionForm.description.trim(),
        value:
          promotionForm.type === 'PERCENTAGE'
            ? `${promotionForm.discount.trim()}%`
            : `R$ ${promotionForm.discount.trim()}`,
        expiresAt: promotionForm.expiresAt || undefined,
        assignedUserId:
          promotionForm.assignedUserId === 'unassigned'
            ? undefined
            : promotionForm.assignedUserId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenant?.id] });
      setSheetOpen(false);
      resetPromotionForm();
      toast({
        title: 'Promoção atualizada',
        description: 'A campanha foi atualizada com os novos dados.',
      });
    },
    onError: () => {
      toast({
        title: 'Falha ao atualizar promoção',
        description: 'Não foi possível salvar as alterações agora.',
        variant: 'destructive',
      });
    },
  });

  const { executeWithUndo, undo } = useUndo();

  const initiateDeletePromotion = (id: string) => {
    const previousSettings = queryClient.getQueryData(['tenant-settings', tenant?.id]);

    // Optimistic cache update
    queryClient.setQueryData(['tenant-settings', tenant?.id], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        promotions: old.promotions?.filter((p: any) => p.id !== id),
      };
    });

    const { dismiss } = toast({
      title: 'Promoção oculta',
      description: 'A campanha foi removida temporariamente.',
      action: React.createElement(
        ToastAction,
        { altText: "Desfazer exclusão", onClick: undo },
        "Desfazer"
      ) as any,
    });

  executeWithUndo({
    delayMs: 4000,
    action: () => {
      companySettingsService.deletePromotion(tenant!.id, id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenant?.id] });
        toast({ title: 'Promoção removida em definitivo' });
      }).catch(() => {
        queryClient.setQueryData(['tenant-settings', tenant?.id], previousSettings);
        toast({ title: 'Falha ao remover promoção', variant: 'destructive' });
      });
    },
    onUndo: () => {
      queryClient.setQueryData(['tenant-settings', tenant?.id], previousSettings);
      dismiss();
    }
  });
};

const savePromotion = () => {
  if (editingPromotionId) {
    updatePromotionMutation.mutate();
    return;
  }
  createPromotionMutation.mutate();
};

const isSavingPromotion =
  createPromotionMutation.isPending || updatePromotionMutation.isPending;

return {
  tenantSettingsQuery,
  promotions: filteredPromotions,
  allPromotions,
  stats,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  usersQuery,
  sheetOpen,
  setSheetOpen,
  editingPromotionId,
  setEditingPromotionId,
  deletePromotionId,
  setDeletePromotionId,
  promotionForm,
  setPromotionForm,
  resetPromotionForm,
  openCreateSheet,
  openEditSheet,
  savePromotion,
  isSavingPromotion,
  initiateDeletePromotion,
  // Keep deletePromotionMutation around just in case it's still destructured by views briefly
  deletePromotionMutation: { isPending: false } as any,
};
}
