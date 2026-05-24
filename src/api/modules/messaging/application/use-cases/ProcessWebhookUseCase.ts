import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantFacade,
  TENANT_FACADE,
} from '../../../tenant/application/facades/ITenantFacade';
import { MessagingProviderConfig } from '../../domain/ports/IMessagingGateway';
import {
  IMessagingGatewayRegistry,
  MESSAGING_GATEWAY_REGISTRY,
} from '../../domain/ports/IMessagingGatewayRegistry';
import { UnauthorizedException } from '@shared/domain/exceptions/DomainExceptions';
import { PrismaMessagingWebhookReceiptStore } from '../../infrastructure/persistence/repositories/PrismaMessagingWebhookReceiptStore';
import {
  IInboundMessagePersister,
  INBOUND_MESSAGE_PERSISTER,
} from '../ports/IInboundMessagePersister';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';
import { otelTraceLogFields } from '@shared/infrastructure/observability/otelTraceLogFields';

export interface ProcessWebhookInput {
  body: Record<string, unknown>;
  signature: string;
  requestUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
}

@Injectable()
export class ProcessWebhookUseCase {
  constructor(
    @Inject(TENANT_FACADE)
    private readonly tenantFacade: ITenantFacade,
    @Inject(MESSAGING_GATEWAY_REGISTRY)
    private readonly messagingGatewayRegistry: IMessagingGatewayRegistry,
    @Inject(INBOUND_MESSAGE_PERSISTER)
    private readonly processInboundUseCase: IInboundMessagePersister,
    private readonly webhookReceiptStore: PrismaMessagingWebhookReceiptStore,
    private readonly transactionalEventPublisher: PrismaTransactionalEventPublisher,
    private readonly structuredLog: StructuredLogEmitter,
  ) {}

  async execute(input: ProcessWebhookInput): Promise<{ status: string }> {
    const adapters = this.messagingGatewayRegistry.resolveAll('WHATSAPP');
    const resolved = adapters
      .map((adapter) => ({
        adapter,
        inbound: adapter.parseInboundMessage(input.body) as any,
      }))
      .find((candidate) => candidate.inbound);

    if (!resolved) {
      return { status: 'ignored' };
    }

    const { adapter, inbound } = resolved;
    if (!inbound) {
      return { status: 'ignored' };
    }

    const result = await this.tenantFacade.getWhatsAppConfigByNumber(
      inbound.to,
      inbound.deviceId,
    );
    if (!result) {
      throw new UnauthorizedException(
        'Tenant not found for this number',
        'TENANT_NOT_FOUND',
      );
    }

    const { tenantId, branchId, config } = result;
    if (config.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'WhatsApp not configured or inactive',
        'WHATSAPP_NOT_ACTIVE',
      );
    }

    const gateway = this.messagingGatewayRegistry.resolve(
      'WHATSAPP',
      config.provider,
    );
    if (!gateway) {
      throw new UnauthorizedException(
        'Messaging provider not configured',
        'PROVIDER_NOT_CONFIGURED',
      );
    }

    const isValid = gateway.validateSignature(
      input.signature,
      input.body,
      {
        channel: 'WHATSAPP',
        provider: config.provider,
        credentials: config.credentials,
        webhookSecret: config.webhookSecret,
        externalAccountId: config.whatsappNumber,
        status: config.status,
      } as MessagingProviderConfig,
      {
        requestUrl: input.requestUrl,
        headers: input.headers,
      },
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature', 'INVALID_SIGNATURE');
    }

    const trace = otelTraceLogFields();
    this.structuredLog.emit({
      level: 'info',
      event: 'messaging.webhook.signature_ok',
      message: 'Webhook WhatsApp com assinatura valida; processando inbound',
      tenantId,
      traceId: trace.traceId,
      spanId: trace.spanId,
      attributes: {
        external_message_id: String(inbound.messageId ?? ''),
        messaging_provider: config.provider,
      },
    });

    return this.transactionalEventPublisher.execute(async (tx) => {
      const receipt = await this.webhookReceiptStore.registerReceived(
        {
          channel: 'WHATSAPP',
          provider: config.provider,
          externalMessageId: inbound.messageId,
          externalAccountId: inbound.deviceId,
          fromPhone: inbound.from,
          toPhone: inbound.to || config.whatsappNumber,
          signature: input.signature,
          payload: input.body,
        },
        tx,
      );

      if (!receipt.isNew) {
        const t2 = otelTraceLogFields();
        this.structuredLog.emit({
          level: 'warn',
          event: 'messaging.webhook.idempotent_replay',
          message: 'Webhook ignorado: entrega ja registrada (idempotencia)',
          tenantId,
          traceId: t2.traceId,
          spanId: t2.spanId,
          attributes: {
            external_message_id: String(inbound.messageId ?? ''),
          },
        });
        return {
          result: { status: 'ignored' },
          events: [],
        };
      }

      const inboundEvents =
        await this.processInboundUseCase.persistInboundMessage(
          {
            tenantId,
            branchId: branchId ?? null,
            externalMessageId: inbound.messageId,
            fromPhone: inbound.from,
            toPhone: inbound.to || config.whatsappNumber,
            contentType: inbound.type,
            content: inbound.content,
            channel: 'WHATSAPP',
          },
          { tx },
        );

      if (inboundEvents.length === 0) {
        const t3 = otelTraceLogFields();
        this.structuredLog.emit({
          level: 'info',
          event: 'messaging.webhook.duplicate_message',
          message: 'Inbound ignorado: mensagem duplicada no dominio',
          tenantId,
          traceId: t3.traceId,
          spanId: t3.spanId,
          attributes: {
            external_message_id: String(inbound.messageId ?? ''),
          },
        });
        await this.webhookReceiptStore.markIgnored(
          receipt.id,
          'DUPLICATE_MESSAGE',
          tx,
        );
        return {
          result: { status: 'ignored' },
          events: [],
        };
      }

      await this.webhookReceiptStore.markProcessed(receipt.id, tx);

      return {
        result: { status: 'received' },
        events: inboundEvents,
      };
    });
  }
}
