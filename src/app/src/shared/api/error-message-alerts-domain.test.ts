import { describe, expect, it } from 'vitest';
import { HttpError } from '@/shared/api/client';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';

describe('getFriendlyErrorMessage — alerts domain errors (APP-ALT-002)', () => {
  const opts = { fallbackMessage: 'fallback' };

  it('mapeia "Active reminder limit exceeded" para mensagem PT', () => {
    const error = new HttpError({
      status: 400,
      message: 'Active reminder limit exceeded (max 5 per user)',
    });
    expect(getFriendlyErrorMessage(error, opts)).toBe(
      'Limite de alertas ativos atingido. Desative ou exclua um alerta antes de criar outro.',
    );
  });

  it('mapeia "Reminder time must use HH:mm format" para mensagem PT', () => {
    const error = new HttpError({
      status: 400,
      message: 'Reminder time must use HH:mm format',
    });
    expect(getFriendlyErrorMessage(error, opts)).toBe(
      'O horario do lembrete deve estar no formato HH:mm (ex.: 08:30).',
    );
  });

  it('mapeia "Invalid IANA timezone" para mensagem PT', () => {
    const error = new HttpError({
      status: 400,
      message: 'Invalid IANA timezone: unable to parse',
    });
    expect(getFriendlyErrorMessage(error, opts)).toBe(
      'Fuso horario invalido. Verifique as configuracoes do dispositivo.',
    );
  });

  it('mapeia "Scheduled date is required" para mensagem PT', () => {
    const error = new HttpError({
      status: 400,
      message: 'Scheduled date is required for one-time reminders',
    });
    expect(getFriendlyErrorMessage(error, opts)).toBe(
      'A data de agendamento e obrigatoria para lembretes unicos.',
    );
  });

  it('mapeia "Scheduled date is invalid" para mensagem PT', () => {
    const error = new HttpError({
      status: 400,
      message: 'Scheduled date is invalid',
    });
    expect(getFriendlyErrorMessage(error, opts)).toBe(
      'A data de agendamento e invalida.',
    );
  });

  it('mapeia "Scheduled date must be in the future" para mensagem PT', () => {
    const error = new HttpError({
      status: 400,
      message: 'Scheduled date must be in the future',
    });
    expect(getFriendlyErrorMessage(error, opts)).toBe(
      'A data de agendamento deve ser no futuro.',
    );
  });

  it('mapeia "Reminder time is required" para mensagem PT', () => {
    const error = new HttpError({
      status: 400,
      message: 'Reminder time is required for recurring reminders',
    });
    expect(getFriendlyErrorMessage(error, opts)).toBe(
      'O horario e obrigatorio para lembretes recorrentes.',
    );
  });

  it('mapeia "not found" generico (EntityNotFoundException) para mensagem PT', () => {
    const error = new HttpError({
      status: 404,
      message: 'Alert reminder with ID abc-123 not found',
    });
    expect(getFriendlyErrorMessage(error, opts)).toBe(
      'Registro nao encontrado. Ele pode ter sido removido.',
    );
  });

  it('mapeia "User phone not found" para mensagem PT', () => {
    const error = new HttpError({
      status: 404,
      message: 'User phone with ID xyz-456 not found',
    });
    expect(getFriendlyErrorMessage(error, opts)).toBe(
      'Registro nao encontrado. Ele pode ter sido removido.',
    );
  });
});
