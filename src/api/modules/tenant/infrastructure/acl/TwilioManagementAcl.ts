import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig, isAxiosError } from 'axios';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

export interface TwilioSenderRecord {
  sid: string;
  status: string;
  senderId: string;
  configuration?: {
    wabaId?: string | null;
    verificationMethod?: 'sms' | 'voice' | null;
  } | null;
}

export interface TwilioSubaccountRecord {
  sid: string;
  authToken: string;
  friendlyName?: string | null;
  status: string;
}

export interface TwilioAccountCredentials {
  accountSid: string;
  authToken: string;
}

export interface TwilioChannelCallContext {
  tenantId?: string;
}

interface CreateTwilioSenderInput {
  senderId: string;
  wabaId: string;
  verificationMethod?: 'sms' | 'voice';
  callbackUrl?: string;
  statusCallbackUrl?: string;
  profile?: {
    name?: string;
    about?: string;
    address?: string;
    description?: string;
    logoUrl?: string;
  };
  account?: TwilioAccountCredentials;
}

@Injectable()
export class TwilioManagementAcl {
  private readonly messagingBaseUrl: string;
  private readonly accountSid: string;
  private readonly authToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly structuredLog: StructuredLogEmitter,
  ) {
    this.messagingBaseUrl =
      this.configService.get<string>('TWILIO_MESSAGING_BASE_URL') ||
      'https://messaging.twilio.com/v2';
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
  }

  async createSubaccount(
    input: { friendlyName: string },
    context?: TwilioChannelCallContext,
  ): Promise<TwilioSubaccountRecord> {
    try {
      const params = new URLSearchParams();
      params.set('FriendlyName', input.friendlyName.slice(0, 64));

      const response = await axios.post(
        `${this.configService.get<string>('TWILIO_API_BASE_URL') || 'https://api.twilio.com/2010-04-01'}/Accounts.json`,
        params.toString(),
        {
          ...this.getAuthConfig(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return this.mapSubaccount(response.data);
    } catch (error) {
      this.emitFailure('tenant.channel.twilio.subaccount.failed', 'Twilio subaccount create failed', context, error);
      throw error;
    }
  }

  async createSender(
    input: CreateTwilioSenderInput,
    context?: TwilioChannelCallContext,
  ): Promise<TwilioSenderRecord> {
    try {
      const response = await axios.post(
        `${this.messagingBaseUrl}/Channels/Senders`,
        {
          sender_id: input.senderId,
          configuration: {
            waba_id: input.wabaId,
            verification_method: input.verificationMethod || 'sms',
            account_type: 'ISV',
          },
          ...(input.callbackUrl || input.statusCallbackUrl
            ? {
                webhook: {
                  ...(input.callbackUrl
                    ? {
                        callback_url: input.callbackUrl,
                        callback_method: 'POST',
                      }
                    : {}),
                  ...(input.statusCallbackUrl
                    ? {
                        status_callback_url: input.statusCallbackUrl,
                        status_callback_method: 'POST',
                      }
                    : {}),
                },
              }
            : {}),
          ...(input.profile ? { profile: input.profile } : {}),
        },
        this.getAuthConfig(input.account),
      );

      return this.mapSender(response.data);
    } catch (error) {
      this.emitFailure(
        'tenant.channel.twilio.create_sender.failed',
        'Twilio WhatsApp sender create failed',
        context,
        error,
      );
      throw error;
    }
  }

  async verifySender(
    input: {
      senderSid: string;
      verificationCode: string;
      wabaId?: string;
      verificationMethod?: 'sms' | 'voice';
      account?: TwilioAccountCredentials;
    },
    context?: TwilioChannelCallContext,
  ): Promise<TwilioSenderRecord> {
    try {
      const response = await axios.post(
        `${this.messagingBaseUrl}/Channels/Senders/${input.senderSid}`,
        {
          configuration: {
            ...(input.wabaId ? { waba_id: input.wabaId } : {}),
            verification_method: input.verificationMethod || 'sms',
            verification_code: input.verificationCode,
            account_type: 'ISV',
          },
        },
        this.getAuthConfig(input.account),
      );

      return this.mapSender(response.data);
    } catch (error) {
      this.emitFailure(
        'tenant.channel.twilio.verify_sender.failed',
        'Twilio WhatsApp sender verification failed',
        context,
        error,
      );
      throw error;
    }
  }

  async getSender(
    senderSid: string,
    account?: TwilioAccountCredentials,
    context?: TwilioChannelCallContext,
  ): Promise<TwilioSenderRecord> {
    try {
      const response = await axios.get(
        `${this.messagingBaseUrl}/Channels/Senders/${senderSid}`,
        this.getAuthConfig(account),
      );

      return this.mapSender(response.data);
    } catch (error) {
      this.emitFailure(
        'tenant.channel.twilio.get_sender.failed',
        'Twilio WhatsApp sender fetch failed',
        context,
        error,
      );
      throw error;
    }
  }

  private emitFailure(
    event: string,
    message: string,
    context: TwilioChannelCallContext | undefined,
    error: unknown,
  ): void {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const errMessage = error instanceof Error ? error.message : String(error);

    this.structuredLog.emit({
      level: 'warn',
      event,
      message,
      tenantId: context?.tenantId,
      attributes: {
        provider: 'TWILIO',
        http_status: status != null ? String(status) : 'n/a',
        error_message: errMessage.slice(0, 400),
      },
    });
  }

  private getAuthConfig(account?: TwilioAccountCredentials): AxiosRequestConfig {
    const accountSid = account?.accountSid || this.accountSid;
    const authToken = account?.authToken || this.authToken;

    if (!accountSid || !authToken) {
      throw new Error('Twilio account credentials are not configured');
    }

    return {
      auth: {
        username: accountSid,
        password: authToken,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  private mapSender(input: any): TwilioSenderRecord {
    return {
      sid: input.sid,
      status: input.status,
      senderId: input.sender_id,
      configuration: input.configuration
        ? {
            wabaId: input.configuration.waba_id ?? null,
            verificationMethod:
              input.configuration.verification_method ?? null,
          }
        : null,
    };
  }

  private mapSubaccount(input: any): TwilioSubaccountRecord {
    return {
      sid: input.sid,
      authToken: input.auth_token,
      friendlyName: input.friendly_name ?? null,
      status: input.status,
    };
  }
}
