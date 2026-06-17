import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapApp } from '../helpers/app.helper';
import { createSession } from '../helpers/session.factory';
import {
  nockList,
  nockListCards,
  nockListEmpty,
  nockListWithPackage,
  nockAdd,
  nockDelete,
} from '../helpers/nock.helper';

describe('PackagesController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let userId: number;

  beforeAll(async () => {
    app = await bootstrapApp();
  });

  beforeEach(async () => {
    const session = await createSession(app);
    token = session.token;
    userId = session.session.userId;
  });

  describe('GET /api/packages', () => {
    it('returns 200 with a list of packages', async () => {
      nockList({
        page: 1,
        packages: [
          {
            id: 1,
            trackCode: 'TRACK12345',
            name: 'First Package',
            currentStatus: null,
            statuses: [],
          },
          {
            id: 2,
            trackCode: 'TRACK67890',
            name: 'Second Package',
            currentStatus: null,
            statuses: [],
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/packages?page=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual({
        id: 1,
        trackCode: 'TRACK12345',
        name: 'First Package',
        currentStatus: null,
        statuses: [],
      });
    });

    it('parses current upstream card layout', async () => {
      nockListCards({
        page: 1,
        packages: [
          {
            id: 176109,
            trackCode: 'SMOKE-20260617050814',
            name: 'Smoke Test Package',
            currentStatus: null,
            statuses: [],
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/packages?page=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([
        {
          id: 176109,
          trackCode: 'SMOKE-20260617050814',
          name: 'Smoke Test Package',
          currentStatus: null,
          statuses: [],
        },
      ]);
    });

    it('returns currentStatus as the last active row when active rows are followed by gray rows', async () => {
      nockListCards({
        page: 1,
        packages: [
          {
            id: 176109,
            trackCode: 'JT5495066836397',
            name: 'Органайзер в рюкзак',
            currentStatus: {
              label: 'В пути',
              timestamp: '2026-06-15T12:01:06+05:00',
              rawTimestamp: '2026-06-15 12:01:06',
              active: true,
            },
            statuses: [
              {
                label: 'Принят на складе Китая',
                timestamp: '2026-06-14T11:34:29+05:00',
                rawTimestamp: '2026-06-14 11:34:29',
                active: true,
              },
              {
                label: 'Отправлен со склада Китая',
                timestamp: '2026-06-15T12:00:13+05:00',
                rawTimestamp: '2026-06-15 12:00:13',
                active: true,
              },
              {
                label: 'В пути',
                timestamp: '2026-06-15T12:01:06+05:00',
                rawTimestamp: '2026-06-15 12:01:06',
                active: true,
              },
              {
                label: 'Прибыл в Алмату',
                timestamp: null,
                rawTimestamp: null,
                active: false,
              },
              {
                label: 'Прибыл в город Караганда',
                timestamp: null,
                rawTimestamp: null,
                active: false,
              },
              {
                label: 'Цена будет определена в Караганде',
                timestamp: null,
                rawTimestamp: null,
                active: false,
              },
            ],
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/packages?page=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([
        {
          id: 176109,
          trackCode: 'JT5495066836397',
          name: 'Органайзер в рюкзак',
          currentStatus: {
            label: 'В пути',
            timestamp: '2026-06-15T12:01:06+05:00',
            rawTimestamp: '2026-06-15 12:01:06',
            active: true,
          },
          statuses: [
            {
              label: 'Принят на складе Китая',
              timestamp: '2026-06-14T11:34:29+05:00',
              rawTimestamp: '2026-06-14 11:34:29',
              active: true,
            },
            {
              label: 'Отправлен со склада Китая',
              timestamp: '2026-06-15T12:00:13+05:00',
              rawTimestamp: '2026-06-15 12:00:13',
              active: true,
            },
            {
              label: 'В пути',
              timestamp: '2026-06-15T12:01:06+05:00',
              rawTimestamp: '2026-06-15 12:01:06',
              active: true,
            },
            {
              label: 'Прибыл в Алмату',
              timestamp: null,
              rawTimestamp: null,
              active: false,
            },
            {
              label: 'Прибыл в город Караганда',
              timestamp: null,
              rawTimestamp: null,
              active: false,
            },
          ],
        },
      ]);
    });

    it('returns the last row as currentStatus when all rows are active', async () => {
      nockListCards({
        page: 1,
        packages: [
          {
            id: 176110,
            trackCode: 'ALLGREEN123',
            name: 'All Green Package',
            currentStatus: {
              label: 'Прибыл в город Караганда',
              timestamp: '2026-06-17T09:00:00+05:00',
              rawTimestamp: '2026-06-17 09:00:00',
              active: true,
            },
            statuses: [
              {
                label: 'Принят на складе Китая',
                timestamp: '2026-06-14T11:34:29+05:00',
                rawTimestamp: '2026-06-14 11:34:29',
                active: true,
              },
              {
                label: 'Отправлен со склада Китая',
                timestamp: '2026-06-15T12:00:13+05:00',
                rawTimestamp: '2026-06-15 12:00:13',
                active: true,
              },
              {
                label: 'В пути',
                timestamp: '2026-06-15T12:01:06+05:00',
                rawTimestamp: '2026-06-15 12:01:06',
                active: true,
              },
              {
                label: 'Прибыл в Алмату',
                timestamp: '2026-06-16T18:00:00+05:00',
                rawTimestamp: '2026-06-16 18:00:00',
                active: true,
              },
              {
                label: 'Прибыл в город Караганда',
                timestamp: '2026-06-17T09:00:00+05:00',
                rawTimestamp: '2026-06-17 09:00:00',
                active: true,
              },
            ],
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/packages?page=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].currentStatus).toEqual({
        label: 'Прибыл в город Караганда',
        timestamp: '2026-06-17T09:00:00+05:00',
        rawTimestamp: '2026-06-17 09:00:00',
        active: true,
      });
    });

    it('returns currentStatus null when no rows are active', async () => {
      nockListCards({
        page: 1,
        packages: [
          {
            id: 176111,
            trackCode: 'ALLGRAY123',
            name: 'All Gray Package',
            currentStatus: null,
            statuses: [
              {
                label: 'Прибыл в Алмату',
                timestamp: null,
                rawTimestamp: null,
                active: false,
              },
              {
                label: 'Прибыл в город Караганда',
                timestamp: null,
                rawTimestamp: null,
                active: false,
              },
            ],
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/packages?page=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].currentStatus).toBeNull();
      expect(response.body[0].statuses).toEqual([
        {
          label: 'Прибыл в Алмату',
          timestamp: null,
          rawTimestamp: null,
          active: false,
        },
        {
          label: 'Прибыл в город Караганда',
          timestamp: null,
          rawTimestamp: null,
          active: false,
        },
      ]);
    });

    it('returns empty list for page 2 when there are no more packages', async () => {
      nockListEmpty({ page: 2 });

      const response = await request(app.getHttpServer())
        .get('/api/packages?page=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns 400 for non-numeric page', async () => {
      await request(app.getHttpServer())
        .get('/api/packages?page=abc')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 400 for page less than 1', async () => {
      await request(app.getHttpServer())
        .get('/api/packages?page=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('GET /api/packages/:id', () => {
    it('returns 200 when package is found', async () => {
      nockList({
        page: 1,
        packages: [
          {
            id: 10,
            trackCode: 'TRACK11111',
            name: 'Found Package',
            currentStatus: null,
            statuses: [],
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/packages/10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        id: 10,
        trackCode: 'TRACK11111',
        name: 'Found Package',
        currentStatus: null,
        statuses: [],
      });
    });

    it('returns 404 when package is not found', async () => {
      for (let page = 1; page <= 5; page++) {
        nockListEmpty({ page });
      }

      await request(app.getHttpServer())
        .get('/api/packages/999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 400 for non-numeric id', async () => {
      await request(app.getHttpServer())
        .get('/api/packages/abc')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('POST /api/packages', () => {
    it('returns 201 and the created package', async () => {
      nockAdd({
        userId,
        trackCode: 'NEWTRACK1',
        name: 'New Package',
      });
      nockListWithPackage({
        page: 1,
        package: {
          id: 42,
          trackCode: 'NEWTRACK1',
          name: 'New Package',
          currentStatus: null,
          statuses: [],
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/packages')
        .set('Authorization', `Bearer ${token}`)
        .send({ trackCode: 'NEWTRACK1', name: 'New Package' })
        .expect(201);

      expect(response.body).toEqual({
        id: 42,
        trackCode: 'NEWTRACK1',
        name: 'New Package',
        currentStatus: null,
        statuses: [],
      });
    });

    it('returns 400 for empty body', async () => {
      await request(app.getHttpServer())
        .post('/api/packages')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('returns 400 for extra field', async () => {
      await request(app.getHttpServer())
        .post('/api/packages')
        .set('Authorization', `Bearer ${token}`)
        .send({ trackCode: 'NEWTRACK1', name: 'New Package', extra: 'field' })
        .expect(400);
    });
  });

  describe('DELETE /api/packages/:id', () => {
    it('returns 204 on successful delete', async () => {
      nockDelete({ itemId: 5 });

      await request(app.getHttpServer())
        .delete('/api/packages/5')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });

  describe('PATCH /api/packages/:id', () => {
    it('returns 200 with a new id after delete and create', async () => {
      nockList({
        page: 1,
        packages: [
          {
            id: 7,
            trackCode: 'OLDTRACK',
            name: 'Old Package',
            currentStatus: null,
            statuses: [],
          },
        ],
      });
      nockDelete({ itemId: 7 });
      nockAdd({
        userId,
        trackCode: 'NEWTRACK2',
        name: 'Updated Package',
      });
      nockListWithPackage({
        page: 1,
        package: {
          id: 8,
          trackCode: 'NEWTRACK2',
          name: 'Updated Package',
          currentStatus: null,
          statuses: [],
        },
      });

      const response = await request(app.getHttpServer())
        .patch('/api/packages/7')
        .set('Authorization', `Bearer ${token}`)
        .send({ trackCode: 'NEWTRACK2', name: 'Updated Package' })
        .expect(200);

      expect(response.body).toEqual({
        id: 8,
        trackCode: 'NEWTRACK2',
        name: 'Updated Package',
        currentStatus: null,
        statuses: [],
      });
    });

    it('returns 502 when create fails after delete', async () => {
      nockList({
        page: 1,
        packages: [
          {
            id: 9,
            trackCode: 'OLDTRACK2',
            name: 'Old Package',
            currentStatus: null,
            statuses: [],
          },
        ],
      });
      nockDelete({ itemId: 9 });
      nockAdd({
        userId,
        trackCode: 'NEWTRACK3',
        name: 'Updated Package',
        response: 'Server Error',
        status: 500,
      });

      await request(app.getHttpServer())
        .patch('/api/packages/9')
        .set('Authorization', `Bearer ${token}`)
        .send({ trackCode: 'NEWTRACK3', name: 'Updated Package' })
        .expect(502);
    });
  });

  it('returns 401 for all routes without a token', async () => {
    await request(app.getHttpServer()).get('/api/packages').expect(401);
    await request(app.getHttpServer()).get('/api/packages/1').expect(401);
    await request(app.getHttpServer())
      .post('/api/packages')
      .send({ trackCode: 'X', name: 'Y' })
      .expect(401);
    await request(app.getHttpServer()).delete('/api/packages/1').expect(401);
    await request(app.getHttpServer())
      .patch('/api/packages/1')
      .send({ trackCode: 'X', name: 'Y' })
      .expect(401);
  });
});
