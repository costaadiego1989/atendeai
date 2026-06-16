const FACEBOOK_SDK_ID = 'facebook-jssdk';
const FACEBOOK_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const EMBEDDED_SIGNUP_TIMEOUT_MS = 5 * 60 * 1000;

interface FacebookLoginResponse {
  status?: string;
  authResponse?: { code?: string } | null;
}

interface FacebookSdk {
  init: (options: {
    appId: string;
    autoLogAppEvents: boolean;
    xfbml: boolean;
    version: string;
  }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: {
      config_id: string;
      response_type: string;
      override_default_response_type: boolean;
      extras: { featureType: string; sessionInfoVersion: number };
    },
  ) => void;
}

interface MetaSignupMessagePayload {
  type?: string;
  event?: string;
  data?: {
    event?: string;
    phone_number_id?: string;
    waba_id?: string;
    error_message?: string;
    message?: string;
  };
  error_message?: string;
  message?: string;
}

export interface StartMetaWhatsAppEmbeddedSignupInput {
  appId: string;
  configurationId: string;
}

export interface MetaWhatsAppEmbeddedSignupResult {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let facebookSdkPromise: Promise<FacebookSdk> | null = null;

export async function startMetaWhatsAppEmbeddedSignup(
  input: StartMetaWhatsAppEmbeddedSignupInput,
): Promise<MetaWhatsAppEmbeddedSignupResult> {
  const facebookSdk = await ensureFacebookSdk(input.appId);

  return new Promise((resolve, reject) => {
    let code: string | null = null;
    let wabaId: string | null = null;
    let phoneNumberId: string | null = null;

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(
        new Error('O fluxo da Meta expirou. Tente conectar o WhatsApp novamente.'),
      );
    }, EMBEDDED_SIGNUP_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
    };

    const rejectWithMessage = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    const tryResolve = () => {
      if (code && wabaId && phoneNumberId) {
        cleanup();
        resolve({ code, wabaId, phoneNumberId });
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (!isFacebookOrigin(event.origin)) {
        return;
      }

      const payload = parsePayload(event.data);
      if (!payload) {
        return;
      }

      const embeddedEvent =
        payload.event || payload.data?.event || payload.type;
      if (!embeddedEvent) {
        return;
      }

      if (embeddedEvent === 'FINISH' || embeddedEvent === 'WA_EMBEDDED_SIGNUP') {
        wabaId = payload.data?.waba_id ?? null;
        phoneNumberId = payload.data?.phone_number_id ?? null;
        tryResolve();
        return;
      }

      if (embeddedEvent === 'CANCEL') {
        rejectWithMessage(
          'A conexão com o WhatsApp foi cancelada antes de concluir.',
        );
        return;
      }

      if (embeddedEvent === 'ERROR') {
        rejectWithMessage(
          payload.data?.error_message ||
            payload.data?.message ||
            payload.error_message ||
            payload.message ||
            'A Meta retornou um erro ao iniciar a conexão do WhatsApp.',
        );
      }
    };

    window.addEventListener('message', handleMessage);

    facebookSdk.login(
      (response) => {
        if (response?.authResponse?.code) {
          code = response.authResponse.code;
          tryResolve();
          return;
        }

        if (response?.status === 'connected' || response?.authResponse) {
          return;
        }

        window.setTimeout(() => {
          cleanup();
          reject(
            new Error(
              'O popup da Meta foi fechado antes de concluir a conexão do WhatsApp.',
            ),
          );
        }, 500);
      },
      {
        config_id: input.configurationId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: 3,
        },
      },
    );
  });
}

async function ensureFacebookSdk(appId: string): Promise<FacebookSdk> {
  if (window.FB) {
    initializeFacebookSdk(window.FB, appId);
    return window.FB;
  }

  if (!facebookSdkPromise) {
    facebookSdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
      const existingScript = document.getElementById(
        FACEBOOK_SDK_ID,
      ) as HTMLScriptElement | null;

      const finishInit = () => {
        if (!window.FB) {
          reject(new Error('Não foi possível carregar o SDK da Meta.'));
          return;
        }
        initializeFacebookSdk(window.FB, appId);
        resolve(window.FB);
      };

      window.fbAsyncInit = finishInit;

      if (existingScript) {
        return;
      }

      const script = document.createElement('script');
      script.id = FACEBOOK_SDK_ID;
      script.async = true;
      script.defer = true;
      script.src = FACEBOOK_SDK_SRC;
      script.onerror = () => {
        facebookSdkPromise = null;
        reject(
          new Error(
            'Não foi possível carregar o SDK da Meta para conectar o WhatsApp.',
          ),
        );
      };
      document.body.appendChild(script);
    });
  }

  return facebookSdkPromise;
}

function initializeFacebookSdk(facebookSdk: FacebookSdk, appId: string) {
  facebookSdk.init({
    appId,
    autoLogAppEvents: true,
    xfbml: false,
    version: 'v23.0',
  });
}

function isFacebookOrigin(origin: string): boolean {
  return /(^https:\/\/)(.*\.)?(facebook\.com|fbcdn\.net)$/.test(origin);
}

function parsePayload(input: unknown): MetaSignupMessagePayload | null {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input) as MetaSignupMessagePayload;
    } catch {
      return null;
    }
  }
  if (typeof input === 'object' && input !== null) {
    return input as MetaSignupMessagePayload;
  }
  return null;
}
