import { apiClient } from '@/shared/api/client';
import { SalesPromotion, CreatePromotionInput, UpdatePromotionInput } from './sales-types';

/**
 * Sales Promotions — promoções comerciais com lógica de desconto (percentual ou valor fixo),
 * targets de catálogo (itens/categorias), e período de vigência.
 *
 * IMPORTANTE: NÃO confundir com "Tenant Promotions" (módulo settings), que são promoções
 * informativas/marketing armazenadas como JSON no aggregate do tenant e expostas para
 * integrações externas (chatbot, widget). Os dois conceitos usam tabelas/storage distintos:
 * - Sales: tabela `sales_promotions` (schema sales_schema)
 * - Tenant: coluna JSON `promotions` na tabela `tenants` (schema tenant_schema)
 *
 * Fonte de verdade para descontos aplicáveis em links/charges: este serviço (/sales/promotions).
 * Fonte de verdade para promoções exibidas pelo chatbot/integração: settings (/tenants/:id/promotions).
 */
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
