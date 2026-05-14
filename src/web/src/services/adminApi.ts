const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getApiKey(): string | null {
  return localStorage.getItem('platform_admin_key');
}

export function setApiKey(key: string): void {
  localStorage.setItem('platform_admin_key', key);
}

export function clearApiKey(): void {
  localStorage.removeItem('platform_admin_key');
}

export function isAuthenticated(): boolean {
  return !!getApiKey();
}

export async function adminFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const key = getApiKey();
  if (!key) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-platform-admin-key': key,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    clearApiKey();
    window.location.href = '/admin';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${response.status}`);
  }

  return response.json();
}
