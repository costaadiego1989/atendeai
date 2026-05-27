import { InventoryProviderTimeoutError } from '../../domain/errors/InventoryProviderTimeoutError';

export const PROVIDER_REQUEST_TIMEOUT_MS = 30000;

export async function providerFetch(
  provider: string,
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new InventoryProviderTimeoutError(provider);
    }
    throw error;
  }
}
