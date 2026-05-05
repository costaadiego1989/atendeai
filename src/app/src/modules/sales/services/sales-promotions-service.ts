import { apiClient } from '@/shared/api/client';
import { SalesPromotion, CreatePromotionInput, UpdatePromotionInput } from './sales-types';

export const salesPromotionsService = {
  async listPromotions(tenantId: string, onlyActive?: boolean): Promise<SalesPromotion[]> {
    const params = new URLSearchParams();
    if (onlyActive !== undefined) {
      params.append('onlyActive', String(onlyActive));
    }
    return apiClient.get(`/sales/promotions?${params.toString()}`);
  },

  async createPromotion(tenantId: string, input: CreatePromotionInput): Promise<SalesPromotion> {
    return apiClient.post('/sales/promotions', input);
  },

  async updatePromotion(tenantId: string, id: string, input: Omit<UpdatePromotionInput, 'id'>): Promise<SalesPromotion> {
    return apiClient.put(`/sales/promotions/${id}`, input);
  },

  async deletePromotion(tenantId: string, id: string): Promise<void> {
    await apiClient.delete(`/sales/promotions/${id}`);
  },
};
