import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  authService,
  type RegisterInput,
} from '@/modules/auth/services/auth-service';

export function useRegisterViewModel() {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();

  return useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
    onSuccess: (session) => {
      setSession(session.user, session.tenant);
      toast({
        title: 'Conta criada',
        description: 'Seu acesso foi criado e a sessão ja esta ativa.',
      });
      navigate('/app/dashboard', { replace: true });
    },
    onError: (error) => {
      const message = getFriendlyErrorMessage(error, {
        fallbackMessage: 'não foi possível criar sua conta agora.',
      });

      toast({
        title: 'Falha no cadastro',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
