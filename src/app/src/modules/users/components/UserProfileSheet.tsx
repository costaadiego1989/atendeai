import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/shared/stores/auth-store';
import { usersService } from '@/modules/users/services/users-service';
import { toast } from 'sonner';

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  oldPassword: z.string().optional().or(z.literal('')),
  password: z.string().optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine((data) => {
  if (data.password && data.password !== '' && (!data.oldPassword || data.oldPassword === '')) {
    return false;
  }
  return true;
}, {
  message: "A senha atual é obrigatória para definir uma nova senha",
  path: ["oldPassword"],
}).refine((data) => {
  if (data.password && data.password !== '' && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "A confirmação da nova senha não confere",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface UserProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileSheet({ open, onOpenChange }: UserProfileSheetProps) {
  const { user, tenant, updateUser } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      oldPassword: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (user) {
      let initPhone = user.phone || '';
      initPhone = initPhone.replace(/^\+55\s?/, '');
      
      const formatInitial = (v: string) => {
        const clean = v.replace(/\D/g, '');
        if (clean.length === 11) {
          return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
        } else if (clean.length === 10) {
          return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`;
        }
        return v;
      };

      form.reset({ 
        name: user.name, 
        email: user.email, 
        phone: formatInitial(initPhone), 
        oldPassword: '', 
        password: '', 
        confirmPassword: '' 
      });
    }
  }, [user, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user || !tenant) return;
    try {
      setIsSubmitting(true);
      
      const cleanPhone = data.phone ? data.phone.replace(/\D/g, '') : '';
      const payload: any = { name: data.name, email: data.email, phone: cleanPhone };
      if (data.password && data.password.trim() !== '') {
        payload.password = data.password;
        payload.oldPassword = data.oldPassword;
      }
      
      await usersService.updateUser(tenant.id, user.id, payload);
      
      updateUser({ name: data.name, email: data.email, phone: cleanPhone });
      toast.success('Perfil atualizado com sucesso');
      onOpenChange(false);
      form.reset({ name: data.name, email: data.email, phone: data.phone, oldPassword: '', password: '', confirmPassword: '' });
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Meu Perfil</SheetTitle>
          <SheetDescription>
            Visualize e atualize os seus dados.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              {...form.register('email')}
              placeholder="Seu email"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Seu nome"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Celular</Label>
            <Input
              id="phone"
              {...form.register('phone', {
                onChange: (e) => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (v.startsWith('55') && v.length > 11) {
                    v = v.substring(2);
                  }
                  if (v.length > 11) v = v.slice(0, 11);
                  
                  let formatted = v;
                  if (v.length > 2) {
                    formatted = `(${v.slice(0, 2)}) `;
                    if (v.length > 7) {
                      formatted += `${v.slice(2, 7)}-${v.slice(7)}`;
                    } else {
                      formatted += v.slice(2);
                    }
                  }
                  e.target.value = formatted;
                }
              })}
              placeholder="(11) 99999-9999"
              maxLength={15}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="oldPassword">Senha Atual</Label>
            <Input
              id="oldPassword"
              type="password"
              {...form.register('oldPassword')}
              placeholder="Sua senha atual"
            />
            {form.formState.errors.oldPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.oldPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Nova Senha</Label>
            <Input
              id="password"
              type="password"
              {...form.register('password')}
              placeholder="Deixe em branco para não alterar"
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...form.register('confirmPassword')}
              placeholder="Repita a nova senha para confirmar"
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
