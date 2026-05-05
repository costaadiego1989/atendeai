import { describe, expect, it } from 'vitest';
import { HttpError } from '@/shared/api/client';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';

describe('getFriendlyErrorMessage — platform admin / API key', () => {
  it('mapeia HTTP 403 para orientação sobre VITE_PLATFORM_ADMIN_API_KEY', () => {
    const error = new HttpError({ status: 403, message: 'Forbidden' });
    expect(getFriendlyErrorMessage(error, { fallbackMessage: 'fallback' })).toContain(
      'VITE_PLATFORM_ADMIN_API_KEY',
    );
  });

  it('mapeia HTTP 401 para credencial de plataforma', () => {
    const error = new HttpError({ status: 401, message: 'Unauthorized' });
    expect(getFriendlyErrorMessage(error, { fallbackMessage: 'fallback' })).toContain(
      'Credencial',
    );
  });
});
