import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import {
  authService,
  type ResetPasswordInput,
} from '@/modules/auth/services/auth-service';

export function useResetPasswordViewModel() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authService.resetPassword(input),
    onSuccess: (response) => {
      toast({
        title: 'Senha redefinida',
        description: response.message,
      });
      navigate('/login', { replace: true });
    },
    onError: (error) => {
      const message = getFriendlyErrorMessage(error, {
        fallbackMessage: 'Não foi possível redefinir a senha.',
      });

      toast({
        title: 'Falha ao redefinir senha',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
