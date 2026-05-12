import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformAdminService } from '../services/platform-admin.service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';

export const platformTenantsQueryKeyRoot = ['platform-admin', 'tenants'] as const;

export function usePlatformTenantsPageViewModel() {
  const [page, setPage] = useState(1);
  const [listSearch, setListSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const limit = 20;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(listSearch.trim()), 350);
    return () => window.clearTimeout(t);
  }, [listSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const tenantsQuery = useQuery({
    queryKey: [...platformTenantsQueryKeyRoot, page, limit, debouncedSearch],
    queryFn: () =>
      platformAdminService.listTenants({
        page,
        limit,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    enabled:
      !!(import.meta.env.VITE_PLATFORM_ADMIN_API_KEY as string | undefined)?.trim(),
  });

  const configErrorMessage = useMemo(() => {
    if ((import.meta.env.VITE_PLATFORM_ADMIN_API_KEY as string | undefined)?.trim()) {
      return null;
    }
    return 'Defina VITE_PLATFORM_ADMIN_API_KEY no .env.local do app e reinicie o Vite.';
  }, []);

  const listErrorMessage = useMemo(() => {
    const err = tenantsQuery.error;
    if (!err) {
      return null;
    }
    return getFriendlyErrorMessage(err, {
      fallbackMessage: 'Não foi possível carregar a lista de tenants.',
      context: 'platform-admin',
    });
  }, [tenantsQuery.error]);

  return {
    page,
    limit,
    setPage,
    listSearch,
    setListSearch,
    tenantsQuery,
    configErrorMessage,
    listErrorMessage,
  };
}
