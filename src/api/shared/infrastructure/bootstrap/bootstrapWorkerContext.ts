import { INestApplicationContext, Logger, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

export async function bootstrapWorkerContext(
  moduleClass: Type<unknown>,
  workerName: string,
): Promise<void> {
  const logger = new Logger(workerName);

  try {
    const app = await NestFactory.createApplicationContext(moduleClass, {
      logger: ['log', 'error', 'warn'],
    });
    registerShutdownHooks(app, logger);
    logger.log('Worker context started');
  } catch (error) {
    logger.error('Worker bootstrap failed', error instanceof Error ? error.stack : undefined);
    process.exit(1);
  }
}

function registerShutdownHooks(
  app: INestApplicationContext,
  logger: Logger,
): void {
  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.warn(`Received ${signal}, closing worker context`);

    try {
      await app.close();
      logger.log('Worker context closed');
      process.exit(0);
    } catch (error) {
      logger.error(
        'Worker shutdown failed',
        error instanceof Error ? error.stack : undefined,
      );
      process.exit(1);
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}
