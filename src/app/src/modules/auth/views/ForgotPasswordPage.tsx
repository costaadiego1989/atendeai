import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/shared/stores/auth-store';
import { AuthShell } from '@/modules/auth/components/AuthShell';
import { useForgotPasswordViewModel } from '@/modules/auth/view-models/useForgotPasswordViewModel';

const forgotPasswordSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { isAuthenticated } = useAuthStore();
  const forgotPasswordMutation = useForgotPasswordViewModel();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <AuthShell
      title="Recuperação de Acesso"
      subtitle="Informe seu e-mail corporativo para receber as instruções de redefinição de senha."
      footer={
        <div className="flex items-center justify-between gap-4">
          <span>Lembrou sua senha?</span>
          <Link className="font-medium text-primary hover:underline" to="/login">
            Voltar para login
          </Link>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit((values) => forgotPasswordMutation.mutate(values))}
        className="space-y-5"
      >
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

        <Button
          type="submit"
          className="w-full"
          disabled={forgotPasswordMutation.isPending}
        >
          {forgotPasswordMutation.isPending
            ? 'Enviando instruções...'
            : 'Enviar link de redefinição'}
        </Button>
      </form>
    </AuthShell>
  );
}
