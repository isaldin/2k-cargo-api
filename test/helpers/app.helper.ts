import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from '../../src/app.module';

export async function bootstrapApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.use(helmet());
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
