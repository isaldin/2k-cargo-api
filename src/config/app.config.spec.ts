import appConfigFactory, { AppConfig } from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults databaseSynchronize to true when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_MASTER_KEY = '0123456789abcdef0123456789abcdef';

    const config = appConfigFactory() as AppConfig;

    expect(config.databaseSynchronize).toBe(true);
  });

  it('defaults databaseSynchronize to false when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_MASTER_KEY = '0123456789abcdef0123456789abcdef';

    const config = appConfigFactory() as AppConfig;

    expect(config.databaseSynchronize).toBe(false);
  });

  it('parses SESSION_TTL_SECONDS when provided', () => {
    process.env.APP_MASTER_KEY = '0123456789abcdef0123456789abcdef';
    process.env.SESSION_TTL_SECONDS = '3600';

    const config = appConfigFactory() as AppConfig;

    expect(config.sessionTtlSeconds).toBe(3600);
  });

  it('leaves sessionTtlSeconds undefined by default', () => {
    process.env.APP_MASTER_KEY = '0123456789abcdef0123456789abcdef';

    const config = appConfigFactory() as AppConfig;

    expect(config.sessionTtlSeconds).toBeUndefined();
  });
});
