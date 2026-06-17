import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SiteClientService } from '../site-client/site-client.service';
import { SessionService } from '../session/session.service';
import { EncryptionService } from '../common/encryption.service';
import { normalizePhone } from '../common/phone-normalization.util';
import { AppLogger } from '../common/logging/app-logger.service';
import { hashForLog } from '../common/logging/redaction.util';
import { AppConfig } from '../config/app.config';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly siteClientService: SiteClientService,
    private readonly sessionService: SessionService,
    private readonly encryptionService: EncryptionService,
    private readonly logger: AppLogger,
  ) {}

  async login(phone: string, password: string): Promise<{ token: string }> {
    const start = Date.now();
    const appConfig = this.configService.getOrThrow<AppConfig>('app');
    const normalizedPhone = normalizePhone(phone);
    const phoneHash = hashForLog(normalizedPhone);

    this.logger.info('auth.login.started', { phoneHash });

    try {
      const { userId, cookies } = await this.siteClientService.login(
        normalizedPhone,
        password,
      );

      const passwordEncrypted = this.encryptionService.encrypt(
        password,
        appConfig.masterKey,
      );

      const token = randomUUID();
      await this.sessionService.create({
        token,
        phone: normalizedPhone,
        passwordEncrypted,
        siteCookies: cookies,
        userId,
      });

      const durationMs = Date.now() - start;
      this.logger.info('auth.login.success', {
        phoneHash,
        sessionTokenHash: hashForLog(token),
        durationMs,
      });

      return { token };
    } catch (error) {
      const durationMs = Date.now() - start;
      const reason = (error as Error).message ?? 'Unknown error';
      this.logger.warnEvent('auth.login.failed', {
        phoneHash,
        reason,
        durationMs,
      });
      throw error;
    }
  }

  async logout(token: string): Promise<void> {
    const sessionTokenHash = hashForLog(token);
    this.logger.info('auth.logout.started', { sessionTokenHash });

    const session = await this.sessionService.findByToken(token);
    if (session?.siteCookies) {
      try {
        await this.siteClientService.logout(session.siteCookies);
      } catch (error) {
        const reason = (error as Error).message ?? 'Unknown error';
        this.logger.warnEvent(
          'auth.logout.upstream_failed_local_session_removed',
          {
            sessionTokenHash,
            reason,
          },
        );
      }
    }

    await this.sessionService.delete(token);
    this.logger.info('auth.logout.success', { sessionTokenHash });
  }
}
