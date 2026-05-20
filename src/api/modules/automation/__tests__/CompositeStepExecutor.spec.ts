import { CompositeStepExecutor } from '../infrastructure/workers/CompositeStepExecutor';
import { StepExecutionContext } from '../application/ports/IStepExecutor';
import { StepType } from '../domain/value-objects/StepType';

describe('CompositeStepExecutor', () => {
  let executor: CompositeStepExecutor;

  const baseContext: StepExecutionContext = {
    tenantId: 'tenant-1',
    automationId: 'auto-1',
    executionId: 'exec-1',
    contactId: 'contact-1',
    variables: { name: 'João', amount: 150 },
  };

  beforeEach(() => {
    executor = new CompositeStepExecutor();
    jest.restoreAllMocks();
  });

  describe('send_message', () => {
    it('should interpolate variables and return success', async () => {
      const result = await executor.execute(
        StepType.SEND_MESSAGE,
        { body: 'Olá {{name}}, seu valor é {{amount}}', channel: 'whatsapp' },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output).toEqual(
        expect.objectContaining({
          messageSent: true,
          channel: 'whatsapp',
          body: 'Olá João, seu valor é 150',
        }),
      );
    });

    it('should default channel to whatsapp', async () => {
      const result = await executor.execute(
        StepType.SEND_MESSAGE,
        { body: 'Hello' },
        baseContext,
      );

      expect(result.output?.channel).toBe('whatsapp');
    });
  });

  describe('wait_delay', () => {
    it('should wait for specified delay', async () => {
      jest.useFakeTimers();
      const promise = executor.execute(
        StepType.WAIT_DELAY,
        { delayMs: 1000 },
        baseContext,
      );
      jest.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ waited: 1000 });
      jest.useRealTimers();
    });

    it('should not wait if delayMs is 0', async () => {
      const result = await executor.execute(
        StepType.WAIT_DELAY,
        { delayMs: 0 },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ waited: 0 });
    });
  });

  describe('condition_branch', () => {
    it('should branch to trueStepId when condition is met (equals)', async () => {
      const result = await executor.execute(
        StepType.CONDITION_BRANCH,
        { field: 'name', operator: 'equals', value: 'João', trueStepId: 'step-a', falseStepId: 'step-b' },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output?.conditionMet).toBe(true);
      expect(result.nextStepId).toBe('step-a');
    });

    it('should branch to falseStepId when condition is not met', async () => {
      const result = await executor.execute(
        StepType.CONDITION_BRANCH,
        { field: 'name', operator: 'equals', value: 'Maria', trueStepId: 'step-a', falseStepId: 'step-b' },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output?.conditionMet).toBe(false);
      expect(result.nextStepId).toBe('step-b');
    });

    it('should support contains operator', async () => {
      const result = await executor.execute(
        StepType.CONDITION_BRANCH,
        { field: 'name', operator: 'contains', value: 'oão' },
        baseContext,
      );

      expect(result.output?.conditionMet).toBe(true);
    });

    it('should support gt operator', async () => {
      const result = await executor.execute(
        StepType.CONDITION_BRANCH,
        { field: 'amount', operator: 'gt', value: 100 },
        baseContext,
      );

      expect(result.output?.conditionMet).toBe(true);
    });

    it('should support lt operator', async () => {
      const result = await executor.execute(
        StepType.CONDITION_BRANCH,
        { field: 'amount', operator: 'lt', value: 100 },
        baseContext,
      );

      expect(result.output?.conditionMet).toBe(false);
    });

    it('should support exists operator', async () => {
      const result = await executor.execute(
        StepType.CONDITION_BRANCH,
        { field: 'name', operator: 'exists', value: null },
        baseContext,
      );

      expect(result.output?.conditionMet).toBe(true);
    });
  });

  describe('http_request', () => {
    it('should make HTTP request and return response', async () => {
      const mockResponse = { ok: true, status: 200, text: jest.fn().mockResolvedValue('{"result":"ok"}') };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);

      const result = await executor.execute(
        StepType.HTTP_REQUEST,
        { method: 'POST', url: 'https://example.com/webhook', body: { key: 'value' } },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output?.httpStatus).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should return failure on HTTP error', async () => {
      const mockResponse = { ok: false, status: 500, text: jest.fn().mockResolvedValue('Internal Error') };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);

      const result = await executor.execute(
        StepType.HTTP_REQUEST,
        { method: 'GET', url: 'https://example.com/fail' },
        baseContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500');
    });

    it('should return failure on network error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network timeout'));

      const result = await executor.execute(
        StepType.HTTP_REQUEST,
        { method: 'POST', url: 'https://unreachable.com' },
        baseContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });

  describe('update_contact', () => {
    it('should return success with fields', async () => {
      const result = await executor.execute(
        StepType.UPDATE_CONTACT,
        { fields: { stage: 'CUSTOMER', notes: 'Converted' } },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output?.contactUpdated).toBe(true);
      expect(result.output?.fields).toEqual({ stage: 'CUSTOMER', notes: 'Converted' });
    });
  });

  describe('add_tag', () => {
    it('should return success with tag name', async () => {
      const result = await executor.execute(
        StepType.ADD_TAG,
        { tag: 'vip' },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output?.tagAdded).toBe('vip');
    });
  });

  describe('remove_tag', () => {
    it('should return success with removed tag', async () => {
      const result = await executor.execute(
        StepType.REMOVE_TAG,
        { tag: 'inactive' },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output?.tagRemoved).toBe('inactive');
    });
  });

  describe('assign_agent', () => {
    it('should return success with agent and team', async () => {
      const result = await executor.execute(
        StepType.ASSIGN_AGENT,
        { agentId: 'agent-1', teamId: 'team-1' },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output).toEqual(
        expect.objectContaining({ assigned: true, agentId: 'agent-1', teamId: 'team-1' }),
      );
    });
  });

  describe('ai_response', () => {
    it('should interpolate prompt and return success', async () => {
      const result = await executor.execute(
        StepType.AI_RESPONSE,
        { prompt: 'Responda ao {{name}}' },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output?.aiPrompt).toBe('Responda ao João');
      expect(result.output?.aiResponseGenerated).toBe(true);
    });
  });

  describe('create_task', () => {
    it('should create task with interpolated title', async () => {
      const result = await executor.execute(
        StepType.CREATE_TASK,
        { title: 'Follow up with {{name}}', dueInMs: 3600000 },
        baseContext,
      );

      expect(result.success).toBe(true);
      expect(result.output?.taskCreated).toBe(true);
      expect(result.output?.title).toBe('Follow up with João');
      expect(result.output?.dueInMs).toBe(3600000);
    });
  });

  describe('unknown step type', () => {
    it('should return failure for unknown step type', async () => {
      const result = await executor.execute(
        'nonexistent_step' as any,
        {},
        baseContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown step type');
    });
  });
});
