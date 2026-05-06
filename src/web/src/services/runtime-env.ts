function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function stripApiSuffix(value: string): string {
  return value.replace(/\/api\/v1$/, '');
}

function resolveLocalHostBase(port: number): string {
  if (typeof window === 'undefined') {
    return `http://localhost:${port}`;
  }

  const hostname = window.location.hostname.includes(':')
    ? `[${window.location.hostname}]`
    : window.location.hostname;

  return `${window.location.protocol}//${hostname}:${port}`;
}

export function resolvePublicApiBaseUrl(): string {
  const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  const rawOrigin = apiOrigin || apiUrl;

  if (rawOrigin) {
    return stripApiSuffix(stripTrailingSlash(rawOrigin));
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  if (localHosts.has(window.location.hostname)) {
    return resolveLocalHostBase(3000);
  }

  return window.location.origin;
}

export function resolveAppBaseUrl(): string {
  const appUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();

  if (appUrl) {
    return stripTrailingSlash(appUrl);
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

  if (typeof window === 'undefined') {
    return 'http://localhost:8080';
  }

  if (localHosts.has(window.location.hostname)) {
    return resolveLocalHostBase(8080);
  }

  return window.location.origin;
}
