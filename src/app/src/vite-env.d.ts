/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_PLATFORM_ADMIN_API_KEY?: string;
  readonly VITE_SHOW_PLATFORM_ADMIN_NAV?: string;
  readonly VITE_FILTER_MODULES_BY_NICHE?: string;
  /** Percentual de desconto promocional (0-100). Ex: "50" = 50% off no primeiro ano */
  readonly VITE_PROMO_DISCOUNT_PERCENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
