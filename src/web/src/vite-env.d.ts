/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_PROMO_DISCOUNT_MONTHLY?: string;
  readonly VITE_PROMO_DISCOUNT_ANNUAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
