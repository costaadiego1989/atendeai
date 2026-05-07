import { Controller, Get, Param, Post } from '@nestjs/common';
import { PublicProposalService } from '@modules/proposal/application/services/implementations/PublicProposalService';

@Controller('public/proposals')
export class PublicProposalController {
  constructor(private readonly publicProposalService: PublicProposalService) {}

  @Get(':token')
  async getByToken(@Param('token') token: string) {
    return {
      success: true,
      data: await this.publicProposalService.getByToken(token),
    };
  }

  @Post(':token/accept')
  async accept(@Param('token') token: string) {
    return {
      success: true,
      data: await this.publicProposalService.accept(token),
    };
  }

  @Post(':token/reject')
  async reject(@Param('token') token: string) {
    return {
      success: true,
      data: await this.publicProposalService.reject(token),
    };
  }
}
