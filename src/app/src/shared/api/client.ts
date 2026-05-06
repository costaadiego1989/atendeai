function resolveApiOrigin() {
  const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined);
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined);

  let rawOrigin = apiOrigin || apiUrl;

  if (rawOrigin) {
    return rawOrigin.replace(/\/$/, '').replace(/\/api\/v1$/, '');
  }

  if (typeof window === 'undefined') {
    return '';
  }

  const { protocol, hostname } = window.location;
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

  if (localHosts.has(hostname)) {
    const formattedHostname = hostname.includes(':') ? `[${hostname}]` : hostname;
    return `${protocol}//${formattedHostname}:3000`;
  }

  return '';
}

const API_ORIGIN = resolveApiOrigin();
const BASE_URL = `${API_ORIGIN ?? ''}/api/v1`;

interface ApiErrorPayload {
  success?: boolean;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
  data?: unknown;
}

interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.status = error.status;
    this.details = error.details;
    this.name = 'HttpError';
  }
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }

  return response.json().catch(() => undefined);
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function shouldAttemptRefresh(path: string): boolean {
  return ![
    '/auth/login',
    '/auth/refresh',
    '/auth/logout',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/tenants',
  ].includes(path);
}

function shouldRedirectToLoginOnUnauthorized(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname.startsWith('/app');
}

async function request<T>(
  path: string,
  init: RequestInit,
  allowRefresh = true,
  unwrapData = true,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (
    response.status === 401 &&
    allowRefresh &&
    shouldAttemptRefresh(path) &&
    (await tryRefreshSession())
  ) {
    return request<T>(path, init, false, unwrapData);
  }

  const body = (await parseBody(response)) as ApiErrorPayload | undefined;

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.message ??
      `Erro inesperado (${response.status})`;

    if (
      response.status === 401 &&
      shouldAttemptRefresh(path) &&
      shouldRedirectToLoginOnUnauthorized()
    ) {
      window.location.href = '/login?reason=session-expired';
    }

    throw new HttpError({
      status: response.status,
      message,
      details: body,
    });
  }

  if (!body) {
    return {} as T;
  }

  if (unwrapData && typeof body === 'object' && body !== null && 'data' in body) {
    return (body as { data: T }).data;
  }

  return body as T;
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | undefined>,
): string {
  const url = `${path}`;
  if (!params) {
    return url;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}

export const apiClient = {
  get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
    options?: { unwrapData?: boolean }
  ): Promise<T> {
    return request<T>(buildUrl(path, params), {
      method: 'GET',
    }, true, options?.unwrapData ?? true);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, {
      method: 'DELETE',
    });
  },
};

const PLATFORM_ADMIN_KEY_HEADER = 'x-platform-admin-key';

function readPlatformAdminKey(): string {
  const key = (import.meta.env.VITE_PLATFORM_ADMIN_API_KEY as string | undefined)?.trim();
  if (!key) {
    throw new HttpError({
      status: 0,
      message:
        'Chave de administrador da plataforma não configurada. Defina VITE_PLATFORM_ADMIN_API_KEY no ambiente do Vite.',
    });
  }
  return key;
}

async function platformAdminRequest<T>(
  path: string,
  init: RequestInit,
  unwrapData = true,
): Promise<T> {
  const key = readPlatformAdminKey();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'omit',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      [PLATFORM_ADMIN_KEY_HEADER]: key,
      ...(init.headers ?? {}),
    },
  });

  const body = (await parseBody(response)) as ApiErrorPayload | undefined;

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.message ??
      `Erro inesperado (${response.status})`;
    throw new HttpError({
      status: response.status,
      message,
      details: body,
    });
  }

  if (!body) {
    return {} as T;
  }

  if (unwrapData && typeof body === 'object' && body !== null && 'data' in body) {
    return (body as { data: T }).data;
  }

  return body as T;
}

export const platformAdminClient = {
  get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
    options?: { unwrapData?: boolean },
  ): Promise<T> {
    return platformAdminRequest<T>(
      buildUrl(path, params),
      { method: 'GET' },
      options?.unwrapData ?? true,
    );
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return platformAdminRequest<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return platformAdminRequest<T>(path, {
      method: 'POST',
      body:
        body instanceof FormData
          ? body
          : body !== undefined
            ? JSON.stringify(body)
            : undefined,
    });
  },
};

export { HttpError };
export { API_ORIGIN, BASE_URL };
export type { ApiError };
