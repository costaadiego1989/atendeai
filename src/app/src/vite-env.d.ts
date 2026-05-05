/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM_ADMIN_API_KEY?: string;
  readonly VITE_SHOW_PLATFORM_ADMIN_NAV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
