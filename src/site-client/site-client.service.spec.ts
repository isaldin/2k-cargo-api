import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import nock from 'nock';
import { CookieJar } from 'tough-cookie';
import { SiteClientService } from './site-client.service';
import { EncryptionService } from '../common/encryption.service';
import { SessionService } from '../session/session.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { AppConfig } from '../config/app.config';
import { ApiSession } from '../session/session.entity';

function buildSession(): ApiSession {
  return {
    token: 'test-token',
    phone: '77073006789',
    passwordEncrypted: Buffer.from('x'),
    siteCookies: '',
    userId: 123,
    createdAt: new Date(),
    lastUsedAt: new Date(),
  };
}

describe('SiteClientService parser summary', () => {
  let service: SiteClientService;
  let logger: AppLogger;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const appConfig: AppConfig = {
      port: 3000,
      masterKey: Buffer.from('0123456789abcdef0123456789abcdef', 'utf8'),
      siteBaseUrl: 'https://2k-cargo-krg.kz',
      databasePath: ':memory:',
      databaseSynchronize: false,
      packageScanPageLimit: 5,
      autoReloginRetryLimit: 1,
      logLevel: 'info',
      logFormat: 'json',
      logStacks: false,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteClientService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(appConfig),
          },
        },
        {
          provide: EncryptionService,
          useValue: {},
        },
        {
          provide: SessionService,
          useValue: {},
        },
        AppLogger,
      ],
    }).compile();

    service = module.get(SiteClientService);
    logger = module.get(AppLogger);
    logger.configure({ level: 'info', format: 'json', stacks: false });
    loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    nock.cleanAll();
    loggerSpy.mockRestore();
  });

  it('logs parser summary counts for mixed active and inactive statuses', async () => {
    const html = `
      <html><body>
        <div class="card">
          <div class="card-body">
            <form method="POST"><button name="delete_item" value="1">X</button></form>
            <h5 class="card-title">Трек-код: TRACK123</h5>
            <h6 class="card-subtitle">Наименование: Test Package</h6>
            <ul class="list-group list-group-flush">
              <li class="list-group-item text-success">Active One (2026-06-14 11:34:29)</li>
              <li class="list-group-item text-success">Active Two (2026-06-15 12:00:13)</li>
              <li class="list-group-item text-secondary">Inactive One</li>
              <li class="list-group-item text-secondary">Inactive Two</li>
            </ul>
          </div>
        </div>
      </body></html>
    `;

    nock('https://2k-cargo-krg.kz')
      .get('/view_verified_codes.php')
      .query({ page: 1 })
      .reply(200, html, { 'Content-Type': 'text/html' });

    const session = buildSession();
    const jar = new CookieJar();
    await jar.setCookie('PHPSESSID=fixture; path=/', 'https://2k-cargo-krg.kz');
    session.siteCookies = JSON.stringify(await jar.serialize());

    const packages = await service.listPackages(session, 1);

    expect(packages).toHaveLength(1);
    expect(packages[0].statuses).toHaveLength(4);

    const parsedCall = loggerSpy.mock.calls.find(
      (call) => (call[0] as string) === 'site_parser.packages.parsed',
    );
    expect(parsedCall).toBeDefined();
    expect(parsedCall![1]).toMatchObject({
      packageCount: 1,
      statusRowsCount: 4,
      activeStatusCount: 2,
      inactiveStatusCount: 2,
    });
  });
});
