import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import { authService } from '@/modules/auth/services/auth-service';

export function useChangeFirstAccessPasswordViewModel() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();

  return useMutation({
    mutationFn: (input: { password: string }) =>
      authService.changeFirstAccessPassword(input),
    onSuccess: () => {
      updateUser({ mustChangePassword: false });
      toast({
        title: 'Senha atualizada',
        description: 'Seu acesso foi liberado. Agora você pode usar a plataforma normalmente.',
      });
      navigate('/app/dashboard', { replace: true });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar senha',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível atualizar sua senha agora.',
        }),
        variant: 'destructive',
      });
    },
  });
}
