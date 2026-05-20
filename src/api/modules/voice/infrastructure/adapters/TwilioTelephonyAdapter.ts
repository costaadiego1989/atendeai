import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ITelephonyProvider,
  MakeCallParams,
  MakeCallResult,
} from '../../application/ports/ITelephonyProvider';

/**
 * Twilio adapter for making and managing voice calls.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER env vars.
 */
@Injectable()
export class TwilioTelephonyAdapter implements ITelephonyProvider {
  private readonly logger = new Logger(TwilioTelephonyAdapter.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;
  }

  async makeCall(params: MakeCallParams): Promise<MakeCallResult> {
    try {
      const body = new URLSearchParams({
        To: params.to,
        From: params.from,
        Url: params.webhookUrl,
        StatusCallback: params.statusCallbackUrl,
        StatusCallbackEvent: 'initiated ringing answered completed',
        Record: 'true',
        RecordingStatusCallback: params.statusCallbackUrl,
      });

      const response = await fetch(`${this.baseUrl}/Calls.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Twilio makeCall failed: ${error}`);
        return { success: false, error };
      }

      const data = await response.json();
      return { success: true, externalCallId: data.sid };
    } catch (error: any) {
      this.logger.error(`Twilio makeCall error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async endCall(externalCallId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/Calls/${externalCallId}.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'Status=completed',
      });
    } catch (error: any) {
      this.logger.error(`Twilio endCall error: ${error.message}`);
    }
  }

  async transferCall(externalCallId: string, to: string): Promise<void> {
    try {
      const twiml = `<Response><Dial>${to}</Dial></Response>`;
      await fetch(`${this.baseUrl}/Calls/${externalCallId}.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ Twiml: twiml }).toString(),
      });
    } catch (error: any) {
      this.logger.error(`Twilio transferCall error: ${error.message}`);
    }
  }
}
