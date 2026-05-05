import { apiClient } from '@/shared/api/client';
import {
  SalesCoupon,
  CreateCouponInput,
  UpdateCouponInput,
  type RedeemSalesCouponInput,
  type SalesCouponRedeemResponse,
} from './sales-types';

export const salesCouponsService = {
  async listCoupons(tenantId: string, onlyActive?: boolean): Promise<SalesCoupon[]> {
    const params = new URLSearchParams();
    if (onlyActive !== undefined) {
      params.append('onlyActive', String(onlyActive));
    }
    return apiClient.get(`/sales/coupons?${params.toString()}`);
  },

  async createCoupon(tenantId: string, input: CreateCouponInput): Promise<SalesCoupon> {
    return apiClient.post('/sales/coupons', input);
  },

  async updateCoupon(tenantId: string, id: string, input: Omit<UpdateCouponInput, 'id'>): Promise<SalesCoupon> {
    return apiClient.put(`/sales/coupons/${id}`, input);
  },

  async deleteCoupon(tenantId: string, id: string): Promise<void> {
    await apiClient.delete(`/sales/coupons/${id}`);
  },

  redeemCoupon(input: RedeemSalesCouponInput): Promise<SalesCouponRedeemResponse> {
    return apiClient.post('/sales/coupons/redeem', input);
  },

  redeemCouponById(
    couponId: string,
    input?: Pick<RedeemSalesCouponInput, 'contactId' | 'conversationId'>,
  ): Promise<SalesCouponRedeemResponse> {
    return apiClient.post(`/sales/coupons/${couponId}/redeem`, input ?? {});
  },
};
