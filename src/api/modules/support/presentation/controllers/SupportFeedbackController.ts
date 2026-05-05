import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AuthenticatedUser,
  JwtCookieGuard,
} from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { CreateSupportFeedbackUseCase } from '../../application/use-cases/CreateSupportFeedbackUseCase';
import { ListSupportFeedbacksUseCase } from '../../application/use-cases/ListSupportFeedbacksUseCase';
import { CreateSupportFeedbackDTO } from '../dtos/SupportFeedbackDTOs';

@Controller('support/feedbacks')
@UseGuards(JwtCookieGuard)
export class SupportFeedbackController {
  constructor(
    private readonly createSupportFeedbackUseCase: CreateSupportFeedbackUseCase,
    private readonly listSupportFeedbacksUseCase: ListSupportFeedbacksUseCase,
  ) {}

  @Get()
  async list(@Req() req: Request, @Query('branchId') branchId?: string) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    return this.listSupportFeedbacksUseCase.execute({
      tenantId: user.tenantId,
      branchId,
    });
  }

  @Post()
  async create(@Req() req: Request, @Body() body: CreateSupportFeedbackDTO) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    return this.createSupportFeedbackUseCase.execute({
      tenantId: user.tenantId,
      branchId: body.branchId,
      userId: user.sub,
      type: body.type,
      title: body.title,
      description: body.description,
      pagePath: body.pagePath,
      appModule: body.appModule,
    });
  }
}
