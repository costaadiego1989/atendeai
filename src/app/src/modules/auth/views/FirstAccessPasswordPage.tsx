import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/shared/stores/auth-store';
import { AuthShell } from '@/modules/auth/components/AuthShell';
import { useChangeFirstAccessPasswordViewModel } from '@/modules/auth/view-models/useChangeFirstAccessPasswordViewModel';

const firstAccessSchema = z
  .object({
    password: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme a senha'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type FirstAccessPasswordForm = z.infer<typeof firstAccessSchema>;

export default function FirstAccessPasswordPage() {
  const { isAuthenticated, user } = useAuthStore();
  const changeFirstAccessPasswordMutation = useChangeFirstAccessPasswordViewModel();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FirstAccessPasswordForm>({
    resolver: zodResolver(firstAccessSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.mustChangePassword) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <AuthShell
      title="Atualização de Credenciais"
      subtitle="Por medidas de segurança, solicitamos a redefinição da sua senha provisória antes de acessar o AtendeAí."
      footer={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <KeyRound className="h-4 w-4" />
          Esta etapa de verificação é obrigatória apenas no primeiro acesso.
        </div>
      }
    >
      <form
        onSubmit={handleSubmit(({ confirmPassword: _confirmPassword, password }) =>
          changeFirstAccessPasswordMutation.mutate({ password }),
        )}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Digite sua nova senha"
              {...register('password')}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              {...register('confirmPassword')}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0"
              onClick={() => setShowConfirmPassword((current) => !current)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={changeFirstAccessPasswordMutation.isPending}
        >
          {changeFirstAccessPasswordMutation.isPending
            ? 'Atualizando credenciais...'
            : 'Salvar e continuar'}
        </Button>
      </form>
    </AuthShell>
  );
}
