import { Navigate } from 'react-router-dom';

interface PlatformAdminNavGateProps {
  children: React.ReactNode;
}

export function PlatformAdminNavGate({ children }: PlatformAdminNavGateProps) {
  const show =
    import.meta.env.VITE_SHOW_PLATFORM_ADMIN_NAV === 'true' &&
    !!(import.meta.env.VITE_PLATFORM_ADMIN_API_KEY as string | undefined)?.trim();

  if (!show) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
