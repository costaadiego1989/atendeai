import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/shared/stores/auth-store';
import { AuthShell } from '@/modules/auth/components/AuthShell';
import { useLoginViewModel } from '@/modules/auth/view-models/useLoginViewModel';
import { authService } from '@/modules/auth/services/auth-service';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { isAuthenticated, user, clearSession } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const loginMutation = useLoginViewModel();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const sessionExpired = searchParams.get('reason') === 'session-expired';
  const isFreshLogin = searchParams.get('fresh') === '1';

  useEffect(() => {
    if (isFreshLogin) {
      setClearingSession(true);
      clearSession();
      authService.logout().catch(() => {}).finally(() => {
        setClearingSession(false);
        searchParams.delete('fresh');
        setSearchParams(searchParams, { replace: true });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (clearingSession) {
    return null;
  }

  if (isAuthenticated && !isFreshLogin) {
    return (
      <Navigate
        to={user?.mustChangePassword ? '/first-access-password' : '/app/dashboard'}
        replace
      />
    );
  }

  return (
    <AuthShell
      title="Acesse sua Máquina de Vendas"
      subtitle="Sua central de automação com IA pelo WhatsApp. Escale prospecção, gerencie leads no CRM e automatize cobranças e inventário."
      footer={
        <div className="flex items-center justify-between gap-4">
          <span>Ainda não possui uma conta?</span>
          <Link className="font-medium text-primary hover:underline" to="/register">
            Cadastre-se
          </Link>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit((values) => loginMutation.mutate(values))}
        className="space-y-5"
      >
        {sessionExpired && (
          <Alert>
            <AlertTitle>Sessão expirada</AlertTitle>
            <AlertDescription>
              Por segurança, sua sessão foi encerrada. Entre novamente para
              continuar.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="você@empresa.com"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="password">Senha</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Digite sua senha"
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

        <Button
          type="submit"
          className="w-full"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </AuthShell>
  );
}
