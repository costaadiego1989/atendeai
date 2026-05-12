import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { HttpError } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  authService,
  type LoginInput,
} from '@/modules/auth/services/auth-service';

export function useLoginViewModel() {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();

  return useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: (session) => {
      setSession(session.user, session.tenant);
      navigate(
        session.user.mustChangePassword ? '/first-access-password' : '/app/dashboard',
        { replace: true },
      );
    },
    onError: (error) => {
      const isThrottled = error instanceof HttpError && error.status === 429;
      const message = getFriendlyErrorMessage(error, {
        fallbackMessage: 'Não foi possível entrar agora.',
      });

      toast({
        title: isThrottled ? 'Limite de tentativas atingido' : 'Falha no login',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
