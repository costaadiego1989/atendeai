import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          // If the URL is provided by Render, we append pooling parameters to avoid ECONNRESET
          // connection_limit=3 ensures we don't exhaust the 50 limit. pool_timeout gives it breathing room.
          url: process.env.PRISMA_DATABASE_URL?.includes('?') 
            ? `${process.env.PRISMA_DATABASE_URL}&connection_limit=3&pool_timeout=10&socket_timeout=30`
            : `${process.env.PRISMA_DATABASE_URL}?connection_limit=3&pool_timeout=10&socket_timeout=30`,
        },
      },
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to the database successfully.');
    } catch (error) {
      this.logger.error(`Failed to connect to the database: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
