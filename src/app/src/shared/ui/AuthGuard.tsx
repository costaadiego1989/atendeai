import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth-store';
import { PageSkeleton } from '@/shared/ui/Skeletons';

interface AuthGuardProps {
  children: ReactNode;
  requiredRoles?: Array<'OWNER' | 'ADMIN' | 'AGENT'>;
}

export function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) return <PageSkeleton />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword) {
    return <Navigate to="/first-access-password" replace />;
  }
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
