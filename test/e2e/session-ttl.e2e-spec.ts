import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import helmet from 'helmet';
import { AppModule } from '../../src/app.module';
import { createSession } from '../helpers/session.factory';
import { ApiSession } from '../../src/session/session.entity';

async function bootstrapAppWithTtl(): Promise<INestApplication> {
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
  return app;
}

describe('Session TTL (e2e)', () => {
  let app: INestApplication;
  let repository: Repository<ApiSession>;
  const originalTtl = process.env.SESSION_TTL_SECONDS;

  beforeAll(async () => {
    process.env.SESSION_TTL_SECONDS = '1';
    app = await bootstrapAppWithTtl();
    repository = app.get<Repository<ApiSession>>(
      getRepositoryToken(ApiSession),
    );
  });

  afterAll(async () => {
    await app.close();
    process.env.SESSION_TTL_SECONDS = originalTtl;
  });

  it('returns 401 when session is idle longer than SESSION_TTL_SECONDS', async () => {
    const { token } = await createSession(app);

    await repository.update(
      { token },
      { lastUsedAt: new Date(Date.now() - 2 * 1000) },
    );

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    const session = await repository.findOne({ where: { token } });
    expect(session).toBeNull();
  });
});
