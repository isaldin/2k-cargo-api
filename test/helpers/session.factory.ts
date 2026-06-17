import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CookieJar } from 'tough-cookie';
import { ApiSession } from '../../src/session/session.entity';
import { EncryptionService } from '../../src/common/encryption.service';
import { AppConfig } from '../../src/config/app.config';

export async function createSession(
  app: INestApplication,
  overrides: Partial<ApiSession> & { password?: string } = {},
): Promise<{ token: string; session: ApiSession; password: string }> {
  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>('app');
  const encryptionService = app.get(EncryptionService);
  const repository = app.get<Repository<ApiSession>>(
    getRepositoryToken(ApiSession),
  );

  const password = overrides.password ?? 'test-password';
  const passwordEncrypted =
    overrides.passwordEncrypted ??
    encryptionService.encrypt(password, appConfig.masterKey);

  const siteCookies = overrides.siteCookies ?? '';
  const hasCookies = siteCookies.length > 0;

  const session = repository.create({
    token: overrides.token ?? randomUUID(),
    phone: overrides.phone ?? '77073006789',
    passwordEncrypted,
    siteCookies,
    userId: overrides.userId ?? 123,
  });

  if (!hasCookies) {
    const jar = new CookieJar();
    await jar.setCookie('PHPSESSID=fixture; path=/', appConfig.siteBaseUrl);
    session.siteCookies = JSON.stringify(await jar.serialize());
  }

  const saved = await repository.save(session);
  return { token: saved.token, session: saved, password };
}
