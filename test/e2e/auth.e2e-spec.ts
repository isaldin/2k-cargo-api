import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { bootstrapApp } from '../helpers/app.helper';
import { createSession } from '../helpers/session.factory';
import {
  nockLogin,
  nockLoginWrongCredentials,
  nockLoginRedirectWithoutCuid,
  nockLoginRedirectWithNonNumericCuid,
  nockUserIdPage,
  nockLogout,
  nockLogoutFailure,
} from '../helpers/nock.helper';
import { ApiSession } from '../../src/session/session.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let repository: Repository<ApiSession>;

  beforeAll(async () => {
    app = await bootstrapApp();
    repository = app.get<Repository<ApiSession>>(
      getRepositoryToken(ApiSession),
    );
  });

  describe('POST /api/auth/login', () => {
    it('returns 201 and a token on successful login', async () => {
      nockLogin({ phone: '77073006789', password: 'secret', userId: 456 });

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '77073006789', password: 'secret' })
        .expect(201);

      expect(response.body).toHaveProperty('token');

      const session = await repository.findOne({
        where: { token: response.body.token },
      });
      expect(session).not.toBeNull();
      expect(session!.userId).toBe(456);
      expect(session!.phone).toBe('77073006789');
    });

    it('returns 400 for invalid phone or password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '123', password: '' })
        .expect(400);
    });

    it('returns 400 for phone without enough digits', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: 'abcdefghij', password: 'secret' })
        .expect(400);
    });

    it('returns 401 for wrong upstream credentials', async () => {
      nockLoginWrongCredentials({
        phone: '77073006789',
        password: 'wrong',
      });

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '77073006789', password: 'wrong' })
        .expect(401);
    });

    it('returns 401 when upstream does not redirect', async () => {
      nockLoginWrongCredentials({
        phone: '77073006789',
        password: 'secret',
      });

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '77073006789', password: 'secret' })
        .expect(401);
    });

    it('returns 502 when upstream redirect lacks cuid cookie', async () => {
      nockLoginRedirectWithoutCuid({
        phone: '77073006789',
        password: 'secret',
      });
      nockUserIdPage({});

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '77073006789', password: 'secret' })
        .expect(502);
    });

    it('uses user_id from upstream HTML when cuid cookie is not numeric', async () => {
      nockLoginRedirectWithNonNumericCuid({
        phone: '77073006789',
        password: 'secret',
      });
      nockUserIdPage({ userId: 789 });

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '77073006789', password: 'secret' })
        .expect(201);

      const session = await repository.findOne({
        where: { token: response.body.token },
      });
      expect(session).not.toBeNull();
      expect(session!.userId).toBe(789);
    });

    it('returns 502 when user id cannot be resolved from cookies or HTML', async () => {
      nockLoginRedirectWithNonNumericCuid({
        phone: '77073006789',
        password: 'secret',
      });
      nockUserIdPage({});

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '77073006789', password: 'secret' })
        .expect(502);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 204 for a valid token and removes the session', async () => {
      nockLogout();
      const { token } = await createSession(app);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const session = await repository.findOne({ where: { token } });
      expect(session).toBeNull();
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });

    it('removes the session even when upstream logout fails', async () => {
      nockLogoutFailure();
      const { token } = await createSession(app);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const session = await repository.findOne({ where: { token } });
      expect(session).toBeNull();
    });
  });
});
