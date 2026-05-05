import { apiClient, BASE_URL } from '@/shared/api/client';
import type { SalesPaymentLinksPage } from '@/shared/types';
import { withBranchQuery } from './sales-service-helpers';
import type {
  CreateSalesPaymentLinkInput,
  CreateSalesSplitChargeInput,
  CreateSalesSplitChargeResponse,
  ListPaymentLinksParams,
} from './sales-types';

export const salesPaymentLinksService = {
  listPaymentLinks(params: ListPaymentLinksParams): Promise<SalesPaymentLinksPage> {
    return apiClient.get('/sales/links', params);
  },

  async downloadPaymentLinksReport(params: Omit<ListPaymentLinksParams, 'page' | 'pageSize'>): Promise<void> {
    const searchParams = new URLSearchParams();

    if (params.search) searchParams.set('search', params.search);
    if (params.status) searchParams.set('status', params.status);
    if (params.source) searchParams.set('source', params.source);
    if (params.branchId) searchParams.set('branchId', params.branchId);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const anchor = document.createElement('a');
    anchor.href = `${BASE_URL}/sales/links/report.csv${suffix}`;
    anchor.download = 'sales-Cobranças.csv';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },

  createPaymentLink(input: CreateSalesPaymentLinkInput) {
    const { branchId, ...payload } = input;
    return apiClient.post(withBranchQuery('/sales/links', branchId), payload);
  },

  createSplitCharge(input: CreateSalesSplitChargeInput): Promise<CreateSalesSplitChargeResponse> {
    const { branchId, ...payload } = input;
    return apiClient.post(withBranchQuery('/sales/charges', branchId), payload);
  },

  pausePaymentLink(paymentLinkId: string) {
    return apiClient.patch(`/sales/links/${paymentLinkId}/pause`);
  },

  resumePaymentLink(paymentLinkId: string) {
    return apiClient.patch(`/sales/links/${paymentLinkId}/resume`);
  },

  deletePaymentLink(paymentLinkId: string) {
    return apiClient.delete(`/sales/links/${paymentLinkId}`);
  },
};
