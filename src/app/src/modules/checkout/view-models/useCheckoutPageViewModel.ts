import { useCheckoutOrdersViewModel } from './useCheckoutOrdersViewModel';
import { useCheckoutConfigViewModel } from './useCheckoutConfigViewModel';
import { useCheckoutAnalyticsViewModel } from './useCheckoutAnalyticsViewModel';
import type { ICheckoutPageViewModel } from './checkout-page-viewmodel.types';

export type {
  CheckoutTab,
  CheckoutPeriodFilter,
  CheckoutCustomRange,
} from './useCheckoutOrdersViewModel';
export type { CheckoutReportStatusFilter } from './useCheckoutAnalyticsViewModel';
export type { ICheckoutPageViewModel } from './checkout-page-viewmodel.types';

export function useCheckoutPageViewModel() {
  const orders = useCheckoutOrdersViewModel();
  const config = useCheckoutConfigViewModel();
  const analytics = useCheckoutAnalyticsViewModel({
    allOrders: orders.allOrders,
    ordersPeriodRange: orders.ordersPeriodRange,
  });

  return {
    ...orders,
    ...config,
    ...analytics,
  };
}

export type CheckoutPageViewModel = ICheckoutPageViewModel;
