import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  IPaymentLinkGenerator,
  PAYMENT_LINK_GENERATOR,
} from '../ports/IPaymentLinkGenerator';
import {
  IReserveProfessionalSlot,
  RESERVE_PROFESSIONAL_SLOT,
} from '../ports/IReserveProfessionalSlot';
import { IRepeatLastOrder, REPEAT_LAST_ORDER } from '../ports/IRepeatLastOrder';
import {
  IManualAutomationFacade,
  MANUAL_AUTOMATION_FACADE,
} from '../ports/IManualAutomationFacade';
import { PaymentLinkToolInput } from '../../domain/tools/PaymentLinkTool';
import { ScheduleSlotToolInput } from '../../domain/tools/ScheduleSlotTool';
import { RepeatOrderToolInput } from '../../domain/tools/RepeatOrderTool';
import { TriggerAutomationToolInput } from '../../domain/tools/TriggerAutomationTool';

export interface ToolExecutionContext {
  tenantId: string;
  contactId: string;
  conversationId: string;
  branchId?: string | null;
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  data?: Record<string, unknown>;
  error?: string;
  fallbackMessage?: string;
}

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

@Injectable()
export class ToolExecutionService {
  private readonly logger = new Logger(ToolExecutionService.name);

  constructor(
    @Inject(PAYMENT_LINK_GENERATOR)
    private readonly paymentLinkGenerator: IPaymentLinkGenerator,
    @Optional()
    @Inject(RESERVE_PROFESSIONAL_SLOT)
    private readonly reserveSlot?: IReserveProfessionalSlot,
    @Optional()
    @Inject(REPEAT_LAST_ORDER)
    private readonly repeatLastOrder?: IRepeatLastOrder,
    @Optional()
    @Inject(MANUAL_AUTOMATION_FACADE)
    private readonly automationFacade?: IManualAutomationFacade,
  ) {}

  async execute(
    toolCall: ToolCall,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    try {
      switch (toolCall.name) {
        case 'generate_payment_link':
          return await this.executePaymentLink(
            toolCall.args as unknown as PaymentLinkToolInput,
            context,
          );
        case 'schedule_slot':
          return await this.executeScheduleSlot(
            toolCall.args as unknown as ScheduleSlotToolInput,
            context,
          );
        case 'repeat_last_order':
          return await this.executeRepeatOrder(
            toolCall.args as unknown as RepeatOrderToolInput,
            context,
          );
        case 'trigger_automation':
          return await this.executeTriggerAutomation(
            toolCall.args as unknown as TriggerAutomationToolInput,
            context,
          );
        default:
          return {
            success: false,
            toolName: toolCall.name,
            error: `Unknown tool: ${toolCall.name}`,
            fallbackMessage:
              'Desculpe, não consegui executar essa ação. Posso ajudar de outra forma?',
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Tool execution failed: ${toolCall.name} - ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        success: false,
        toolName: toolCall.name,
        error: message,
        fallbackMessage:
          'Houve um problema ao processar sua solicitação. Pode tentar novamente?',
      };
    }
  }

  private async executePaymentLink(
    args: PaymentLinkToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const result = await this.paymentLinkGenerator.generate({
      tenantId: context.tenantId,
      name: args.productName,
      value: args.value,
    });

    return {
      success: true,
      toolName: 'generate_payment_link',
      data: { url: result.url, id: result.id },
    };
  }

  private async executeScheduleSlot(
    args: ScheduleSlotToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    if (!this.reserveSlot) {
      return {
        success: false,
        toolName: 'schedule_slot',
        error: 'Scheduling not available',
        fallbackMessage:
          'O módulo de agendamento não está disponível no momento.',
      };
    }

    const result = await this.reserveSlot.execute({
      tenantId: context.tenantId,
      branchId: context.branchId,
      professionalId: args.professionalId ?? '',
      date: args.date,
      slotId: args.slotId ?? '',
      categoryId: args.categoryId,
      contactId: context.contactId,
      conversationId: context.conversationId,
      isFree: args.payment === 'not_required',
    });

    return {
      success: true,
      toolName: 'schedule_slot',
      data: {
        startsAt: result.startsAt,
        endsAt: result.endsAt,
        label: result.label,
        status: result.status,
        paymentLink: result.payment?.linkUrl,
      },
    };
  }

  private async executeRepeatOrder(
    _args: RepeatOrderToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    if (!this.repeatLastOrder) {
      return {
        success: false,
        toolName: 'repeat_last_order',
        error: 'Commerce not available',
        fallbackMessage: 'O módulo de pedidos não está disponível no momento.',
      };
    }

    const result = await this.repeatLastOrder.execute({
      tenantId: context.tenantId,
      contactId: context.contactId,
      conversationId: context.conversationId,
      branchId: context.branchId,
    });

    return {
      success: true,
      toolName: 'repeat_last_order',
      data: {
        sessionId: result.session.id,
        totalAmount: result.session.totalAmount,
        itemsCopied: result.itemsCopied,
        items: result.session.items,
      },
    };
  }

  private async executeTriggerAutomation(
    args: TriggerAutomationToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    if (!this.automationFacade) {
      return {
        success: false,
        toolName: 'trigger_automation',
        error: 'Automation not available',
        fallbackMessage:
          'O módulo de automação não está disponível no momento.',
      };
    }

    await this.automationFacade.dispatch(
      context.tenantId,
      args.automationId,
      context.contactId,
      context.conversationId,
      'AI',
    );

    return {
      success: true,
      toolName: 'trigger_automation',
      data: { automationId: args.automationId, dispatched: true },
    };
  }
}
