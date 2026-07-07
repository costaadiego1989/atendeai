import { Logger } from '@nestjs/common';
import { ToolExecutionService, ToolExecutionContext, ToolCall } from '../ToolExecutionService';
import { IPaymentLinkGenerator } from '../../ports/IPaymentLinkGenerator';
import { IReserveProfessionalSlot } from '../../ports/IReserveProfessionalSlot';
import { IRepeatLastOrder } from '../../ports/IRepeatLastOrder';
import { IManualAutomationFacade } from '../../ports/IManualAutomationFacade';

jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

describe('ToolExecutionService', () => {
  let service: ToolExecutionService;
  let paymentLinkGenerator: jest.Mocked<IPaymentLinkGenerator>;
  let reserveSlot: jest.Mocked<IReserveProfessionalSlot>;
  let repeatLastOrder: jest.Mocked<IRepeatLastOrder>;
  let automationFacade: jest.Mocked<IManualAutomationFacade>;

  const context: ToolExecutionContext = {
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    conversationId: 'conv-1',
    branchId: 'branch-1',
  };

  beforeEach(() => {
    paymentLinkGenerator = {
      generate: jest.fn(),
    };
    reserveSlot = {
      execute: jest.fn(),
    };
    repeatLastOrder = {
      execute: jest.fn(),
    };
    automationFacade = {
      listActive: jest.fn(),
      dispatch: jest.fn(),
    };

    service = new ToolExecutionService(
      paymentLinkGenerator,
      reserveSlot,
      repeatLastOrder,
      automationFacade,
    );
  });

  describe('generate_payment_link', () => {
    it('calls IPaymentLinkGenerator and returns URL', async () => {
      paymentLinkGenerator.generate.mockResolvedValue({
        id: 'link-123',
        url: 'https://pay.example.com/link-123',
      });

      const toolCall: ToolCall = {
        name: 'generate_payment_link',
        args: { productName: 'Produto X', value: 99.9 },
      };

      const result = await service.execute(toolCall, context);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('generate_payment_link');
      expect(result.data).toEqual({
        url: 'https://pay.example.com/link-123',
        id: 'link-123',
      });
      expect(paymentLinkGenerator.generate).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        name: 'Produto X',
        value: 99.9,
      });
    });
  });

  describe('schedule_slot', () => {
    it('calls IReserveProfessionalSlot and returns confirmation', async () => {
      reserveSlot.execute.mockResolvedValue({
        startsAt: '2026-07-10T14:00:00Z',
        endsAt: '2026-07-10T15:00:00Z',
        label: 'Corte de cabelo',
        status: 'RESERVED',
        payment: null,
      });

      const toolCall: ToolCall = {
        name: 'schedule_slot',
        args: {
          date: '2026-07-10',
          professionalId: 'prof-1',
          slotId: 'slot-1',
          payment: 'not_required',
        },
      };

      const result = await service.execute(toolCall, context);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('schedule_slot');
      expect(result.data).toEqual({
        startsAt: '2026-07-10T14:00:00Z',
        endsAt: '2026-07-10T15:00:00Z',
        label: 'Corte de cabelo',
        status: 'RESERVED',
        paymentLink: undefined,
      });
      expect(reserveSlot.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        professionalId: 'prof-1',
        date: '2026-07-10',
        slotId: 'slot-1',
        categoryId: undefined,
        contactId: 'contact-1',
        conversationId: 'conv-1',
        isFree: true,
      });
    });

    it('returns error when scheduling module not available', async () => {
      const serviceNoScheduling = new ToolExecutionService(
        paymentLinkGenerator,
        undefined,
        repeatLastOrder,
        automationFacade,
      );

      const toolCall: ToolCall = {
        name: 'schedule_slot',
        args: { date: '2026-07-10' },
      };

      const result = await serviceNoScheduling.execute(toolCall, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Scheduling not available');
      expect(result.fallbackMessage).toBeDefined();
    });
  });

  describe('repeat_last_order', () => {
    it('calls IRepeatLastOrder and returns cart summary', async () => {
      repeatLastOrder.execute.mockResolvedValue({
        session: {
          id: 'session-1',
          subtotalAmount: 50,
          totalAmount: 55,
          items: [
            { name: 'Pizza', quantity: 2, unitPrice: 25, lineTotal: 50 },
          ],
        },
        previousOrderId: 'order-99',
        itemsCopied: 1,
      });

      const toolCall: ToolCall = {
        name: 'repeat_last_order',
        args: { confirm: true },
      };

      const result = await service.execute(toolCall, context);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('repeat_last_order');
      expect(result.data).toEqual({
        sessionId: 'session-1',
        totalAmount: 55,
        itemsCopied: 1,
        items: [
          { name: 'Pizza', quantity: 2, unitPrice: 25, lineTotal: 50 },
        ],
      });
      expect(repeatLastOrder.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        conversationId: 'conv-1',
        branchId: 'branch-1',
      });
    });

    it('returns error when commerce module not available', async () => {
      const serviceNoCommerce = new ToolExecutionService(
        paymentLinkGenerator,
        reserveSlot,
        undefined,
        automationFacade,
      );

      const toolCall: ToolCall = {
        name: 'repeat_last_order',
        args: { confirm: true },
      };

      const result = await serviceNoCommerce.execute(toolCall, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Commerce not available');
    });
  });

  describe('trigger_automation', () => {
    it('calls IManualAutomationFacade.dispatch', async () => {
      automationFacade.dispatch.mockResolvedValue(undefined);

      const toolCall: ToolCall = {
        name: 'trigger_automation',
        args: { automationId: '550e8400-e29b-41d4-a716-446655440000' },
      };

      const result = await service.execute(toolCall, context);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('trigger_automation');
      expect(result.data).toEqual({
        automationId: '550e8400-e29b-41d4-a716-446655440000',
        dispatched: true,
      });
      expect(automationFacade.dispatch).toHaveBeenCalledWith(
        'tenant-1',
        '550e8400-e29b-41d4-a716-446655440000',
        'contact-1',
        'conv-1',
        'AI',
      );
    });

    it('returns error when automation module not available', async () => {
      const serviceNoAutomation = new ToolExecutionService(
        paymentLinkGenerator,
        reserveSlot,
        repeatLastOrder,
        undefined,
      );

      const toolCall: ToolCall = {
        name: 'trigger_automation',
        args: { automationId: '550e8400-e29b-41d4-a716-446655440000' },
      };

      const result = await serviceNoAutomation.execute(toolCall, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Automation not available');
    });
  });

  describe('unknown tool', () => {
    it('returns error result', async () => {
      const toolCall: ToolCall = {
        name: 'nonexistent_tool',
        args: {},
      };

      const result = await service.execute(toolCall, context);

      expect(result.success).toBe(false);
      expect(result.toolName).toBe('nonexistent_tool');
      expect(result.error).toContain('Unknown tool');
      expect(result.fallbackMessage).toBeDefined();
    });
  });

  describe('execution failure', () => {
    it('returns graceful error with fallback text', async () => {
      paymentLinkGenerator.generate.mockImplementation(() => {
        return Promise.reject(new Error('Payment gateway timeout'));
      });

      const toolCall: ToolCall = {
        name: 'generate_payment_link',
        args: { productName: 'Produto', value: 10 },
      };

      const result = await service.execute(toolCall, context);

      expect(result.success).toBe(false);
      expect(result.toolName).toBe('generate_payment_link');
      expect(result.error).toBe('Payment gateway timeout');
      expect(result.fallbackMessage).toBeDefined();
    });

    it('handles non-Error throws', async () => {
      paymentLinkGenerator.generate.mockImplementation(async () => {
        throw 'string error'; // eslint-disable-line no-throw-literal
      });

      const toolCall: ToolCall = {
        name: 'generate_payment_link',
        args: { productName: 'X', value: 5 },
      };

      const result = await service.execute(toolCall, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });
});
