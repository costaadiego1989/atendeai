import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { TenantCreatedIntegrationEvent } from '@modules/tenant/application/integration-events/TenantIntegrationEvents';
import { MESSAGING_FACADE, IMessagingFacade } from '../facades/MessagingFacade';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

@Injectable()
export class TrialWelcomeNotificationHandler implements OnModuleInit {
  private readonly logger = new Logger(TrialWelcomeNotificationHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
    private readonly prisma: PrismaService,
  ) { }

  onModuleInit() {
    this.eventBus.subscribe(
      'tenant.created',
      async (event) => {
        await this.handle(event as TenantCreatedIntegrationEvent);
      },
      { consumerName: 'messaging-trial-welcome' },
    );
  }

  private async handle(event: TenantCreatedIntegrationEvent) {
    const payload = (event as any).payload || event;
    const { isTrial, ownerPassword, ownerName, ownerEmail, ownerPhone, aggregateId: tenantId } = payload;

    if (!isTrial) {
      return;
    }

    this.logger.log(`Handling trial welcome notification for tenant ${tenantId} (${ownerEmail})`);

    const welcomeMessage = `Olá ${ownerName}! 🚀\n\nBem-vindo ao AtendeAí! Sua conta de teste de 7 dias foi criada com sucesso.\n\n` +
      `Acesse agora: https://app.atendeai.pro\n` +
      `Usuário: ${ownerEmail}\n` +
      `Senha temporária: ${ownerPassword}\n\n` +
      `Qualquer dúvida, estamos à disposição!`;

    try {
      const contact = await this.prisma.contact.upsert({
        where: {
          tenantId_phone: {
            tenantId: tenantId as string,
            phone: ownerPhone as string,
          },
        },
        update: {
          tags: ["owner"]
        },
        create: {
          tenantId: tenantId as string,
          name: ownerName as string,
          phone: ownerPhone as string,
          tags: ["owner"],
        },
      });

      await this.messagingFacade.queueSystemMessage({
        tenantId: tenantId as string,
        contactId: contact.id,
        channel: 'WHATSAPP',
        text: welcomeMessage,
      });

      this.logger.log(`Trial welcome message queued for ${ownerPhone}`);
    } catch (error) {
      this.logger.error(`Failed to send trial welcome WhatsApp to ${ownerPhone}`, error);
    }
  }
}
