import './instrumentation';

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { DeviceIdInterceptor } from '@shared/infrastructure/http/interceptors/DeviceIdInterceptor';

function assertProductionDatastoreEnv(): void {
  const enforce =
    process.env['RENDER'] === 'true' ||
    process.env['NODE_ENV'] === 'production';

  if (!enforce) {
    return;
  }

  const dbUrl = process.env['PRISMA_DATABASE_URL']?.trim() ?? '';
  if (!dbUrl) {
    console.error(
      '[bootstrap] Em produção é obrigatório definir PRISMA_DATABASE_URL (URL interna do Postgres no Render).',
    );
    process.exit(1);
  }

  if (/127\.0\.0\.1|localhost/i.test(dbUrl)) {
    console.error(
      '[bootstrap] PRISMA_DATABASE_URL não pode apontar para localhost em produção. ' +
        'No Render: Postgres → copiar "Internal Database URL" para esta variável.',
    );
    process.exit(1);
  }

  const redisHost = process.env['REDIS_HOST']?.trim() ?? '';
  if (!redisHost || /^127\.0\.0\.1$/i.test(redisHost) || /^localhost$/i.test(redisHost)) {
    console.error(
      '[bootstrap] REDIS_HOST deve ser o hostname do Redis gerido no Render (ex.: redis-xxxx em *.render.com), não localhost.',
    );
    process.exit(1);
  }
}

async function bootstrap() {
  try {
    assertProductionDatastoreEnv();

    const app = await NestFactory.create(AppModule);
    app.use(cookieParser());

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalInterceptors(new DeviceIdInterceptor());
    app.useGlobalInterceptors(
      new SuccessResponseInterceptor(app.get(Reflector)),
    );
    app.enableCors({
      origin: true,
      credentials: true,
    });
    app.setGlobalPrefix('api/v1');

    const rawPort = process.env['PORT'] ?? process.env['APP_PORT'] ?? '3000';
    const port = Number.parseInt(String(rawPort), 10);
    const listenPort =
      Number.isFinite(port) && port > 0 ? port : 3000;
    await app.listen(listenPort);
    console.log(`🚀 AtendeAi running on http://localhost:${listenPort}/api/v1`);
  } catch (err) {
    console.error('Fatal error during bootstrap:');
    console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('Unhandled Rejection during bootstrap:');
  console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  process.exit(1);
});
