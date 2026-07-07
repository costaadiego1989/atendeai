import { PaymentLinkToolSchema } from '../PaymentLinkTool';
import { ScheduleSlotToolSchema } from '../ScheduleSlotTool';
import { RepeatOrderToolSchema } from '../RepeatOrderTool';
import { TriggerAutomationToolSchema } from '../TriggerAutomationTool';

describe('Tool Schemas', () => {
  describe('PaymentLinkToolSchema', () => {
    it('accepts valid input', () => {
      const result = PaymentLinkToolSchema.safeParse({
        productName: 'Plano Premium',
        value: 99.9,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing productName', () => {
      const result = PaymentLinkToolSchema.safeParse({ value: 50 });
      expect(result.success).toBe(false);
    });

    it('rejects zero value', () => {
      const result = PaymentLinkToolSchema.safeParse({
        productName: 'X',
        value: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative value', () => {
      const result = PaymentLinkToolSchema.safeParse({
        productName: 'X',
        value: -10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ScheduleSlotToolSchema', () => {
    it('accepts valid input with all fields', () => {
      const result = ScheduleSlotToolSchema.safeParse({
        date: '2026-08-15',
        professionalId: 'prof-123',
        slotId: 'slot-456',
        categoryId: 'cat-789',
        payment: 'required',
      });
      expect(result.success).toBe(true);
    });

    it('accepts minimal input (date only)', () => {
      const result = ScheduleSlotToolSchema.safeParse({
        date: '2026-08-15',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const result = ScheduleSlotToolSchema.safeParse({
        date: '15/08/2026',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing date', () => {
      const result = ScheduleSlotToolSchema.safeParse({
        professionalId: 'prof-123',
      });
      expect(result.success).toBe(false);
    });

    it('defaults payment to not_required', () => {
      const result = ScheduleSlotToolSchema.safeParse({
        date: '2026-08-15',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payment).toBe('not_required');
      }
    });
  });

  describe('RepeatOrderToolSchema', () => {
    it('accepts confirm: true', () => {
      const result = RepeatOrderToolSchema.safeParse({ confirm: true });
      expect(result.success).toBe(true);
    });

    it('accepts confirm: false', () => {
      const result = RepeatOrderToolSchema.safeParse({ confirm: false });
      expect(result.success).toBe(true);
    });

    it('rejects missing confirm', () => {
      const result = RepeatOrderToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects non-boolean confirm', () => {
      const result = RepeatOrderToolSchema.safeParse({ confirm: 'yes' });
      expect(result.success).toBe(false);
    });
  });

  describe('TriggerAutomationToolSchema', () => {
    it('accepts valid UUID', () => {
      const result = TriggerAutomationToolSchema.safeParse({
        automationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID string', () => {
      const result = TriggerAutomationToolSchema.safeParse({
        automationId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing automationId', () => {
      const result = TriggerAutomationToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
