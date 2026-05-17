import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { IDispatchProspectExecutionUseCase } from '../../application/use-cases/interfaces/IDispatchProspectExecutionUseCase';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';

@Controller('prospecting/executions')
@UseGuards(JwtCookieGuard, RolesGuard)
export class ProspectExecutionController {
  constructor(
    @Inject(IDispatchProspectExecutionUseCase)
    private readonly dispatchProspectExecutionUseCase: IDispatchProspectExecutionUseCase,
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly executionRepository: IProspectExecutionRepository,
  ) {}

  @Get('status')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async getStatus(@Req() req: any, @Query('contactIds') contactIds: string) {
    const ids = contactIds
      ? contactIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    if (ids.length === 0) return [];

    const results = await this.executionRepository.findLatestByContactIds(
      req.user.tenantId,
      ids,
    );
    const byContactId = new Map(results.map((r) => [r.contactId, r]));

    return ids.map((contactId) => {
      const execution = byContactId.get(contactId);
      return execution
        ? {
            contactId,
            status: execution.status,
            lastContactedAt: execution.updatedAt,
            stopReason: execution.stopReason ?? null,
            campaignName: execution.campaignName ?? null,
          }
        : {
            contactId,
            status: 'NONE',
            lastContactedAt: null,
            stopReason: null,
            campaignName: null,
          };
    });
  }

  @Post(':id/dispatch')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  async dispatch(@Req() req: any, @Param('id') id: string) {
    return this.dispatchProspectExecutionUseCase.execute({
      tenantId: req.user.tenantId,
      executionId: id,
    });
  }
}
