import { Controller, Post, Body, Get, Param, Query, Patch, Delete } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsObject,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProposalUseCase } from '@modules/proposal/application/use-cases/CreateProposalUseCase';
import { UpdateProposalUseCase } from '@modules/proposal/application/use-cases/UpdateProposalUseCase';
import { DeleteProposalUseCase } from '@modules/proposal/application/use-cases/DeleteProposalUseCase';
import { GetProposalUseCase } from '@modules/proposal/application/use-cases/GetProposalUseCase';
import { ListProposalsUseCase } from '@modules/proposal/application/use-cases/ListProposalsUseCase';
import { GenerateProposalPdfUseCase } from '@modules/proposal/application/use-cases/GenerateProposalPdfUseCase';
import { ScheduleProposalDeliveryUseCase } from '@modules/proposal/application/use-cases/ScheduleProposalDeliveryUseCase';
export class ProposalItemDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateProposalDto {
  @IsString()
  tenantId: string;

  @IsString()
  contactId: string;

  @IsString()
  userId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProposalItemDto)
  items: ProposalItemDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class UpdateProposalDto extends PartialType(CreateProposalDto) {}

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
  ) { }

  @Post()
  async create(@Body() dto: CreateProposalDto) {
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
  async update(@Param('id') id: string, @Body() dto: UpdateProposalDto) {
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
  async schedule(@Param('id') id: string, @Body('scheduledAt') scheduledAt: string) {
    const date = new Date(scheduledAt);
    await this.scheduleProposalDeliveryUseCase.execute({
      proposalId: id,
      scheduledAt: date,
    });

    return { success: true, scheduledAt: date };
  }
}
