import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import {
  AccessTokenPayload,
  ITokenService,
  TOKEN_SERVICE,
} from '@shared/application/ports/ITokenService';
import {
  IMessagingRealtimePublisher,
  MessagingRealtimeEvent,
} from '../../application/ports/IMessagingRealtimePublisher';

const WebSocketPackage = require('ws') as {
  OPEN: number;
  WebSocketServer: new (input: { noServer: boolean }) => {
    on(event: 'connection', listener: (client: any) => void): void;
    handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (client: any) => void,
    ): void;
    emit(event: 'connection', client: any, request: IncomingMessage): void;
    close(): void;
  };
};

type AuthenticatedSocket = {
  readyState: number;
  send(data: string): void;
  close(): void;
  on(event: 'close', listener: () => void): void;
  user?: AccessTokenPayload;
};

@Injectable()
export class WebSocketMessagingRealtimePublisher
  implements IMessagingRealtimePublisher, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(WebSocketMessagingRealtimePublisher.name);
  private readonly clientsByTenant = new Map<string, Set<AuthenticatedSocket>>();
  private server:
    | InstanceType<typeof WebSocketPackage.WebSocketServer>
    | null = null;
  private rawHttpServer: {
    on(event: 'upgrade', listener: (...args: any[]) => void): void;
    off(event: 'upgrade', listener: (...args: any[]) => void): void;
  } | null = null;

  private readonly handleUpgrade = async (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    if (!this.server) {
      socket.destroy();
      return;
    }

    const pathname = this.extractPathname(request.url);
    if (pathname !== '/api/v1/ws/messaging') {
      return;
    }

    try {
      const user = await this.authenticate(request);

      this.server.handleUpgrade(request, socket, head, (client) => {
        const authenticatedClient = client as AuthenticatedSocket;
        authenticatedClient.user = user;
        this.server?.emit('connection', authenticatedClient, request);
      });
    } catch (error) {
      this.logger.warn(
        `Rejected messaging websocket connection: ${(error as Error).message}`,
      );
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
    }
  };

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
  ) {}

  onApplicationBootstrap() {
    this.rawHttpServer =
      this.httpAdapterHost.httpAdapter?.getHttpServer?.() ?? null;
    if (!this.rawHttpServer) {
      this.logger.warn('HTTP server not available for messaging websocket.');
      return;
    }

    this.server = new WebSocketPackage.WebSocketServer({ noServer: true });
    this.server.on('connection', (client) => this.handleConnection(client));
    this.rawHttpServer.on('upgrade', this.handleUpgrade);
    this.logger.log('Messaging websocket server attached at /api/v1/ws/messaging');
  }

  onModuleDestroy() {
    if (this.rawHttpServer) {
      this.rawHttpServer.off('upgrade', this.handleUpgrade);
    }

    this.server?.close();
    this.clientsByTenant.clear();
  }

  async publish(event: MessagingRealtimeEvent): Promise<void> {
    const clients = this.clientsByTenant.get(event.tenantId);
    if (!clients?.size) {
      return;
    }

    const payload = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState !== WebSocketPackage.OPEN) {
        continue;
      }

      client.send(payload);
    }
  }

  private handleConnection(client: AuthenticatedSocket) {
    const tenantId = client.user?.tenantId;

    if (!tenantId) {
      client.close();
      return;
    }

    const tenantClients = this.clientsByTenant.get(tenantId) ?? new Set();
    tenantClients.add(client);
    this.clientsByTenant.set(tenantId, tenantClients);

    client.send(
      JSON.stringify({
        type: 'connection.ready',
        tenantId,
        at: new Date().toISOString(),
      } satisfies MessagingRealtimeEvent),
    );

    client.on('close', () => {
      const currentClients = this.clientsByTenant.get(tenantId);
      if (!currentClients) {
        return;
      }

      currentClients.delete(client);
      if (currentClients.size === 0) {
        this.clientsByTenant.delete(tenantId);
      }
    });
  }

  private async authenticate(
    request: IncomingMessage,
  ): Promise<AccessTokenPayload> {
    const cookies = this.parseCookies(request.headers.cookie);
    const token = cookies['atendeai_access'];

    if (!token) {
      throw new Error('Missing access token cookie.');
    }

    const payload =
      await this.tokenService.verifyAccessToken<AccessTokenPayload>(token);

    if (payload.type !== 'access') {
      throw new Error('Invalid access token.');
    }

    return payload;
  }

  private parseCookies(header: string | undefined): Record<string, string> {
    if (!header?.trim()) {
      return {};
    }

    return header.split(';').reduce<Record<string, string>>((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
  }

  private extractPathname(url: string | undefined): string {
    if (!url) {
      return '';
    }

    try {
      return new URL(url, 'http://localhost').pathname;
    } catch {
      return url.split('?')[0] ?? '';
    }
  }
}
