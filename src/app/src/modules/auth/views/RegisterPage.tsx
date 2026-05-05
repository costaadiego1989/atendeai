import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/shared/stores/auth-store';
import { AuthShell } from '@/modules/auth/components/AuthShell';
import { useRegisterViewModel } from '@/modules/auth/view-models/useRegisterViewModel';
import { formatCnpj, formatCpf, formatPhone } from '@/shared/lib/masks';
import { businessTypeOptions } from '@/shared/constants/business-types';
import { PublicPlansTeaser } from '@/modules/billing/components/PublicPlansTeaser';

const registerSchema = z
  .object({
    companyName: z.string().min(2, 'Informe o nome da empresa'),
    businessType: z.string().min(1, 'Selecione o tipo de negócio'),
    cnpj: z
      .string()
      .regex(
        /^\d{14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
        'Informe um CNPJ válido',
      ),
    ownerName: z.string().min(2, 'Informe o nome do responsável'),
    ownerCpf: z
      .string()
      .regex(/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'Informe um CPF válido'),
    ownerEmail: z.string().email('Informe um e-mail válido'),
    ownerPhone: z.string().min(14, 'Informe um telefone válido'),
    ownerPassword: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme sua senha'),
  })
  .refine((values) => values.ownerPassword === values.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { isAuthenticated } = useAuthStore();
  const registerMutation = useRegisterViewModel();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: '',
      businessType: '',
      cnpj: '',
      ownerName: '',
      ownerCpf: '',
      ownerEmail: '',
      ownerPhone: '',
      ownerPassword: '',
      confirmPassword: '',
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <AuthShell
      title="Ative sua Máquina de Vendas"
      subtitle="Transforme seu WhatsApp com IA. Cadastre sua empresa e escale prospecção, captação de clientes e gestão de vendas hoje mesmo."
      footer={
        <div className="flex items-center justify-between gap-4">
          <span>Já possui acesso?</span>
          <Link className="font-medium text-primary hover:underline" to="/login">
            Entrar
          </Link>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit(({ confirmPassword: _confirmPassword, ...values }) =>
          registerMutation.mutate(values),
        )}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="companyName">Empresa</Label>
          <Input id="companyName" placeholder="Minha Empresa" {...register('companyName')} />
          {errors.companyName && (
            <p className="text-xs text-destructive">{errors.companyName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessType">Tipo de negócio</Label>
          <input type="hidden" {...register('businessType')} />
          <Select
            value={watch('businessType')}
            onValueChange={(value) =>
              setValue('businessType', value, { shouldDirty: true, shouldValidate: true })
            }
          >
            <SelectTrigger id="businessType">
              <SelectValue placeholder="Selecione o tipo principal da empresa" />
            </SelectTrigger>
            <SelectContent>
              {businessTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!errors.businessType && watch('businessType') && (
            <p className="text-xs text-muted-foreground">
              {
                businessTypeOptions.find((option) => option.value === watch('businessType'))
                  ?.description
              }
            </p>
          )}
          {errors.businessType && (
            <p className="text-xs text-destructive">{errors.businessType.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ownerName">Responsável</Label>
            <Input id="ownerName" placeholder="Seu nome" {...register('ownerName')} />
            {errors.ownerName && (
              <p className="text-xs text-destructive">{errors.ownerName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              {...register('cnpj', {
                onChange: (event) => {
                  event.target.value = formatCnpj(event.target.value);
                },
              })}
            />
            {!errors.cnpj && (
              <p className="text-xs text-muted-foreground">
                Informe o CNPJ da empresa.
              </p>
            )}
            {errors.cnpj && (
              <p className="text-xs text-destructive">{errors.cnpj.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerCpf">CPF do responsável</Label>
          <Input
            id="ownerCpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            {...register('ownerCpf', {
              onChange: (event) => {
                event.target.value = formatCpf(event.target.value);
              },
            })}
          />
          {errors.ownerCpf && (
            <p className="text-xs text-destructive">{errors.ownerCpf.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ownerEmail">Email</Label>
            <Input
              id="ownerEmail"
              type="email"
              placeholder="voce@empresa.com"
              {...register('ownerEmail')}
            />
            {errors.ownerEmail && (
              <p className="text-xs text-destructive">{errors.ownerEmail.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerPhone">Telefone</Label>
            <Input
              id="ownerPhone"
              inputMode="tel"
              placeholder="(11) 99999-9999"
              {...register('ownerPhone', {
                onChange: (event) => {
                  event.target.value = formatPhone(event.target.value);
                },
              })}
            />
            {errors.ownerPhone && (
              <p className="text-xs text-destructive">{errors.ownerPhone.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ownerPassword">Senha</Label>
            <div className="relative">
              <Input
                id="ownerPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Crie uma senha"
                autoComplete="new-password"
                {...register('ownerPassword')}
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
            {errors.ownerPassword && (
              <p className="text-xs text-destructive">{errors.ownerPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repita sua senha"
                autoComplete="new-password"
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
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? 'Criando conta...' : 'Criar Conta e Acessar'}
        </Button>

        <PublicPlansTeaser />
      </form>
    </AuthShell>
  );
}
