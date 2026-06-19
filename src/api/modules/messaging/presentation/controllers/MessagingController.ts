import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Inject,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IListConversationsUseCase } from '../../application/use-cases/interfaces/IListConversationsUseCase';
import { IGetMessageHistoryUseCase } from '../../application/use-cases/interfaces/IGetMessageHistoryUseCase';
import { IMarkConversationReadUseCase } from '../../application/use-cases/interfaces/IMarkConversationReadUseCase';
import { ISendHumanMessageUseCase } from '../../application/use-cases/interfaces/ISendHumanMessageUseCase';
import { IEnsureConversationForContactUseCase } from '../../application/use-cases/interfaces/IEnsureConversationForContactUseCase';
import { IUpdateConversationStatusUseCase } from '../../application/use-cases/interfaces/IUpdateConversationStatusUseCase';
import {
  SUGGEST_AGENT_REPLY_USE_CASE,
  ISuggestAgentReplyUseCase,
} from '../../application/use-cases/interfaces/ISuggestAgentReplyUseCase';
import {
  MARK_CONVERSATION_SALE_USE_CASE,
  IMarkConversationSaleUseCase,
} from '../../application/use-cases/interfaces/IMarkConversationSaleUseCase';
import {
  VOID_CONVERSATION_SALE_USE_CASE,
  IVoidConversationSaleUseCase,
} from '../../application/use-cases/interfaces/IVoidConversationSaleUseCase';
import {
  GET_CONVERSATION_SALE_ATTRIBUTION_USE_CASE,
  IGetConversationSaleAttributionUseCase,
} from '../../application/use-cases/interfaces/IGetConversationSaleAttributionUseCase';
import {
  UPDATE_CONVERSATION_SALE_ATTRIBUTION_USE_CASE,
  IUpdateConversationSaleAttributionUseCase,
} from '../../application/use-cases/interfaces/IUpdateConversationSaleAttributionUseCase';
import {
  EnsureConversationForContactDTO,
  MarkConversationSaleAttributionDTO,
  SendMessageDTO,
  TriggerAutomationDTO,
  UpdateConversationSaleAttributionDTO,
  UpdateConversationStatusDTO,
} from '../dtos/MessagingDTOs';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { TriggerAutomationUseCase } from '@modules/automation/application/use-cases/TriggerAutomationUseCase';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
} from '@modules/automation/application/ports/IAutomationRepository';
import { TriggerType } from '@modules/automation/domain/value-objects/TriggerType';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';

@Controller('tenants/:tenantId/conversations')
@UseGuards(JwtCookieGuard, TenantGuard)
export class MessagingController {
  constructor(
    @Inject(IListConversationsUseCase)
    private readonly listConversationsUseCase: IListConversationsUseCase,
    @Inject(IGetMessageHistoryUseCase)
    private readonly getHistoryUseCase: IGetMessageHistoryUseCase,
    @Inject(IMarkConversationReadUseCase)
    private readonly markConversationReadUseCase: IMarkConversationReadUseCase,
    @Inject(ISendHumanMessageUseCase)
    private readonly sendHumanUseCase: ISendHumanMessageUseCase,
    @Inject(IEnsureConversationForContactUseCase)
    private readonly ensureConversationForContactUseCase: IEnsureConversationForContactUseCase,
    @Inject(IUpdateConversationStatusUseCase)
    private readonly updateConversationStatusUseCase: IUpdateConversationStatusUseCase,
    @Inject(SUGGEST_AGENT_REPLY_USE_CASE)
    private readonly suggestAgentReplyUseCase: ISuggestAgentReplyUseCase,
    @Inject(MARK_CONVERSATION_SALE_USE_CASE)
    private readonly markConversationSaleUseCase: IMarkConversationSaleUseCase,
    @Inject(VOID_CONVERSATION_SALE_USE_CASE)
    private readonly voidConversationSaleUseCase: IVoidConversationSaleUseCase,
    @Inject(GET_CONVERSATION_SALE_ATTRIBUTION_USE_CASE)
    private readonly getConversationSaleAttributionUseCase: IGetConversationSaleAttributionUseCase,
    @Inject(UPDATE_CONVERSATION_SALE_ATTRIBUTION_USE_CASE)
    private readonly updateConversationSaleAttributionUseCase: IUpdateConversationSaleAttributionUseCase,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly storageService: FileStorageService,
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automationRepository: IAutomationRepository,
    private readonly triggerAutomationUseCase: TriggerAutomationUseCase,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
  ) {}

  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Req() req?: any,
  ) {
    return this.listConversationsUseCase.execute({
      tenantId,
      branchId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
      requesterUserId: req?.user?.sub,
      requesterRole: req?.user?.role,
    });
  }

  @Get(':id/messages')
  async history(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.getHistoryUseCase.execute({
      tenantId,
      conversationId: id,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post(':id/messages')
  async reply(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: SendMessageDTO,
  ) {
    return this.sendHumanUseCase.execute({
      tenantId,
      conversationId: id,
      actorUserId: req.user?.sub,
      content: dto.content,
    });
  }

  @Post(':id/messages/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndReply(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('text') text?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado');
    }

    const type = this.detectAttachmentType(file.mimetype);
    const fileUrl = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      { folder: `messaging/${tenantId}/${id}`, isPublic: true },
    );

    if (!fileUrl) {
      throw new BadRequestException('Nao foi possível armazenar o arquivo');
    }

    const output = await this.sendHumanUseCase.execute({
      tenantId,
      conversationId: id,
      actorUserId: req.user?.sub,
      content: {
        type,
        ...(text?.trim() ? { text: text.trim() } : {}),
        url: fileUrl,
      },
    });

    return {
      ...output,
      fileUrl,
      type,
    };
  }

  @Post(':id/read')
  async markRead(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.markConversationReadUseCase.execute({
      tenantId,
      conversationId: id,
    });
  }

  @Post('open-by-contact')
  async openByContact(
    @Param('tenantId') tenantId: string,
    @Body() dto: EnsureConversationForContactDTO,
  ) {
    return this.ensureConversationForContactUseCase.execute({
      tenantId,
      contactId: dto.contactId,
      channel: dto.channel,
    });
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateConversationStatusDTO,
  ) {
    return this.updateConversationStatusUseCase.execute({
      tenantId,
      conversationId: id,
      status: dto.status,
      actorUserId: req.user?.sub,
    });
  }

  @Post(':id/sale-attribution')
  async markSaleAttribution(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: MarkConversationSaleAttributionDTO,
  ) {
    return this.markConversationSaleUseCase.execute({
      tenantId,
      conversationId: id,
      actorUserId: req.user?.sub,
      actorRole: req.user?.role ?? 'AGENT',
      attributedUserId: dto.attributedUserId,
      saleAmount: dto.saleAmount,
      currency: dto.currency ?? undefined,
      notes: dto.notes ?? undefined,
    });
  }

  @Get(':id/sale-attribution')
  async getSaleAttribution(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const sale = await this.getConversationSaleAttributionUseCase.execute({
      tenantId,
      conversationId: id,
    });
    return { sale };
  }

  @Patch(':id/sale-attribution')
  async patchSaleAttribution(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateConversationSaleAttributionDTO,
  ) {
    return this.updateConversationSaleAttributionUseCase.execute({
      tenantId,
      conversationId: id,
      actorUserId: req.user?.sub,
      actorRole: req.user?.role ?? 'AGENT',
      saleAmount: dto.saleAmount,
      notes: dto.notes,
    });
  }

  @Delete(':id/sale-attribution')
  async voidSaleAttribution(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.voidConversationSaleUseCase.execute({
      tenantId,
      conversationId: id,
      actorUserId: req.user?.sub,
      actorRole: req.user?.role ?? 'AGENT',
    });
  }

  @Post(':id/suggest-reply')
  async suggestReply(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.suggestAgentReplyUseCase.execute({
      tenantId,
      conversationId: id,
    });
  }

  @Post(':id/trigger-automation')
  async triggerAutomation(
    @Param('tenantId') tenantId: string,
    @Param('id') conversationId: string,
    @Body() dto: TriggerAutomationDTO,
  ) {
    const automation = await this.automationRepository.findById(
      tenantId,
      dto.automationId,
    );

    if (!automation) {
      throw new BadRequestException(
        'Automation not found or does not belong to this tenant.',
      );
    }

    if (automation.trigger.type !== TriggerType.MANUAL) {
      throw new BadRequestException(
        `Automation "${automation.name}" cannot be triggered manually. Only MANUAL automations are allowed here.`,
      );
    }

    const conversation = await this.conversationRepository.findById(
      conversationId,
      tenantId,
    );

    if (!conversation) {
      throw new BadRequestException('Conversation not found.');
    }

    const executionIds = await this.triggerAutomationUseCase.execute(
      tenantId,
      TriggerType.MANUAL,
      { conversationId, automationId: dto.automationId },
      conversation.contactId.toString(),
    );

    return { executionIds };
  }

  private detectAttachmentType(
    mimeType?: string,
  ): 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' {
    if (mimeType?.startsWith('image/')) {
      return 'IMAGE';
    }
    if (mimeType?.startsWith('audio/')) {
      return 'AUDIO';
    }
    if (mimeType?.startsWith('video/')) {
      return 'VIDEO';
    }

    return 'DOCUMENT';
  }
}
