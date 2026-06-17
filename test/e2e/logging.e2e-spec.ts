import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapApp } from '../helpers/app.helper';
import { createSession } from '../helpers/session.factory';
import { nockList, nockLoginWrongCredentials } from '../helpers/nock.helper';

const password = 'plain-secret-123';

describe('Logging (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapApp();
  });

  beforeEach(async () => {
    const session = await createSession(app);
    token = session.token;
  });

  describe('X-Request-Id header', () => {
    it('returns a generated X-Request-Id response header', async () => {
      nockList({ page: 1, packages: [] });

      const response = await request(app.getHttpServer())
        .get('/api/packages')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('preserves a valid inbound X-Request-Id header', async () => {
      nockList({ page: 1, packages: [] });
      const requestId = 'custom-request-id-123';

      const response = await request(app.getHttpServer())
        .get('/api/packages')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Request-Id', requestId)
        .expect(200);

      expect(response.headers['x-request-id']).toBe(requestId);
    });

    it('replaces an invalid inbound X-Request-Id header with a generated one', async () => {
      nockList({ page: 1, packages: [] });

      const response = await request(app.getHttpServer())
        .get('/api/packages')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Request-Id', 'has spaces')
        .expect(200);

      expect(response.headers['x-request-id']).not.toBe('has spaces');
      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('login failure logs', () => {
    it('does not include the plaintext password in stderr or stdout', async () => {
      nockLoginWrongCredentials({
        phone: '77073006789',
        password,
      });

      const stdoutSpy = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);
      const stderrSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '77073006789', password })
        .expect(401);

      const allOutput = [...stdoutSpy.mock.calls, ...stderrSpy.mock.calls]
        .map((call) => String(call[0]))
        .join('\n');
      expect(allOutput).not.toContain(password);

      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    });
  });
});
