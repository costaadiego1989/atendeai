import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

@Injectable()
export class GoogleCalendarOAuthService {
  private readonly oauthUrl = 'https://oauth2.googleapis.com/token';
  private readonly authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly apiBaseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor(private readonly configService: ConfigService) {}

  buildAuthorizationUrl(state: string): string {
    this.ensurePlatformConfigured();
    const params = new URLSearchParams({
      client_id: this.getClientId(),
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.app.created',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForRefreshToken(code: string): Promise<{
    refreshToken: string;
    email?: string;
  }> {
    this.ensurePlatformConfigured();
    const response = await axios.post(
      this.oauthUrl,
      new URLSearchParams({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.getRedirectUri(),
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const refreshToken = response.data?.refresh_token;
    const accessToken = response.data?.access_token;

    if (!refreshToken) {
      throw new ValidationErrorException(
        'Google Calendar OAuth did not return a refresh token',
      );
    }

    let email: string | undefined;
    if (accessToken) {
      try {
        const userInfo = await axios.get(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        email = userInfo.data?.email;
      } catch {
        email = undefined;
      }
    }

    return {
      refreshToken,
      email,
    };
  }

  async getAccessToken(refreshToken: string): Promise<string> {
    this.ensurePlatformConfigured();
    const response = await axios.post(
      this.oauthUrl,
      new URLSearchParams({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const token = response.data?.access_token;
    if (!token) {
      throw new ValidationErrorException(
        'Google Calendar OAuth access token could not be obtained',
      );
    }

    return token;
  }

  async createEvent(
    refreshToken: string,
    calendarId: string,
    payload: {
      summary: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      timeZone: string;
      createGoogleMeet?: boolean;
    },
  ): Promise<{ id: string; meetingUrl?: string }> {
    const accessToken = await this.getAccessToken(refreshToken);
    const response = await axios.post(
      `${this.apiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events${
        payload.createGoogleMeet ? '?conferenceDataVersion=1' : ''
      }`,
      {
        summary: payload.summary,
        description: payload.description,
        start: {
          dateTime: payload.startDateTime,
          timeZone: payload.timeZone,
        },
        end: {
          dateTime: payload.endDateTime,
          timeZone: payload.timeZone,
        },
        ...(payload.createGoogleMeet
          ? {
              conferenceData: {
                createRequest: {
                  requestId: `atendeai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  conferenceSolutionKey: {
                    type: 'hangoutsMeet',
                  },
                },
              },
            }
          : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const id = response.data?.id;
    if (!id) {
      throw new ValidationErrorException(
        'Google Calendar event could not be created',
      );
    }

    return {
      id,
      meetingUrl: response.data?.hangoutLink,
    };
  }

  async createCalendar(refreshToken: string, summary: string): Promise<string> {
    const accessToken = await this.getAccessToken(refreshToken);
    const response = await axios.post(
      `${this.apiBaseUrl}/calendars`,
      { summary },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const calendarId = response.data?.id;
    if (!calendarId) {
      throw new ValidationErrorException(
        'Google Calendar could not be created',
      );
    }
    return calendarId;
  }

  async listCalendars(
    refreshToken: string,
  ): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
    const accessToken = await this.getAccessToken(refreshToken);
    const response = await axios.get(
      `${this.apiBaseUrl}/users/me/calendarList`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return (response.data?.items ?? []).map((item: any) => ({
      id: item.id,
      summary: item.summary || item.id,
      primary: Boolean(item.primary),
    }));
  }

  async updateEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
    payload: {
      summary: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      timeZone: string;
      createGoogleMeet?: boolean;
    },
  ): Promise<{ meetingUrl?: string }> {
    const accessToken = await this.getAccessToken(refreshToken);
    const response = await axios.put(
      `${this.apiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}${
        payload.createGoogleMeet ? '?conferenceDataVersion=1' : ''
      }`,
      {
        summary: payload.summary,
        description: payload.description,
        start: {
          dateTime: payload.startDateTime,
          timeZone: payload.timeZone,
        },
        end: {
          dateTime: payload.endDateTime,
          timeZone: payload.timeZone,
        },
        ...(payload.createGoogleMeet
          ? {
              conferenceData: {
                createRequest: {
                  requestId: `atendeai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  conferenceSolutionKey: {
                    type: 'hangoutsMeet',
                  },
                },
              },
            }
          : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return {
      meetingUrl: response.data?.hangoutLink,
    };
  }

  async deleteEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    const accessToken = await this.getAccessToken(refreshToken);
    await axios.delete(
      `${this.apiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  }

  ensurePlatformConfigured() {
    if (
      !this.getClientId() ||
      !this.getClientSecret() ||
      !this.getRedirectUri()
    ) {
      throw new ValidationErrorException(
        'Google Calendar OAuth platform credentials are not configured',
      );
    }
  }

  getClientId(): string {
    return this.configService.get<string>('GOOGLE_CALENDAR_CLIENT_ID') || '';
  }

  getClientSecret(): string {
    return (
      this.configService.get<string>('GOOGLE_CALENDAR_CLIENT_SECRET') || ''
    );
  }

  getRedirectUri(): string {
    return (
      this.configService.get<string>('GOOGLE_CALENDAR_OAUTH_REDIRECT_URI') || ''
    );
  }
}
