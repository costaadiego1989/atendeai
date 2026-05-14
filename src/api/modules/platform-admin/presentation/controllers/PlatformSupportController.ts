import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { ListAllFeedbacksUseCase } from '@modules/support/application/use-cases/ListAllFeedbacksUseCase';
import { GetFeedbackDetailsUseCase } from '@modules/support/application/use-cases/GetFeedbackDetailsUseCase';
import { UpdateFeedbackStatusUseCase } from '@modules/support/application/use-cases/UpdateFeedbackStatusUseCase';
import { ReplyFeedbackUseCase } from '@modules/support/application/use-cases/ReplyFeedbackUseCase';
import {
  ListFeedbacksQueryDto,
  UpdateFeedbackStatusBodyDto,
  ReplyFeedbackBodyDto,
} from '../dtos/PlatformSupportDTOs';

@Controller('platform/support/feedbacks')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformSupportController {
  constructor(
    private readonly listAll: ListAllFeedbacksUseCase,
    private readonly getDetails: GetFeedbackDetailsUseCase,
    private readonly updateStatus: UpdateFeedbackStatusUseCase,
    private readonly replyFeedback: ReplyFeedbackUseCase,
  ) {}

  @Get()
  async list(@Query() q: ListFeedbacksQueryDto) {
    return this.listAll.execute({
      page: q.page,
      limit: q.limit,
      type: q.type,
      status: q.status,
      tenantId: q.tenantId,
    });
  }

  @Get(':feedbackId')
  async details(@Param('feedbackId') feedbackId: string) {
    return this.getDetails.execute(feedbackId);
  }

  @Post(':feedbackId/reply')
  async reply(
    @Param('feedbackId') feedbackId: string,
    @Body() body: ReplyFeedbackBodyDto,
  ) {
    return this.replyFeedback.execute({
      feedbackId,
      message: body.message,
      authorName: body.authorName,
    });
  }

  @Patch(':feedbackId/status')
  async patchStatus(
    @Param('feedbackId') feedbackId: string,
    @Body() body: UpdateFeedbackStatusBodyDto,
  ) {
    return this.updateStatus.execute({
      feedbackId,
      status: body.status,
    });
  }
}
