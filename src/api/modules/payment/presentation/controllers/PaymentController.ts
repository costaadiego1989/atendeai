import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ProcessWebhookUseCase } from '../../application/use-cases/ProcessWebhookUseCase';
import { AsaasWebhookGuard } from '../guards/AsaasWebhookGuard';

@Controller('webhooks/asaas')
export class PaymentController {
  constructor(private readonly processWebhookUseCase: ProcessWebhookUseCase) {}

  @Post()
  @UseGuards(AsaasWebhookGuard)
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers('asaas-api-signature') signature?: string,
  ) {
    await this.processWebhookUseCase.execute(payload, signature);
    return { received: true };
  }
}
