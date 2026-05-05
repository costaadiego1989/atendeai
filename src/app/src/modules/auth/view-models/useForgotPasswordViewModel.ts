import { useMutation } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import {
  authService,
  type ForgotPasswordInput,
} from '@/modules/auth/services/auth-service';

export function useForgotPasswordViewModel() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      authService.requestPasswordReset(input),
    onSuccess: (response) => {
      toast({
        title: 'Verifique seu e-mail',
        description: response.message,
      });
    },
    onError: (error) => {
      const message = getFriendlyErrorMessage(error, {
        fallbackMessage: 'Não foi possível enviar o link de redefinição.',
      });

      toast({
        title: 'Falha ao solicitar redefinição',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
