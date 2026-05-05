import { useEffect } from 'react';
import { HttpError } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth-store';
import { authService } from '@/modules/auth/services/auth-service';

export function useAuthBootstrap() {
  const { setSession, clearSession, setLoading } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);

      try {
        const session = await authService.getCurrentSession();
        if (!cancelled) {
          setSession(session.user, session.tenant);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof HttpError && error.status !== 401) {
          setLoading(false);
          return;
        }

        clearSession();
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [clearSession, setLoading, setSession]);
}
