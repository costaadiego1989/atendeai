import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreateAutomationDto, UpdateAutomationDto } from '../dtos/AutomationDto';
import { CreateAutomationUseCase } from '../../application/use-cases/CreateAutomationUseCase';
import { UpdateAutomationUseCase } from '../../application/use-cases/UpdateAutomationUseCase';
import { ListAutomationsUseCase } from '../../application/use-cases/ListAutomationsUseCase';
import { DeleteAutomationUseCase } from '../../application/use-cases/DeleteAutomationUseCase';

@Controller('tenants/:tenantId/automations')
export class AutomationController {
  constructor(
    private readonly createUseCase: CreateAutomationUseCase,
    private readonly updateUseCase: UpdateAutomationUseCase,
    private readonly listUseCase: ListAutomationsUseCase,
    private readonly deleteUseCase: DeleteAutomationUseCase,
  ) {}

  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Query('active') active?: string,
  ) {
    const onlyActive = active === 'true';
    return this.listUseCase.execute(tenantId, onlyActive);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAutomationDto,
  ) {
    return this.createUseCase.execute({
      tenantId,
      name: dto.name,
      description: dto.description,
      trigger: dto.trigger as any,
      conditions: dto.conditions,
      steps: dto.steps.map((s, idx) => ({
        type: s.type,
        config: s.config,
        order: s.order ?? idx,
      })),
    });
  }

  @Put(':id')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.updateUseCase.execute({
      tenantId,
      automationId: id,
      name: dto.name,
      description: dto.description,
      trigger: dto.trigger,
      conditions: dto.conditions,
      steps: dto.steps?.map((s, idx) => ({
        type: s.type,
        config: s.config,
        order: s.order ?? idx,
      })),
      isActive: dto.isActive,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    await this.deleteUseCase.execute(tenantId, id);
  }

  @Put(':id/activate')
  async activate(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.updateUseCase.execute({
      tenantId,
      automationId: id,
      isActive: true,
    });
  }

  @Put(':id/deactivate')
  async deactivate(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.updateUseCase.execute({
      tenantId,
      automationId: id,
      isActive: false,
    });
  }
}
