import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from '../../src/app.module';
import { AppLogger } from '../../src/common/logging/app-logger.service';
import { RequestIdMiddleware } from '../../src/common/logging/request-id.middleware';
import { AppConfig } from '../../src/config/app.config';

export async function bootstrapApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>('app');
  const logger = app.get(AppLogger);
  logger.configure({
    level: appConfig.logLevel,
    format: appConfig.logFormat,
    stacks: appConfig.logStacks,
  });
  app.useLogger(logger);

  app.use(helmet());
  app.use(new RequestIdMiddleware().use);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  await app.init();
  setTestApp(app);
  return app;
}

export function setTestApp(app: INestApplication): void {
  (global as { __TEST_APP__?: INestApplication }).__TEST_APP__ = app;
}

export function getTestApp(): INestApplication | undefined {
  return (global as { __TEST_APP__?: INestApplication }).__TEST_APP__;
}
