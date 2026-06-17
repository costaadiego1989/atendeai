import { CompositeStepExecutor } from '../infrastructure/workers/CompositeStepExecutor';
import { StepExecutionContext } from '../application/ports/IStepExecutor';
import { IStepHandler } from '../application/ports/IStepHandler';

const baseContext: StepExecutionContext = {
  tenantId: 'tenant-1',
  automationId: 'auto-1',
  executionId: 'exec-1',
  contactId: 'contact-1',
  variables: {},
};

function handler(type: string, impl: IStepHandler['execute']): IStepHandler {
  return { type, execute: impl };
}

describe('CompositeStepExecutor (dispatcher)', () => {
  it('dispatches to the handler registered for the step type', async () => {
    const spy = jest
      .fn()
      .mockResolvedValue({ success: true, output: { ok: true } });
    const executor = new CompositeStepExecutor([handler('send_message', spy)]);

    const result = await executor.execute(
      'send_message',
      { body: 'hi' },
      baseContext,
    );

    expect(spy).toHaveBeenCalledWith({ body: 'hi' }, baseContext);
    expect(result).toEqual({ success: true, output: { ok: true } });
  });

  it('returns failure for an unknown step type', async () => {
    const executor = new CompositeStepExecutor([]);

    const result = await executor.execute('nope', {}, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown step type');
  });

  it('catches handler exceptions and returns a failed result', async () => {
    const executor = new CompositeStepExecutor([
      handler('add_tag', async () => {
        throw new Error('boom');
      }),
    ]);

    const result = await executor.execute('add_tag', {}, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('builds the dispatch map keyed on handler.type', async () => {
    const a = jest.fn().mockResolvedValue({ success: true });
    const b = jest.fn().mockResolvedValue({ success: true });
    const executor = new CompositeStepExecutor([
      handler('wait_delay', a),
      handler('http_request', b),
    ]);

    await executor.execute('http_request', {}, baseContext);

    expect(b).toHaveBeenCalled();
    expect(a).not.toHaveBeenCalled();
  });
});
