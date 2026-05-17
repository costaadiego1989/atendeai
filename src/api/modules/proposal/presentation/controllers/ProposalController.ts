import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { CreateProposalUseCase } from '@modules/proposal/application/use-cases/CreateProposalUseCase';
import { UpdateProposalUseCase } from '@modules/proposal/application/use-cases/UpdateProposalUseCase';
import { DeleteProposalUseCase } from '@modules/proposal/application/use-cases/DeleteProposalUseCase';
import { GetProposalUseCase } from '@modules/proposal/application/use-cases/GetProposalUseCase';
import { ListProposalsUseCase } from '@modules/proposal/application/use-cases/ListProposalsUseCase';
import { GenerateProposalPdfUseCase } from '@modules/proposal/application/use-cases/GenerateProposalPdfUseCase';
import { ScheduleProposalDeliveryUseCase } from '@modules/proposal/application/use-cases/ScheduleProposalDeliveryUseCase';
import { SendProposalToConversationUseCase } from '@modules/proposal/application/use-cases/SendProposalToConversationUseCase';

type ProposalItemInput = {
  name: string;
  quantity: number;
  unitPrice: number;
  description?: string;
};

type CreateProposalInput = {
  tenantId: string;
  contactId: string;
  userId: string;
  title: string;
  description?: string;
  benefits?: string;
  items: ProposalItemInput[];
  metadata?: Record<string, unknown>;
  validUntil?: string;
};

function asString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return '';
  }

  return String(value);
}

function toOptionalString(value: unknown): string | undefined {
  const result = asString(value).trim();
  return result || undefined;
}

function toOptionalDateString(value: unknown): string | undefined {
  const result = toOptionalString(value);
  if (!result) {
    return undefined;
  }

  const parsed = new Date(result);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toProposalItems(value: unknown): ProposalItemInput[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('A proposta precisa ter ao menos um item.');
  }

  const items = value.map((item) => {
    const record = item as Record<string, unknown>;
    const quantity = Number(record?.quantity ?? 0);
    const unitPrice = Number(record?.unitPrice ?? 0);

    return {
      name: asString(record?.name).trim(),
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      description: toOptionalString(record?.description),
    };
  });

  return items;
}

function toCreateProposalInput(
  body: Record<string, unknown>,
): CreateProposalInput {
  return {
    tenantId: asString(body.tenantId).trim(),
    contactId: asString(body.contactId).trim(),
    userId: asString(body.userId).trim(),
    title: asString(body.title).trim(),
    description: toOptionalString(body.description),
    benefits: toOptionalString(body.benefits),
    items: toProposalItems(body.items),
    metadata: toMetadata(body.metadata),
    validUntil: toOptionalDateString(body.validUntil),
  };
}

function toUpdateProposalInput(body: Record<string, unknown>) {
  return {
    tenantId:
      body.tenantId === undefined
        ? undefined
        : asString(body.tenantId).trim() || undefined,
    contactId:
      body.contactId === undefined
        ? undefined
        : asString(body.contactId).trim() || undefined,
    userId:
      body.userId === undefined
        ? undefined
        : asString(body.userId).trim() || undefined,
    title:
      body.title === undefined
        ? undefined
        : asString(body.title).trim() || undefined,
    description:
      body.description === undefined
        ? undefined
        : toOptionalString(body.description),
    benefits:
      body.benefits === undefined ? undefined : toOptionalString(body.benefits),
    items: body.items === undefined ? undefined : toProposalItems(body.items),
    metadata:
      body.metadata === undefined ? undefined : toMetadata(body.metadata),
    validUntil:
      body.validUntil === undefined
        ? undefined
        : toOptionalDateString(body.validUntil),
  };
}

@Controller('proposals')
export class ProposalController {
  constructor(
    private readonly createProposalUseCase: CreateProposalUseCase,
    private readonly updateProposalUseCase: UpdateProposalUseCase,
    private readonly deleteProposalUseCase: DeleteProposalUseCase,
    private readonly getProposalUseCase: GetProposalUseCase,
    private readonly listProposalsUseCase: ListProposalsUseCase,
    private readonly generateProposalPdfUseCase: GenerateProposalPdfUseCase,
    private readonly scheduleProposalDeliveryUseCase: ScheduleProposalDeliveryUseCase,
    private readonly sendProposalToConversationUseCase: SendProposalToConversationUseCase,
  ) {}

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const dto = toCreateProposalInput(body);
    const result = await this.createProposalUseCase.execute({
      ...dto,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    });

    // Automatically generate PDF after creation
    await this.generateProposalPdfUseCase.execute(result.id);

    return { success: true, ...result };
  }

  @Get()
  async list(@Query('tenantId') tenantId: string) {
    return this.listProposalsUseCase.execute(tenantId);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.getProposalUseCase.execute(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const dto = toUpdateProposalInput(body);
    const result = await this.updateProposalUseCase.execute(id, {
      ...dto,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    });
    return { success: true, ...result };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.deleteProposalUseCase.execute(id);
  }

  @Post(':id/pdf')
  async generatePdf(@Param('id') id: string) {
    const pdfUrl = await this.generateProposalPdfUseCase.execute(id);
    return { success: true, pdfUrl };
  }

  @Post(':id/schedule')
  async schedule(
    @Param('id') id: string,
    @Body('scheduledAt') scheduledAt: string,
  ) {
    const date = new Date(scheduledAt);
    await this.scheduleProposalDeliveryUseCase.execute({
      proposalId: id,
      scheduledAt: date,
    });

    return { success: true, scheduledAt: date };
  }

  @Post(':id/send')
  async send(@Param('id') id: string) {
    const result = await this.sendProposalToConversationUseCase.execute(id);
    return { success: true, ...result };
  }
}
