/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_PLATFORM_ADMIN_API_KEY?: string;
  readonly VITE_SHOW_PLATFORM_ADMIN_NAV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
