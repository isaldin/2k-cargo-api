import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { bootstrapApp } from '../helpers/app.helper';
import { createSession } from '../helpers/session.factory';
import {
  nockList,
  nockListEmpty,
  nockSessionExpired,
  nockLogin,
} from '../helpers/nock.helper';
import { ApiSession } from '../../src/session/session.entity';
import { SessionService } from '../../src/session/session.service';

describe('Relogin (e2e)', () => {
  let app: INestApplication;
  let repository: Repository<ApiSession>;
  let sessionService: SessionService;

  beforeAll(async () => {
    app = await bootstrapApp();
    repository = app.get<Repository<ApiSession>>(
      getRepositoryToken(ApiSession),
    );
    sessionService = app.get(SessionService);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('relogs in and retries the request when upstream session expires', async () => {
    const password = 'relogin-secret';
    const { token, session } = await createSession(app, {
      password,
      userId: 123,
    });
    const originalCookies = session.siteCookies;

    nockSessionExpired();
    nockLogin({ phone: session.phone, password, userId: 999 });
    nockList({
      page: 1,
      packages: [
        {
          id: 1,
          trackCode: 'RELTRACK',
          name: 'Relogged Package',
          currentStatus: null,
          statuses: [],
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/api/packages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual([
      {
        id: 1,
        trackCode: 'RELTRACK',
        name: 'Relogged Package',
        currentStatus: null,
        statuses: [],
      },
    ]);

    const updated = await repository.findOne({ where: { token } });
    expect(updated).not.toBeNull();
    expect(updated!.siteCookies).not.toBe(originalCookies);
  });

  it('returns 401 when relogin retry limit is exhausted', async () => {
    const password = 'relogin-secret';
    const { token, session } = await createSession(app, {
      password,
      userId: 123,
    });

    nockSessionExpired();
    nockLogin({ phone: session.phone, password, userId: 999 });
    nockSessionExpired();
    nockLogin({ phone: session.phone, password, userId: 999 });
    nockSessionExpired();

    await request(app.getHttpServer())
      .get('/api/packages')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('decrypts the password from the database for relogin', async () => {
    const password = 'db-password';
    const { token, session } = await createSession(app, {
      password,
      userId: 123,
    });

    nockSessionExpired();
    nockLogin({ phone: session.phone, password, userId: 999 });
    nockListEmpty({ page: 1 });

    await request(app.getHttpServer())
      .get('/api/packages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('does not persist userId change to the database after relogin', async () => {
    const password = 'relogin-secret';
    const { token, session } = await createSession(app, {
      password,
      userId: 123,
    });

    const updateUserIdSpy = jest.spyOn(sessionService, 'updateUserId');

    nockSessionExpired();
    nockLogin({ phone: session.phone, password, userId: 999 });
    nockListEmpty({ page: 1 });

    await request(app.getHttpServer())
      .get('/api/packages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(updateUserIdSpy).not.toHaveBeenCalled();

    const updated = await repository.findOne({ where: { token } });
    expect(updated).not.toBeNull();
    expect(updated!.userId).toBe(123);
  });
});
