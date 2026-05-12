import { describe, expect, it } from 'vitest';
import { HttpError } from '@/shared/api/client';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';

describe('getFriendlyErrorMessage — auth throttling (APP-AUTH-002)', () => {
  it('preserva mensagem backend em portugues para 429 de auth', () => {
    const backendMessage =
      'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
    const error = new HttpError({ status: 429, message: backendMessage });
    const result = getFriendlyErrorMessage(error, {
      fallbackMessage: 'fallback',
    });
    expect(result).toBe(backendMessage);
  });

  it('retorna mensagem generica para 429 sem texto em portugues', () => {
    const error = new HttpError({ status: 429, message: 'Too Many Requests' });
    const result = getFriendlyErrorMessage(error, {
      fallbackMessage: 'fallback',
    });
    expect(result).toBe(
      'Muitas solicitacoes em pouco tempo. Aguarde um instante e tente novamente.',
    );
  });

  it('retorna mensagem generica para 429 sem mensagem', () => {
    const error = new HttpError({ status: 429, message: '' });
    const result = getFriendlyErrorMessage(error, {
      fallbackMessage: 'fallback',
    });
    expect(result).toBe(
      'Muitas solicitacoes em pouco tempo. Aguarde um instante e tente novamente.',
    );
  });

  it('mapeia "rate limit" no corpo para mensagem amigavel', () => {
    const error = new HttpError({
      status: 400,
      message: 'rate limit exceeded for this endpoint',
    });
    const result = getFriendlyErrorMessage(error, {
      fallbackMessage: 'fallback',
    });
    expect(result).toBe(
      'Limite de requisicoes atingido. Tente novamente em alguns instantes.',
    );
  });

  it('401 com Invalid credentials retorna mensagem de login', () => {
    const error = new HttpError({ status: 401, message: 'Invalid credentials' });
    const result = getFriendlyErrorMessage(error, {
      fallbackMessage: 'fallback',
    });
    expect(result).toBe('Email ou senha invalidos.');
  });
});
