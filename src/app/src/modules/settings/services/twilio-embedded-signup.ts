const FACEBOOK_SDK_ID = 'facebook-jssdk';
const FACEBOOK_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const EMBEDDED_SIGNUP_TIMEOUT_MS = 5 * 60 * 1000;

interface FacebookLoginResponse {
  status?: string;
  authResponse?: unknown;
}

interface FacebookLoginOptions {
  config_id: string;
  response_type: string;
  override_default_response_type: boolean;
  extras: {
    setup: {
      solutionID: string;
    };
    featureType: 'only_waba_sharing';
    sessionInfoVersion: number;
  };
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
    options: FacebookLoginOptions,
  ) => void;
}

interface EmbeddedSignupMessagePayload {
  type?: string;
  event?: string;
  error_message?: string;
  message?: string;
  data?: {
    event?: string;
    waba_id?: string;
    error_message?: string;
    message?: string;
    waba?: {
      id?: string;
    };
  };
}

interface StartTwilioEmbeddedSignupInput {
  appId: string;
  configurationId: string;
  solutionId: string;
}

interface EmbeddedSignupResult {
  wabaId: string;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let facebookSdkPromise: Promise<FacebookSdk> | null = null;

export async function startTwilioEmbeddedSignup(
  input: StartTwilioEmbeddedSignupInput,
): Promise<EmbeddedSignupResult> {
  const facebookSdk = await ensureFacebookSdk(input.appId);

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          'O fluxo do Facebook expirou. Tente conectar o WhatsApp novamente.',
        ),
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

    const handleMessage = (event: MessageEvent) => {
      if (!isFacebookOrigin(event.origin)) {
        return;
      }

      const payload = parseEmbeddedSignupPayload(event.data);
      if (!payload) {
        return;
      }

      const embeddedEvent = payload.event || payload.data?.event || payload.type;
      if (!embeddedEvent) {
        return;
      }

      if (embeddedEvent === 'FINISH' || embeddedEvent === 'FINISH_ONLY_WABA') {
        const wabaId = extractWabaId(payload);
        if (!wabaId) {
          rejectWithMessage(
            'não conseguimos identificar a conta do WhatsApp retornada pelo Facebook. Tente novamente.',
          );
          return;
        }

        cleanup();
        resolve({ wabaId });
        return;
      }

      if (embeddedEvent === 'CANCEL') {
        rejectWithMessage(
          'A conexão com o WhatsApp foi cancelada antes da conclusao.',
        );
        return;
      }

      if (embeddedEvent === 'ERROR') {
        rejectWithMessage(
          payload.error_message ||
          payload.data?.error_message ||
          payload.message ||
          payload.data?.message ||
          'O Facebook retornou um erro ao iniciar a conexão do WhatsApp.',
        );
      }
    };

    window.addEventListener('message', handleMessage);

    facebookSdk.login(
      (response) => {
        if (response?.status === 'connected' || response?.authResponse) {
          return;
        }

        window.setTimeout(() => {
          cleanup();
          reject(
            new Error(
              'O popup do Facebook foi fechado antes de concluir a conexão do WhatsApp.',
            ),
          );
        }, 500);
      },
      {
        config_id: input.configurationId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {
            solutionID: input.solutionId,
          },
          featureType: 'only_waba_sharing',
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
          reject(new Error('não foi possivel carregar o SDK do Facebook.'));
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
            'não foi possivel carregar o SDK do Facebook para conectar o WhatsApp.',
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

function parseEmbeddedSignupPayload(
  input: unknown,
): EmbeddedSignupMessagePayload | null {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input) as EmbeddedSignupMessagePayload;
    } catch {
      return null;
    }
  }

  if (typeof input === 'object' && input !== null) {
    return input as EmbeddedSignupMessagePayload;
  }

  return null;
}

function extractWabaId(payload: EmbeddedSignupMessagePayload): string | null {
  return payload.data?.waba_id || payload.data?.waba?.id || null;
}
