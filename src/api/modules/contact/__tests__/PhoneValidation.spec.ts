/**
 * Unit tests for C5 – phone import skip threshold.
 * Tests the PhoneNumber value object and the updated ImportContactsListUseCase.
 */
import { PhoneNumber } from '../domain/value-objects/PhoneNumber';
import { ImportContactsListUseCase } from '../application/use-cases/ImportContactsListUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { ContactDomainEventPublisher } from '../application/services/ContactDomainEventPublisher';
import { ContactImportParser } from '../application/services/ContactImportParser';

// ──────────────────────────────────────────────────────────────────────────────
// C5a – PhoneNumber value object
// ──────────────────────────────────────────────────────────────────────────────

describe('C5 – PhoneNumber value object', () => {
  describe('isValid()', () => {
    // Valid cases
    it('accepts 8-digit number (minimum E.164)', () => {
      expect(PhoneNumber.isValid('12345678')).toBe(true);
    });

    it('accepts 11-digit Brazilian mobile (55 + 9-digit)', () => {
      expect(PhoneNumber.isValid('55119999999999')).toBe(true);
    });

    it('accepts 13-digit number (max common)', () => {
      expect(PhoneNumber.isValid('5511999999999')).toBe(true);
    });

    it('accepts 15-digit number (maximum E.164)', () => {
      expect(PhoneNumber.isValid('123456789012345')).toBe(true);
    });

    it('accepts phone with spaces, dashes, parens after stripping', () => {
      // "(55) 11 9999-9999" → 5511999999999 = 13 digits
      expect(PhoneNumber.isValid('(55) 11 9999-9999')).toBe(true);
    });

    it('accepts phone with leading + after stripping', () => {
      expect(PhoneNumber.isValid('+5511999999999')).toBe(true);
    });

    // Invalid cases
    it('rejects 7-digit number (below minimum)', () => {
      expect(PhoneNumber.isValid('1234567')).toBe(false);
    });

    it('rejects 16-digit number (above maximum)', () => {
      expect(PhoneNumber.isValid('1234567890123456')).toBe(false);
    });

    it('rejects string with only non-numeric chars (e.g. "abc123def" → 3 digits)', () => {
      // "abc123def" → strips to "123" = 3 digits → invalid
      expect(PhoneNumber.isValid('abc123def')).toBe(false);
    });

    it('rejects a 9-char non-numeric string that would pass the old length check', () => {
      // Old bug: "abc123def" has length 9 which is < 10 → skipped (correct).
      // But "abcde12345" has length 10 → OLD code would NOT skip it (bug).
      // After fix: digits = "12345" = 5 → invalid.
      expect(PhoneNumber.isValid('abcde12345')).toBe(false);
    });

    it('rejects null / undefined', () => {
      expect(PhoneNumber.isValid(null)).toBe(false);
      expect(PhoneNumber.isValid(undefined)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(PhoneNumber.isValid('')).toBe(false);
    });
  });

  describe('normalize()', () => {
    it('strips spaces, dashes, parens, and + sign', () => {
      // "(55) 11 9999-9999" → "551199999999" (12 digits)
      expect(PhoneNumber.normalize('(55) 11 9999-9999')).toBe('551199999999');
      // "+5511999999999" → "5511999999999" (13 digits)
      expect(PhoneNumber.normalize('+5511999999999')).toBe('5511999999999');
      // "55 11 99999-9999" → "5511999999999" (13 digits)
      expect(PhoneNumber.normalize('55 11 99999-9999')).toBe('5511999999999');
    });
  });

  describe('create()', () => {
    it('returns a PhoneNumber with normalized value', () => {
      const phone = PhoneNumber.create('(55) 11 9999-9999');
      expect(phone.value).toBe('551199999999');
    });

    it('throws for an invalid phone', () => {
      expect(() => PhoneNumber.create('abc123def')).toThrow();
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// C5b – ImportContactsListUseCase phone validation
// ──────────────────────────────────────────────────────────────────────────────

describe('C5 – ImportContactsListUseCase phone validation', () => {
  const tenantId = '123e4567-e89b-12d3-a456-426614174000';

  let mockRepo: jest.Mocked<IContactRepository>;
  let mockPublisher: jest.Mocked<ContactDomainEventPublisher>;
  let parser: ContactImportParser;
  let useCase: ImportContactsListUseCase;

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPhone: jest.fn().mockResolvedValue(null),
      findAllByTenant: jest.fn(),
      delete: jest.fn(),
      findAllByPhone: jest.fn(),
      findAllByPhoneAcrossAllTenants: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;

    mockPublisher = { publishFromAggregate: jest.fn() } as any;
    parser = new ContactImportParser();
    useCase = new ImportContactsListUseCase(mockRepo, mockPublisher, parser);
  });

  it('accepts an 8-digit phone number (minimum valid)', async () => {
    const rawText = 'nome,telefone\nJoao Silva,12345678';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('accepts a formatted phone like "(55) 11 9999-9999" after normalization', async () => {
    const rawText = 'nome,telefone\nJoao Silva,(55) 11 9999-9999';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('rejects "abc123def" — 9 chars but only 3 digits — marks as SKIPPED', async () => {
    const rawText = 'nome,telefone\nJoao Silva,abc123def';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(result.items[0].status).toBe('SKIPPED');
    expect(result.items[0].reason).toContain('Telefone');
  });

  it('rejects "abcde12345" — 10 chars but only 5 digits — the old bug allowed this through', async () => {
    // Old code: "abcde12345".length === 10, NOT < 10, so it would NOT be skipped.
    // After fix: digits("abcde12345") = "12345" = 5 chars → invalid → skipped.
    const rawText = 'nome,telefone\nJoao Silva,abcde12345';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
  });

  it('rejects a phone with only 7 digits', async () => {
    const rawText = 'nome,telefone\nJoao Silva,1234567';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
  });

  it('rejects empty phone', async () => {
    const rawText = 'nome,telefone\nJoao Silva,';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
  });
});
