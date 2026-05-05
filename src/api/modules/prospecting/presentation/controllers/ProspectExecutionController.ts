import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import {
  IDispatchProspectExecutionUseCase,
} from '../../application/use-cases/interfaces/IDispatchProspectExecutionUseCase';

@Controller('prospecting/executions')
@UseGuards(JwtCookieGuard, RolesGuard)
export class ProspectExecutionController {
  constructor(
    @Inject(IDispatchProspectExecutionUseCase)
    private readonly dispatchProspectExecutionUseCase: IDispatchProspectExecutionUseCase,
  ) {}

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
