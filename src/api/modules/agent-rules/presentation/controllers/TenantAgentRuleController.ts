import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GetTenantAgentRuleUseCase } from '../../application/use-cases/GetTenantAgentRuleUseCase';
import { UpsertTenantAgentRuleUseCase } from '../../application/use-cases/UpsertTenantAgentRuleUseCase';
import {
  PreviewTenantAgentRuleUseCase,
  type PreviewTenantAgentRuleOutput,
} from '../../application/use-cases/PreviewTenantAgentRuleUseCase';
import { ListTenantAgentRuleHistoryUseCase } from '../../application/use-cases/ListTenantAgentRuleHistoryUseCase';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { UpsertTenantAgentRuleDto } from '../dtos/UpsertTenantAgentRuleDto';
import { TenantAgentRuleResponseDto } from '../dtos/TenantAgentRuleResponseDto';
import { TenantAgentRuleHistoryEntryDto } from '../dtos/TenantAgentRuleHistoryEntryDto';
import { Request } from 'express';
import { AccessTokenPayload } from '@shared/application/ports/ITokenService';

interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

@Controller('tenants/:tenantId/agent-rules')
@UseGuards(JwtCookieGuard)
export class TenantAgentRuleController {
  constructor(
    private readonly getRuleUseCase: GetTenantAgentRuleUseCase,
    private readonly upsertRuleUseCase: UpsertTenantAgentRuleUseCase,
    private readonly previewRuleUseCase: PreviewTenantAgentRuleUseCase,
    private readonly listHistoryUseCase: ListTenantAgentRuleHistoryUseCase,
  ) {}

  /** Rotas com segmentos extras devem vir antes do `GET :moduleId`. */
  @Post(':moduleId/preview')
  async previewRule(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Query('branchId', new ParseUUIDPipe({ optional: true }))
    branchId: string | undefined,
    @Body() body: UpsertTenantAgentRuleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PreviewTenantAgentRuleOutput> {
    const user = req.user;

    return this.previewRuleUseCase.execute({
      tenantId,
      moduleId,
      branchId,
      customPrompt: body.customPrompt,
      isActive: body.isActive,
      fallbackToGlobal: body.fallbackToGlobal,
      notes: body.notes,
      requestingUserId: user.sub,
      requestingUserTenantId: user.tenantId,
    });
  }

  @Get(':moduleId/history')
  async history(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Query('branchId', new ParseUUIDPipe({ optional: true }))
    branchId: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<TenantAgentRuleHistoryEntryDto[]> {
    const user = req.user;
    const limitNum = Number.parseInt(limitRaw ?? '25', 10);

    return await this.listHistoryUseCase.execute({
      tenantId,
      moduleId,
      branchId,
      limit: Number.isFinite(limitNum) ? limitNum : undefined,
      requestingUserId: user.sub,
      requestingUserTenantId: user.tenantId,
    });
  }

  @Get(':moduleId')
  async getRule(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Query('branchId', new ParseUUIDPipe({ optional: true }))
    branchId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<TenantAgentRuleResponseDto> {
    const user = req.user;

    const rule = await this.getRuleUseCase.execute({
      tenantId,
      moduleId,
      branchId,
      requestingUserId: user.sub,
      requestingUserTenantId: user.tenantId,
    });

    if (!rule) {
      return {
        moduleId,
        branchId: branchId ?? null,
        customPrompt: '',
        isActive: true,
        fallbackToGlobal: true,
        revision: 0,
        scope: branchId ? 'BRANCH' : 'TENANT',
        inheritedFromTenant: false,
      };
    }

    return {
      ...rule,
      branchId: rule.branchId ?? null,
      scope: rule.branchId ? 'BRANCH' : 'TENANT',
      inheritedFromTenant: rule.inheritedFromTenant ?? false,
    };
  }

  @Put(':moduleId')
  async upsertRule(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Query('branchId', new ParseUUIDPipe({ optional: true }))
    branchId: string | undefined,
    @Body() body: UpsertTenantAgentRuleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TenantAgentRuleResponseDto> {
    const user = req.user;

    const rule = await this.upsertRuleUseCase.execute({
      tenantId,
      moduleId,
      branchId,
      customPrompt: body.customPrompt,
      isActive: body.isActive,
      fallbackToGlobal: body.fallbackToGlobal,
      notes: body.notes,
      requestingUserId: user.sub,
      requestingUserTenantId: user.tenantId,
      requestingUserName: user.email,
    });

    return {
      ...rule,
      branchId: rule.branchId ?? null,
      scope: rule.branchId ? 'BRANCH' : 'TENANT',
      inheritedFromTenant: false,
    };
  }
}
