import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { ProspectStopReasonVO } from '../domain/value-objects/ProspectStopReason';

describe('ProspectExecution', () => {
  it('should create a pending execution with zero attempts', () => {
    const execution = ProspectExecution.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      campaignId: new UniqueEntityID('123e4567-e89b-12d3-a456-426614174001'),
      contactId: 'contact-1',
      channel: ProspectChannelVO.create('WHATSAPP'),
    });

    expect(execution.contactId).toBe('contact-1');
    expect(execution.status.value).toBe('PENDING');
    expect(execution.attemptCount).toBe(0);
  });

  it('should require a contact id to create an execution', () => {
    expect(() =>
      ProspectExecution.create({
        tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
        campaignId: new UniqueEntityID('123e4567-e89b-12d3-a456-426614174001'),
        contactId: '',
        channel: ProspectChannelVO.create('WHATSAPP'),
      }),
    ).toThrow(ValidationErrorException);
  });

  it('should mark a contacted execution as responded', () => {
    const execution = ProspectExecution.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      campaignId: new UniqueEntityID('123e4567-e89b-12d3-a456-426614174001'),
      contactId: 'contact-1',
      channel: ProspectChannelVO.create('WHATSAPP'),
    });

    execution.markAsContacted();
    execution.markAsResponded();

    expect(execution.status.value).toBe('RESPONDED');
    expect(execution.attemptCount).toBe(1);
    expect(execution.stopReason).toBeUndefined();
  });

  it('should mark a contacted execution as stopped', () => {
    const execution = ProspectExecution.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      campaignId: new UniqueEntityID('123e4567-e89b-12d3-a456-426614174001'),
      contactId: 'contact-1',
      channel: ProspectChannelVO.create('WHATSAPP'),
    });

    execution.markAsContacted();
    execution.markAsStopped(ProspectStopReasonVO.create('OPT_OUT'));

    expect(execution.status.value).toBe('STOPPED');
    expect(execution.attemptCount).toBe(1);
    expect(execution.stopReason?.value).toBe('OPT_OUT');
  });
});
