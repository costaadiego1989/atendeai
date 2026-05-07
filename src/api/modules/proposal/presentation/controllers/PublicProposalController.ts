import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PublicProposalService } from '@modules/proposal/application/services/implementations/PublicProposalService';
import { SkipSuccessEnvelope } from '@shared/infrastructure/http/decorators/skip-success-envelope.decorator';

@SkipSuccessEnvelope()
@Controller('public/proposals')
export class PublicProposalController {
  constructor(private readonly publicProposalService: PublicProposalService) {}

  @Get(':token')
  async getByToken(@Param('token') token: string) {
    return this.publicProposalService.getByToken(token);
  }

  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body()
    body: { signerName?: string | null; signatureDataUrl?: string | null },
  ) {
    return this.publicProposalService.acceptWithSignature(token, body ?? {});
  }

  @Post(':token/reject')
  async reject(@Param('token') token: string) {
    return this.publicProposalService.reject(token);
  }
}
