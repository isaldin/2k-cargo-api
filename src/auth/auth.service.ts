import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SiteClientService } from '../site-client/site-client.service';
import { SessionService } from '../session/session.service';
import { EncryptionService } from '../common/encryption.service';
import { normalizePhone } from '../common/phone-normalization.util';
import { AppConfig } from '../config/app.config';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly siteClientService: SiteClientService,
    private readonly sessionService: SessionService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async login(phone: string, password: string): Promise<{ token: string }> {
    const appConfig = this.configService.getOrThrow<AppConfig>('app');
    const normalizedPhone = normalizePhone(phone);

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

    return { token };
  }

  async logout(token: string): Promise<void> {
    const session = await this.sessionService.findByToken(token);
    if (session?.siteCookies) {
      try {
        await this.siteClientService.logout(session.siteCookies);
      } catch {
        // Ignore upstream logout failures; local session is still removed.
      }
    }
    await this.sessionService.delete(token);
  }
}
