import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { HttpError } from '@/shared/api/client';
import {
  authService,
  type ForgotPasswordInput,
} from '@/modules/auth/services/auth-service';

export function useForgotPasswordViewModel() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      authService.requestPasswordReset(input),
    onSuccess: (response) => {
      toast({
        title: 'Verifique seu e-mail',
        description: response.message,
      });
      navigate('/login');
    },
    onError: (error) => {
      const isThrottled = error instanceof HttpError && error.status === 429;
      const message = getFriendlyErrorMessage(error, {
        fallbackMessage: 'Não foi possível enviar o link de redefinição.',
      });

      toast({
        title: isThrottled ? 'Limite de tentativas atingido' : 'Falha ao solicitar redefinição',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
