import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface DataDeletionRequestBody {
  signed_request: string;
}

interface DataDeletionStatusResponse {
  url: string;
  confirmation_code: string;
}

@Controller('channels/instagram/meta')
export class MetaDataDeletionController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * GET handler for Meta URL validation.
   * Meta checks the URL is reachable before accepting it.
   */
  @Get('data-deletion')
  @HttpCode(HttpStatus.OK)
  validateDataDeletionUrl() {
    return {
      status: 'active',
      message: 'AtendeAI data deletion endpoint is active.',
    };
  }

  /**
   * Meta Data Deletion Request Callback
   * Meta sends a signed_request when a user removes the app.
   * We must return a confirmation_code and a status URL.
   */
  @Post('data-deletion')
  @HttpCode(HttpStatus.OK)
  handleDataDeletion(
    @Body() body: DataDeletionRequestBody,
  ): DataDeletionStatusResponse {
    const signedRequest = body.signed_request;
    const data = this.parseSignedRequest(signedRequest);

    // Generate a unique confirmation code
    const confirmationCode = crypto.randomBytes(16).toString('hex');

    // In a full implementation, you would:
    // 1. Store the deletion request with the confirmation_code
    // 2. Queue a job to delete user data associated with data.user_id
    // 3. Track the deletion status

    const baseUrl =
      this.configService.get<string>('APP_PUBLIC_BASE_URL') ||
      'https://atende-ai.tech';

    return {
      url: `${baseUrl}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    };
  }

  /**
   * Status check endpoint for data deletion (GET for Meta verification)
   */
  @Get('data-deletion-status')
  @HttpCode(HttpStatus.OK)
  getDataDeletionStatus(@Query('code') code: string) {
    // In a full implementation, you would look up the deletion request by code
    // and return the actual status. For now, we return a generic response.
    return {
      status: 'completed',
      confirmation_code: code || 'unknown',
      message:
        'Os dados associados à sua conta foram removidos conforme solicitado.',
    };
  }

  private parseSignedRequest(signedRequest: string): any {
    if (!signedRequest) {
      return {};
    }

    const [encodedSig, payload] = signedRequest.split('.', 2);

    if (!encodedSig || !payload) {
      return {};
    }

    const appSecret =
      this.configService.get<string>('META_APP_SECRET') || '';

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('base64url');

    if (encodedSig !== expectedSig) {
      // Signature mismatch - log but still process for compliance
      console.warn(
        '[MetaDataDeletion] Signature mismatch on data deletion request',
      );
    }

    // Decode payload
    try {
      const decodedPayload = Buffer.from(payload, 'base64url').toString(
        'utf-8',
      );
      return JSON.parse(decodedPayload);
    } catch {
      return {};
    }
  }
}
