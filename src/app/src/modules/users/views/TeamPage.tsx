import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PageSkeleton } from '@/shared/ui/Skeletons';
import { Pencil, Trash2, Users } from 'lucide-react';
import { useTeamPageViewModel } from '@/modules/users/view-models/useTeamPageViewModel';
import { useAuthStore } from '@/shared/stores/auth-store';
import { formatPhone } from '@/shared/lib/masks';
import { TeamHeader } from '../components/TeamHeader';
import { TeamKPIs } from '../components/TeamKPIs';
import { TeamFilters } from '../components/TeamFilters';

const roleLabels: Record<'OWNER' | 'ADMIN' | 'AGENT', string> = {
  OWNER: 'Proprietario',
  ADMIN: 'Administrador',
  AGENT: 'Agente',
};

const createTeamMemberSchema = z.object({
  name: z.string().min(3, 'Informe o nome completo'),
  email: z.string().email('Informe um email valido'),
  phone: z.string().min(10, 'Informe um telefone valido'),
  role: z.enum(['ADMIN', 'AGENT']),
});

const editTeamMemberSchema = z.object({
  name: z.string().min(3, 'Informe o nome completo'),
  email: z.string().email('Informe um email valido'),
  phone: z.string().min(10, 'Informe um telefone valido'),
  role: z.enum(['OWNER', 'ADMIN', 'AGENT']),
});

type CreateTeamMemberForm = z.infer<typeof createTeamMemberSchema>;
type EditTeamMemberForm = z.infer<typeof editTeamMemberSchema>;

export default function TeamPage() {
  const vm = useTeamPageViewModel();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      navigate('/app', { replace: true });
    }
  }, [user, navigate]);

  const createForm = useForm<CreateTeamMemberForm>({
    resolver: zodResolver(createTeamMemberSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'AGENT',
    },
  });
  const editForm = useForm<EditTeamMemberForm>({
    resolver: zodResolver(editTeamMemberSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'AGENT',
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = createForm;

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    setValue: setEditValue,
    watch: watchEdit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = editForm;

  useEffect(() => {
    if (!vm.editingUser) {
      resetEdit({
        name: '',
        email: '',
        phone: '',
        role: 'AGENT',
      });
      return;
    }

    resetEdit({
      name: vm.editingUser.name,
      email: vm.editingUser.email,
      phone: formatPhone(vm.editingUser.phone ?? ''),
      role: vm.editingUser.role,
    });
  }, [resetEdit, vm.editingUser]);

  if (vm.usersQuery.isLoading && !vm.usersQuery.data) {
    return <PageSkeleton />;
  }

  if (vm.usersQuery.isError) {
    return (
      <div className="page-container animate-fade-in">
        <EmptyState
          icon={Users}
          title="não foi possivel carregar a equipe"
          description="Tente novamente em instantes para listar os membros do tenant."
        />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <TeamHeader onNewMember={() => vm.setCreateOpen(true)} />

      <TeamKPIs
        total={vm.stats.total}
        admins={vm.stats.admins}
        agents={vm.stats.agents}
        active={vm.stats.active}
      />

      <div className="space-y-4">
        <TeamFilters
          search={vm.search}
          onSearchChange={vm.setSearch}
          roleFilter={vm.roleFilter}
          onRoleFilterChange={(value) => vm.setRoleFilter(value as any)}
          totalCount={vm.users.length}
        />

        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Membro
                  </th>
                  <th className="px-4 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Email de acesso
                  </th>
                  <th className="px-4 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Permissões
                  </th>
                  <th className="px-4 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Status
                  </th>
                  <th className="px-4 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Último login
                  </th>
                  <th className="px-4 py-4 text-right text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Gerenciar
                  </th>
                </tr>
              </thead>
              <tbody>
                {vm.users.map((teamUser) => (
                  <tr
                    key={teamUser.id}
                    className="border-b border-border/40 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-4 text-sm font-semibold text-foreground">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {teamUser.name.charAt(0).toUpperCase()}
                        </div>
                        {teamUser.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <p>{teamUser.email}</p>
                        <p className="text-xs">{formatPhone(teamUser.phone)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-widest bg-secondary/50">
                        {roleLabels[teamUser.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={teamUser.mustChangePassword ? 'outline' : 'secondary'}
                        className="text-[10px] font-bold uppercase tracking-widest"
                      >
                        {teamUser.mustChangePassword ? 'Pendente' : 'Confirmado'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {teamUser.lastLoginAt
                        ? new Date(teamUser.lastLoginAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {vm.canEditTeamMember(teamUser) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => vm.setEditingUser(teamUser)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {vm.canDeleteTeamMember(teamUser) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => vm.setDeleteTarget(teamUser)}
                            disabled={vm.deleteUserMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {vm.users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                      Nenhum membro encontrado com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Sheet
        open={vm.createOpen}
        onOpenChange={(open) => {
          vm.setCreateOpen(open);
          if (!open) {
            reset();
          }
        }}
      >
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Adicionar membro</SheetTitle>
          </SheetHeader>
          <form
            className="space-y-4 mt-6"
            onSubmit={handleSubmit((values) => vm.createUserMutation.mutate({
              name: values.name!,
              email: values.email!,
              phone: values.phone!.replace(/\D/g, ''),
              role: values.role! as 'ADMIN' | 'AGENT',
            }))}
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="Nome completo" {...register('name')} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="email@empresa.com" {...register('email')} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={watch('phone')}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  setValue('phone', formatted, { shouldValidate: true });
                }}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={watch('role')}
                onValueChange={(value: 'ADMIN' | 'AGENT') =>
                  setValue('role', value, { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="AGENT">Agente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
              <p className="text-sm font-medium text-foreground">Fluxo de acesso</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O sistema vai gerar uma senha provisoria automaticamente, enviar por email e obrigar a troca no primeiro login.
              </p>
            </div>
            <Button className="w-full" type="submit" disabled={vm.createUserMutation.isPending}>
              {vm.createUserMutation.isPending ? 'Enviando convite...' : 'Adicionar membro'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(vm.editingUser)}
        onOpenChange={(open) => {
          if (!open) {
            vm.setEditingUser(null);
          }
        }}
      >
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar membro</SheetTitle>
          </SheetHeader>
          <form
            className="space-y-4 mt-6"
            onSubmit={handleEditSubmit((values) => {
              if (!vm.editingUser) {
                return;
              }

              vm.updateUserMutation.mutate({
                userId: vm.editingUser.id,
                name: values.name!,
                email: values.email!,
                phone: values.phone!.replace(/\D/g, ''),
                role: values.role! as 'OWNER' | 'ADMIN' | 'AGENT',
              });
            })}
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="Nome completo" {...registerEdit('name')} />
              {editErrors.name && (
                <p className="text-xs text-destructive">{editErrors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@empresa.com"
                {...registerEdit('email')}
              />
              {editErrors.email && (
                <p className="text-xs text-destructive">{editErrors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={watchEdit('phone')}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  setEditValue('phone', formatted, { shouldValidate: true });
                }}
              />
              {editErrors.phone && (
                <p className="text-xs text-destructive">{editErrors.phone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={watchEdit('role')}
                onValueChange={(value: 'OWNER' | 'ADMIN' | 'AGENT') =>
                  setEditValue('role', value, { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vm.editingUser?.role === 'OWNER' && (
                    <SelectItem value="OWNER">{roleLabels.OWNER}</SelectItem>
                  )}
                  <SelectItem value="ADMIN">{roleLabels.ADMIN}</SelectItem>
                  <SelectItem value="AGENT">{roleLabels.AGENT}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" type="submit" disabled={vm.updateUserMutation.isPending}>
              {vm.updateUserMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(vm.deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            vm.setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Atenção: Essa ação remove o acesso desse usuario ao tenant atual.
              {vm.deleteTarget?.role === 'OWNER' ? (
                <>
                  {' '}
                  Este membro é proprietário — só prossegua se existir outro proprietário na equipe.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] p-4">
            <p className="text-sm font-medium text-foreground">
              Deseja realmente remover {vm.deleteTarget?.name} da equipe?
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => vm.setDeleteTarget(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => vm.deleteTarget && vm.deleteUserMutation.mutate(vm.deleteTarget.id)}
              disabled={vm.deleteUserMutation.isPending}
            >
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
