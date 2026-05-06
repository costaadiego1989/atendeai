import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth-store';
import { PageSkeleton } from '@/shared/ui/Skeletons';

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { tenant, isLoading, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <PageSkeleton />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isBillingPage = location.pathname.includes('/app/billing');

  if ((tenant?.planStatus === 'EXPIRED' || tenant?.planStatus === 'CANCELED') && !isBillingPage) {
    return <Navigate to="/app/billing/usage" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
