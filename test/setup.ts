import dotenv from 'dotenv';
import nock from 'nock';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiSession } from '../src/session/session.entity';

dotenv.config({ path: '.env.test' });

nock.disableNetConnect();
nock.enableNetConnect('127.0.0.1');

function getTestApp(): INestApplication | undefined {
  return (global as { __TEST_APP__?: INestApplication }).__TEST_APP__;
}

afterEach(async () => {
  const pending = nock.pendingMocks();
  nock.cleanAll();

  const app = getTestApp();
  if (app) {
    const repository = app.get<Repository<ApiSession>>(
      getRepositoryToken(ApiSession),
    );
    await repository.clear();
  }

  if (pending.length > 0) {
    throw new Error(`Pending nock mocks: ${pending.join(', ')}`);
  }
});

afterAll(async () => {
  const app = getTestApp();
  if (app) {
    await app.close();
    (global as { __TEST_APP__?: INestApplication }).__TEST_APP__ = undefined;
  }
});
