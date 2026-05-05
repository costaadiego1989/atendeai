import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/shared/stores/auth-store';
import { AuthShell } from '@/modules/auth/components/AuthShell';
import { useResetPasswordViewModel } from '@/modules/auth/view-models/useResetPasswordViewModel';

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme a nova senha'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { isAuthenticated } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const resetPasswordMutation = useResetPasswordViewModel();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <AuthShell
      title="Redefinição de Senha"
      subtitle="Crie uma nova senha segura para restaurar seu acesso à plataforma AtendeAí."
      footer={
        <div className="flex items-center justify-between gap-4">
          <span>O link expirou?</span>
          <Link
            className="font-medium text-primary hover:underline"
            to="/forgot-password"
          >
            Solicitar novamente
          </Link>
        </div>
      }
    >
      {!token ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            O token de redefinição é inválido ou não foi encontrado. Por favor,
            solicite um novo link para continuar.
          </p>
          <Button asChild className="w-full">
            <Link to="/forgot-password">Solicitar novo link</Link>
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(({ confirmPassword: _confirmPassword, ...values }) =>
            resetPasswordMutation.mutate({
              token,
              password: values.password,
            }),
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
                placeholder="Digite a nova senha"
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
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={resetPasswordMutation.isPending}
          >
            {resetPasswordMutation.isPending
              ? 'Redefinindo senha...'
              : 'Salvar nova senha'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
