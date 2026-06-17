import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  masterKey: Buffer;
  siteBaseUrl: string;
  databasePath: string;
  databaseSynchronize: boolean;
  packageScanPageLimit: number;
  autoReloginRetryLimit: number;
  sessionTtlSeconds?: number;
}

export default registerAs<AppConfig>('app', () => {
  const masterKeyRaw = process.env.APP_MASTER_KEY ?? '';
  const masterKey = Buffer.from(masterKeyRaw, 'utf8');

  if (masterKey.length !== 32) {
    throw new Error(
      `APP_MASTER_KEY must be exactly 32 bytes (got ${masterKey.length})`,
    );
  }

  const port = parseInt(process.env.APP_PORT ?? '3000', 10);
  if (Number.isNaN(port)) {
    throw new Error('APP_PORT must be a valid number');
  }

  const packageScanPageLimit = parseInt(
    process.env.PACKAGE_SCAN_PAGE_LIMIT ?? '10',
    10,
  );
  if (Number.isNaN(packageScanPageLimit) || packageScanPageLimit < 1) {
    throw new Error('PACKAGE_SCAN_PAGE_LIMIT must be a positive integer');
  }

  const autoReloginRetryLimit = parseInt(
    process.env.AUTO_RELOGIN_RETRY_LIMIT ?? '1',
    10,
  );
  if (Number.isNaN(autoReloginRetryLimit) || autoReloginRetryLimit < 0) {
    throw new Error('AUTO_RELOGIN_RETRY_LIMIT must be a non-negative integer');
  }

  const databaseSynchronize =
    process.env.DATABASE_SYNCHRONIZE !== undefined
      ? process.env.DATABASE_SYNCHRONIZE === 'true'
      : process.env.NODE_ENV !== 'production';

  let sessionTtlSeconds: number | undefined;
  if (process.env.SESSION_TTL_SECONDS !== undefined) {
    sessionTtlSeconds = parseInt(process.env.SESSION_TTL_SECONDS, 10);
    if (Number.isNaN(sessionTtlSeconds) || sessionTtlSeconds < 1) {
      throw new Error('SESSION_TTL_SECONDS must be a positive integer');
    }
  }

  return {
    port,
    masterKey,
    siteBaseUrl: process.env.SITE_BASE_URL ?? 'https://2k-cargo-krg.kz',
    databasePath: process.env.DATABASE_PATH ?? './data/sessions.sqlite',
    databaseSynchronize,
    packageScanPageLimit,
    autoReloginRetryLimit,
    sessionTtlSeconds,
  };
});
