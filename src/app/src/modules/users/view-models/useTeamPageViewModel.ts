import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import { usersService } from '@/modules/users/services/users-service';
import type { User } from '@/shared/types';

const GUARD_SELF_DELETE = 'GUARD:self-delete';
const GUARD_LAST_OWNER_DELETE = 'GUARD:last-owner-delete';
const GUARD_LAST_OWNER_DEMOTE = 'GUARD:last-owner-demote';

function notifyTeamGuardError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const descriptions: Record<string, string> = {
    [GUARD_SELF_DELETE]: 'Você não pode remover a própria conta por esta tela.',
    [GUARD_LAST_OWNER_DELETE]: 'O tenant precisa de pelo menos um proprietário.',
    [GUARD_LAST_OWNER_DEMOTE]: 'Não é possível rebaixar o único proprietário.',
  };

  const description = descriptions[error.message];
  if (!description) {
    return false;
  }

  toast({
    title: 'Ação bloqueada',
    description,
    variant: 'destructive',
  });
  return true;
}

function teamUsersQueryKey(tenantId: string | undefined) {
  return ['team-users', tenantId] as const;
}

export function useTeamPageViewModel() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const { tenant, user } = useAuthStore();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: teamUsersQueryKey(tenant?.id),
    queryFn: () => usersService.listUsers(tenant!.id),
    enabled: !!tenant?.id,
  });

  const createUserMutation = useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      phone: string;
      role: 'ADMIN' | 'AGENT';
    }) => usersService.createUser(tenant!.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamUsersQueryKey(tenant?.id) });
      setCreateOpen(false);
      toast({
        title: 'Membro adicionado',
        description:
          'O usuario foi criado com senha provisoria e recebeu o acesso por email.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao adicionar membro',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel adicionar este membro agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (input: {
      userId: string;
      name: string;
      email: string;
      phone: string;
      role: 'OWNER' | 'ADMIN' | 'AGENT';
    }) => {
      const users =
        queryClient.getQueryData<User[]>(teamUsersQueryKey(tenant?.id)) ?? usersQuery.data ?? [];
      const target = users.find((u) => u.id === input.userId);
      const ownerCount = users.filter((u) => u.role === 'OWNER').length;

      if (
        target?.role === 'OWNER'
        && input.role !== 'OWNER'
        && ownerCount <= 1
      ) {
        throw new Error(GUARD_LAST_OWNER_DEMOTE);
      }

      return usersService.updateUser(tenant!.id, input.userId, {
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamUsersQueryKey(tenant?.id) });
      setEditingUser(null);
      toast({
        title: 'Membro atualizado',
        description: 'Os dados do membro foram atualizados com sucesso.',
      });
    },
    onError: (error) => {
      if (notifyTeamGuardError(error)) {
        return;
      }
      toast({
        title: 'Falha ao atualizar membro',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel atualizar este membro agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => {
      const users =
        queryClient.getQueryData<User[]>(teamUsersQueryKey(tenant?.id)) ?? usersQuery.data ?? [];
      const target = users.find((u) => u.id === userId);
      const ownerCount = users.filter((u) => u.role === 'OWNER').length;

      if (user?.id && target?.id === user.id) {
        throw new Error(GUARD_SELF_DELETE);
      }

      if (target?.role === 'OWNER' && ownerCount <= 1) {
        throw new Error(GUARD_LAST_OWNER_DELETE);
      }

      return usersService.deleteUser(tenant!.id, userId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamUsersQueryKey(tenant?.id) });
      setDeleteTarget(null);
      toast({
        title: 'Membro removido',
        description: 'O membro foi removido da equipe com sucesso.',
      });
    },
    onError: (error) => {
      if (notifyTeamGuardError(error)) {
        return;
      }
      toast({
        title: 'Falha ao remover membro',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel remover este membro agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'ADMIN' | 'AGENT'>('ALL');

  const visibleUsers = useMemo(() => {
    const allUsers = usersQuery.data ?? [];
    return allUsers.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [usersQuery.data, search, roleFilter]);

  const stats = useMemo(() => {
    const allUsers = usersQuery.data ?? [];
    return {
      total: allUsers.length,
      admins: allUsers.filter((u) => u.role === 'ADMIN').length,
      agents: allUsers.filter((u) => u.role === 'AGENT').length,
      active: allUsers.filter((u) => !u.mustChangePassword).length,
    };
  }, [usersQuery.data]);

  const ownerCount = useMemo(
    () => (usersQuery.data ?? []).filter((u) => u.role === 'OWNER').length,
    [usersQuery.data],
  );

  function canEditTeamMember(member: User): boolean {
    if (member.role === 'OWNER' && ownerCount <= 1) {
      return false;
    }
    return true;
  }

  function canDeleteTeamMember(member: User): boolean {
    if (!user?.id) {
      return false;
    }
    if (member.id === user.id) {
      return false;
    }
    if (member.role === 'OWNER' && ownerCount <= 1) {
      return false;
    }
    return true;
  }

  return {
    tenant,
    createOpen,
    setCreateOpen,
    editingUser,
    setEditingUser,
    deleteTarget,
    setDeleteTarget,
    users: visibleUsers,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    stats,
    canEditTeamMember,
    canDeleteTeamMember,
    usersQuery,
    createUserMutation,
    updateUserMutation,
    deleteUserMutation,
  };
}
