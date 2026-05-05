import { Plan } from '../domain/value-objects/Plan';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('Plan Value Object', () => {
  it('should create an ESSENCIAL plan', () => {
    const plan = Plan.create('ESSENCIAL');
    expect(plan.value).toBe('ESSENCIAL');
    expect(plan.isEssencial()).toBe(true);
  });

  it('should create a PROFISSIONAL plan', () => {
    const plan = Plan.create('PROFISSIONAL');
    expect(plan.value).toBe('PROFISSIONAL');
    expect(plan.isProfissional()).toBe(true);
  });

  it('should create an ESCALA plan', () => {
    const plan = Plan.create('ESCALA');
    expect(plan.value).toBe('ESCALA');
    expect(plan.isEscala()).toBe(true);
  });

  it('should be case-insensitive', () => {
    const plan = Plan.create('essencial');
    expect(plan.value).toBe('ESSENCIAL');
  });

  it('should throw an error for invalid plan', () => {
    expect(() => Plan.create('INVALID_PLAN')).toThrow(ValidationErrorException);
  });

  it('should have an essencial factory method', () => {
    const plan = Plan.essencial();
    expect(plan.value).toBe('ESSENCIAL');
    expect(plan.isEssencial()).toBe(true);
  });
});
