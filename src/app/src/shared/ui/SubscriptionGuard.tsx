import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth-store';
import { PageSkeleton } from '@/shared/ui/Skeletons';

interface SubscriptionGuardProps {
  children: ReactNode;
}

function isTrialExpired(tenant: { plan?: string; createdAt?: string } | null): boolean {
  if (!tenant || tenant.plan !== 'TRIAL' || !tenant.createdAt) return false;

  const creationDate = new Date(tenant.createdAt);
  const expirationDate = new Date(creationDate);
  expirationDate.setDate(creationDate.getDate() + 7);

  return new Date() >= expirationDate;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { tenant, isLoading, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <PageSkeleton />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isBillingPage = location.pathname.includes('/app/billing');

  const shouldBlock =
    tenant?.planStatus === 'EXPIRED' ||
    tenant?.planStatus === 'CANCELED' ||
    isTrialExpired(tenant);

  if (shouldBlock && !isBillingPage) {
    return <Navigate to="/app/billing/usage" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
