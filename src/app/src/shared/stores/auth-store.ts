import { create } from 'zustand';
import type { User, Tenant } from '@/shared/types';

const HEADQUARTERS_SCOPE_STORAGE_VALUE = '__headquarters__';

function getStoredActiveBranchId(tenantId?: string | null): string | null {
  if (!tenantId || typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(`active-branch:${tenantId}`);
}

function resolveActiveBranchId(
  tenant: Tenant,
  user?: User | null,
  preferredBranchId?: string | null,
): string | null {
  if (preferredBranchId === HEADQUARTERS_SCOPE_STORAGE_VALUE) {
    return null;
  }

  const allowedBranchIds = new Set(user?.accessibleBranchIds ?? []);
  const activeBranches = (tenant.branches ?? []).filter(
    (branch) =>
      branch.active && (allowedBranchIds.size === 0 || allowedBranchIds.has(branch.id)),
  );
  if (!activeBranches.length || !preferredBranchId) {
    return null;
  }

  if (preferredBranchId && activeBranches.some((branch) => branch.id === preferredBranchId)) {
    return preferredBranchId;
  }

  return null;
}

function persistActiveBranchId(tenantId: string, branchId: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    `active-branch:${tenantId}`,
    branchId ?? HEADQUARTERS_SCOPE_STORAGE_VALUE,
  );
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  activeBranchId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (user: User, tenant: Tenant) => void;
  updateUser: (user: Partial<User>) => void;
  updateTenant: (tenant: Partial<Tenant>) => void;
  setActiveBranchId: (branchId: string | null) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  activeBranchId: null,
  isAuthenticated: false,
  isLoading: true,
  setSession: (user, tenant) =>
    set(() => {
      const storedActiveBranchId = getStoredActiveBranchId(tenant.id);
      const activeBranchId = resolveActiveBranchId(tenant, user, storedActiveBranchId);

      persistActiveBranchId(tenant.id, activeBranchId);

      return {
        user,
        tenant,
        activeBranchId,
        isAuthenticated: true,
        isLoading: false,
      };
    }),
  updateUser: (user) =>
    set((state) => {
      const nextUser = state.user ? { ...state.user, ...user } : state.user;
      const storedActiveBranchId = state.tenant
        ? getStoredActiveBranchId(state.tenant.id)
        : null;
      const activeBranchId = state.tenant
        ? resolveActiveBranchId(
            state.tenant,
            nextUser,
            storedActiveBranchId ?? state.activeBranchId,
          )
        : state.activeBranchId;

      return {
        user: nextUser,
        activeBranchId,
      };
    }),
  updateTenant: (tenant) =>
    set((state) => {
      const nextTenant = state.tenant ? { ...state.tenant, ...tenant } : state.tenant;

      if (!nextTenant) {
        return { tenant: nextTenant };
      }

      const storedActiveBranchId = getStoredActiveBranchId(nextTenant.id);
      const activeBranchId = resolveActiveBranchId(
        nextTenant,
        state.user,
        storedActiveBranchId ?? state.activeBranchId,
      );
      persistActiveBranchId(nextTenant.id, activeBranchId);

      return {
        tenant: nextTenant,
        activeBranchId,
      };
    }),
  setActiveBranchId: (branchId) =>
    set((state) => {
      if (!state.tenant) {
        return { activeBranchId: null };
      }

      if (branchId === null) {
        persistActiveBranchId(state.tenant.id, null);
        return { activeBranchId: null };
      }

      const activeBranchId = resolveActiveBranchId(state.tenant, state.user, branchId);
      persistActiveBranchId(state.tenant.id, activeBranchId);

      return { activeBranchId };
    }),
  clearSession: () =>
    set({
      user: null,
      tenant: null,
      activeBranchId: null,
      isAuthenticated: false,
      isLoading: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
}));
