import { ReactNode } from 'react';

/*
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth-store';
import { hasTenantModuleAccess } from '@/shared/lib/tenant-module-access';
import { PageSkeleton } from '@/shared/ui/Skeletons';
*/

interface ModuleAccessGuardProps {
  moduleCode: string;
  children: ReactNode;
  fallbackPath?: string;
  fallback?: ReactNode;
}

export function ModuleAccessGuard({
  children,
}: ModuleAccessGuardProps) {
  /*
  const location = useLocation();
  const { isLoading, isAuthenticated, tenant } = useAuthStore();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasTenantModuleAccess(tenant, moduleCode)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return <Navigate to={fallbackPath} replace state={{ from: location }} />;
  }
  */

  return <>{children}</>;
}
