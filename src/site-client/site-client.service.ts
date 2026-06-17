import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import { AnyNode } from 'domhandler';
import { Cookie, CookieJar } from 'tough-cookie';
import { ApiSession } from '../session/session.entity';
import { EncryptionService } from '../common/encryption.service';
import { SessionService } from '../session/session.service';
import { AppLogger } from '../common/logging/app-logger.service';
import {
  hashForLog,
  sanitizeTextSnippet,
} from '../common/logging/redaction.util';
import { AppConfig } from '../config/app.config';
import { Package, PackageStatus } from './package.types';
import { SessionExpiredError } from './site-client.errors';

interface CookieSession {
  token: string;
  phone: string;
  passwordEncrypted: Buffer;
  siteCookies: string;
  userId: number;
}

@Injectable()
export class SiteClientService {
  private readonly client: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly sessionService: SessionService,
    private readonly logger: AppLogger,
  ) {
    const appConfig = this.configService.getOrThrow<AppConfig>('app');
    this.client = wrapper(
      axios.create({
        baseURL: appConfig.siteBaseUrl,
        timeout: 30000,
        maxRedirects: 0,
        validateStatus: () => true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }),
    );

    this.client.interceptors.response.use((response) => {
      const jar = (response.config as { jar?: CookieJar }).jar;
      const setCookie = response.headers['set-cookie'];
      if (jar && setCookie) {
        const url = response.config.url?.startsWith('http')
          ? response.config.url
          : `${response.config.baseURL ?? ''}${response.config.url ?? ''}`;
        for (const cookie of setCookie) {
          try {
            jar.setCookieSync(cookie, url);
          } catch {
            // Ignore invalid cookies.
          }
        }
      }
      return response;
    });
  }

  private get appConfig(): AppConfig {
    return this.configService.getOrThrow<AppConfig>('app');
  }

  private buildJar(cookies: string): CookieJar {
    if (!cookies) {
      return new CookieJar();
    }
    try {
      return CookieJar.fromJSON(JSON.parse(cookies));
    } catch {
      return new CookieJar();
    }
  }

  private async serializeJar(jar: CookieJar): Promise<string> {
    const serialized = await jar.serialize();
    return JSON.stringify(serialized);
  }

  private async logUpstreamCall<T>(
    endpoint: string,
    path: string,
    operation: () => Promise<{ status: number; result: T }>,
    options: { retryAttempt?: number; sessionExpiredDetected?: boolean } = {},
  ): Promise<T> {
    const start = Date.now();
    let upstreamStatus: number | undefined;

    try {
      const { status, result } = await operation();
      upstreamStatus = status;
      return result;
    } catch (error) {
      upstreamStatus =
        (error as { response?: { status?: number } }).response?.status ??
        upstreamStatus;
      throw error;
    } finally {
      const durationMs = Date.now() - start;
      this.logger.info('upstream.' + endpoint + '.completed', {
        upstreamEndpoint: endpoint,
        upstreamPath: path,
        upstreamStatus,
        durationMs,
        retryAttempt: options.retryAttempt ?? 0,
        sessionExpiredDetected: options.sessionExpiredDetected ?? false,
      });
    }
  }

  private checkSessionExpired(response: AxiosResponse): void {
    if (response.status === 302) {
      const location = String(response.headers.location || '');
      if (location.includes('login.php')) {
        this.logger.warnEvent('upstream.session_expired.detected', {
          upstreamEndpoint: 'session_check',
          upstreamStatus: response.status,
        });
        throw new SessionExpiredError();
      }
      return;
    }

    const contentType = String(response.headers['content-type'] || '');
    if (contentType.includes('text/html')) {
      const $ = cheerio.load(String(response.data));
      const loginForm = $('form[action*="login.php"]').first();
      if (loginForm.length > 0) {
        this.logger.warnEvent('upstream.session_expired.detected', {
          upstreamEndpoint: 'session_check',
          upstreamStatus: response.status,
        });
        throw new SessionExpiredError();
      }
    }
  }

  private parseNumericCookie(cookies: Cookie[], key: string): number | null {
    const cookie = cookies.find((item) => item.key === key);
    const value = cookie?.value.trim() ?? '';
    if (!/^\d+$/.test(value)) {
      return null;
    }

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  private parseUserIdFromHtml(html: string): number | null {
    const $ = cheerio.load(html);

    const inputValue = $('[name="user_id"]').first().attr('value')?.trim();
    if (inputValue && /^\d+$/.test(inputValue)) {
      return Number(inputValue);
    }

    const dataValue = $('[data-user-id]').first().attr('data-user-id')?.trim();
    if (dataValue && /^\d+$/.test(dataValue)) {
      return Number(dataValue);
    }

    const scriptMatch = /(?:user_id|userId)\s*[:=]\s*['"]?(\d+)['"]?/i.exec(
      html,
    );
    if (scriptMatch) {
      return Number(scriptMatch[1]);
    }

    return null;
  }

  private async resolveUserId(jar: CookieJar): Promise<number> {
    const jarCookies = await jar.getCookies(this.appConfig.siteBaseUrl);
    const cookieUserId = this.parseNumericCookie(jarCookies, 'cuid');
    if (cookieUserId !== null) {
      this.logger.info('site_parser.user_id.resolved', {
        userIdSource: 'cuid',
      });
      return cookieUserId;
    }

    const response = await this.logUpstreamCall(
      'list',
      '/view_verified_codes.php',
      async () => {
        const res = await this.client.get('/view_verified_codes.php', {
          params: { page: 1 },
          jar,
        } as never);
        return { status: res.status, result: res };
      },
    );

    this.checkSessionExpired(response);

    if (response.status >= 400) {
      throw new BadGatewayException(
        `Upstream user id lookup failed with status ${response.status}`,
      );
    }

    const html = String(response.data);
    const htmlUserId = this.parseUserIdFromHtml(html);
    if (htmlUserId !== null) {
      const source = this.resolveUserIdSource(html);
      this.logger.info('site_parser.user_id.resolved', {
        userIdSource: source,
      });
      return htmlUserId;
    }

    this.logger.warnEvent('site_parser.user_id.failed', {
      upstreamStatus: response.status,
      contentType: String(response.headers['content-type'] || ''),
      snippet: sanitizeTextSnippet(html),
    });

    throw new BadGatewayException(
      'Upstream login succeeded but user id could not be resolved',
    );
  }

  private resolveUserIdSource(
    html: string,
  ): 'html_input' | 'html_data_attr' | 'script' {
    const $ = cheerio.load(html);
    const inputValue = $('[name="user_id"]').first().attr('value')?.trim();
    if (inputValue && /^\d+$/.test(inputValue)) {
      return 'html_input';
    }

    const dataValue = $('[data-user-id]').first().attr('data-user-id')?.trim();
    if (dataValue && /^\d+$/.test(dataValue)) {
      return 'html_data_attr';
    }

    return 'script';
  }

  async login(
    phone: string,
    password: string,
  ): Promise<{ userId: number; cookies: string }> {
    const jar = new CookieJar();
    const response = await this.logUpstreamCall(
      'login',
      '/login.php',
      async () => {
        const res = await this.client.post(
          '/login.php',
          new URLSearchParams({ n: phone, p: password, mem: '1' }),
          {
            jar,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          } as never,
        );
        return { status: res.status, result: res };
      },
    );

    if (response.status !== 302) {
      throw new UnauthorizedException('Invalid upstream credentials');
    }

    const location = String(response.headers.location || '');
    if (location.includes('login.php')) {
      throw new UnauthorizedException('Invalid upstream credentials');
    }

    const userId = await this.resolveUserId(jar);
    const cookies = await this.serializeJar(jar);

    return { userId, cookies };
  }

  async logout(cookies: string): Promise<void> {
    const jar = this.buildJar(cookies);
    await this.logUpstreamCall('logout', '/exit.php', async () => {
      const res = await this.client.get('/exit.php', { jar } as never);
      return { status: res.status, result: undefined };
    });
  }

  async listPackages(session: ApiSession, page = 1): Promise<Package[]> {
    return this.withRelogin(session, async (currentSession) => {
      const jar = this.buildJar(currentSession.siteCookies);
      const response = await this.logUpstreamCall(
        'list',
        '/view_verified_codes.php',
        async () => {
          const res = await this.client.get('/view_verified_codes.php', {
            params: { page },
            jar,
          } as never);
          return { status: res.status, result: res };
        },
      );

      this.checkSessionExpired(response);

      if (response.status >= 400) {
        throw new BadGatewayException(
          `Upstream list failed with status ${response.status}`,
        );
      }

      const html = String(response.data);
      try {
        const packages = this.parsePackages(html);
        currentSession.siteCookies = await this.serializeJar(jar);

        const statusRowsCount = packages.reduce(
          (sum, pkg) => sum + pkg.statuses.length,
          0,
        );
        const activeStatusCount = packages.reduce(
          (sum, pkg) => sum + pkg.statuses.filter((s) => s.active).length,
          0,
        );
        const inactiveStatusCount = statusRowsCount - activeStatusCount;

        this.logger.info('site_parser.packages.parsed', {
          packageCount: packages.length,
          statusRowsCount,
          activeStatusCount,
          inactiveStatusCount,
          page,
        });

        return packages;
      } catch (error) {
        this.logger.warnEvent('site_parser.packages.failed', {
          upstreamStatus: response.status,
          contentType: String(response.headers['content-type'] || ''),
          snippet: sanitizeTextSnippet(html),
          errorName: (error as Error).name,
          errorMessage: (error as Error).message,
        });
        throw error;
      }
    });
  }

  async addPackage(
    session: ApiSession,
    userId: number,
    trackCode: string,
    name: string,
  ): Promise<void> {
    return this.withRelogin(session, async (currentSession) => {
      const jar = this.buildJar(currentSession.siteCookies);
      const response = await this.logUpstreamCall(
        'add',
        '/process_verification.php',
        async () => {
          const res = await this.client.post(
            '/process_verification.php',
            new URLSearchParams({
              user_id: String(userId),
              track_code: trackCode,
              names: name,
            }),
            {
              jar,
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            } as never,
          );
          return { status: res.status, result: res };
        },
      );

      this.checkSessionExpired(response);

      const text = String(response.data);
      if (/уже существует|already exists|duplicate|_exists_/i.test(text)) {
        throw new ConflictException('Track code already exists upstream');
      }

      if (response.status >= 400) {
        throw new BadGatewayException(
          `Upstream add failed with status ${response.status}`,
        );
      }

      currentSession.siteCookies = await this.serializeJar(jar);
    });
  }

  async deletePackage(session: ApiSession, itemId: number): Promise<void> {
    return this.withRelogin(session, async (currentSession) => {
      const jar = this.buildJar(currentSession.siteCookies);
      const response = await this.logUpstreamCall(
        'delete',
        '/view_verified_codes.php',
        async () => {
          const res = await this.client.post(
            '/view_verified_codes.php',
            new URLSearchParams({ delete_item: String(itemId) }),
            {
              jar,
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            } as never,
          );
          return { status: res.status, result: res };
        },
      );

      this.checkSessionExpired(response);

      if (response.status >= 400) {
        throw new BadGatewayException(
          `Upstream delete failed with status ${response.status}`,
        );
      }

      currentSession.siteCookies = await this.serializeJar(jar);
    });
  }

  private async withRelogin<T>(
    session: ApiSession,
    operation: (session: CookieSession) => Promise<T>,
  ): Promise<T> {
    let attempts = 0;
    let currentSession: CookieSession = { ...session };
    const sessionTokenHash = hashForLog(session.token);

    while (true) {
      try {
        const result = await operation(currentSession);
        session.siteCookies = currentSession.siteCookies;
        session.userId = currentSession.userId;
        return result;
      } catch (error) {
        if (!(error instanceof SessionExpiredError)) {
          throw error;
        }

        this.logger.warnEvent('upstream.relogin.started', {
          sessionTokenHash,
          retryAttempt: attempts + 1,
        });

        if (attempts >= this.appConfig.autoReloginRetryLimit) {
          this.logger.errorEvent('upstream.relogin.failed', {
            sessionTokenHash,
            reason: 'Retry limit exhausted',
          });
          throw new UnauthorizedException(
            'Upstream session could not be restored',
          );
        }

        attempts++;
        const password = this.encryptionService.decrypt(
          currentSession.passwordEncrypted,
          this.appConfig.masterKey,
        );

        try {
          const { userId, cookies } = await this.login(
            currentSession.phone,
            password,
          );

          await this.sessionService.updateCookies(
            currentSession.token,
            cookies,
          );
          currentSession = { ...currentSession, siteCookies: cookies, userId };
          this.logger.info('upstream.relogin.success', {
            sessionTokenHash,
            retryAttempt: attempts,
          });
        } catch (reloginError) {
          const reason = (reloginError as Error).message ?? 'Unknown error';
          this.logger.errorEvent('upstream.relogin.failed', {
            sessionTokenHash,
            reason,
          });
          throw reloginError;
        }
      }
    }
  }
  private parsePackages(html: string): Package[] {
    const $ = cheerio.load(html);
    const packages: Package[] = [];

    const deleteControls = $(
      '[href*="delete_item="], [action*="delete_item="], button[name="delete_item"], input[name="delete_item"]',
    );

    deleteControls.each((_, element) => {
      const el = $(element);
      const hrefOrAction = el.attr('href') || el.attr('action') || '';
      const value = el.attr('value') || '';
      const idValue = /delete_item=(\d+)/.exec(hrefOrAction)?.[1] || value;
      if (!/^\d+$/.test(idValue)) {
        return;
      }

      const id = Number(idValue);
      const container =
        el.closest('tr').length > 0
          ? el.closest('tr')
          : el.closest('.card, .card-body, div, li, article, .item, .package');

      const textLines = container
        .text()
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const trackCodeIndex = textLines.findIndex((line) =>
        /^(?:Трек-код:\s*)?[A-Z0-9-]{5,}$/i.test(line),
      );

      const trackCode =
        trackCodeIndex >= 0
          ? textLines[trackCodeIndex].replace(/^Трек-код:\s*/i, '').trim()
          : '';
      const name =
        textLines
          .find((line) => /^Наименование:\s*/i.test(line))
          ?.replace(/^Наименование:\s*/i, '')
          .trim() ||
        (trackCodeIndex >= 0 && trackCodeIndex + 1 < textLines.length
          ? textLines[trackCodeIndex + 1]
          : textLines.find(
              (line) => line !== String(id) && !/delete_item/i.test(line),
            )) ||
        '';

      const statuses = this.parseStatuses($, container);
      const currentStatus =
        statuses.filter((status) => status.active).pop() ?? null;

      if (trackCode) {
        packages.push({ id, trackCode, name, currentStatus, statuses });
      }
    });

    return packages;
  }

  private parseStatuses(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<AnyNode>,
  ): PackageStatus[] {
    const statusRows = container.find('.list-group-item, li');
    if (statusRows.length === 0) {
      return [];
    }

    const statuses: PackageStatus[] = [];
    statusRows.each((_, rowElement) => {
      const row = $(rowElement);
      const rawText = row.text().trim();
      if (!rawText) {
        return;
      }

      const active =
        row.hasClass('text-success') || row.find('.text-success').length > 0;
      const inactive =
        row.hasClass('text-secondary') ||
        row.hasClass('text-muted') ||
        row.find('.text-secondary, .text-muted').length > 0;
      const isActive = active || (!inactive && this.hasActiveIcon(row));

      const { label, rawTimestamp } = this.parseStatusText(rawText);
      if (this.isNonStatusPackageInfo(label)) {
        return;
      }

      statuses.push({
        label,
        rawTimestamp,
        timestamp: rawTimestamp ? this.parseTimestamp(rawTimestamp) : null,
        active: isActive,
      });
    });

    return statuses;
  }

  private isNonStatusPackageInfo(label: string): boolean {
    return /^Цена(?:\s|$)/i.test(label);
  }

  private hasActiveIcon(row: cheerio.Cheerio<AnyNode>): boolean {
    return (
      row.find('[class*="check"], [class*="success"], .glyphicon-ok, .fa-check')
        .length > 0
    );
  }

  private parseStatusText(rawText: string): {
    label: string;
    rawTimestamp: string | null;
  } {
    const match = /^(.*?)\s*\((\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\)\s*$/.exec(
      rawText,
    );
    if (match) {
      return { label: match[1].trim(), rawTimestamp: match[2] };
    }
    return { label: rawText, rawTimestamp: null };
  }

  private parseTimestamp(rawTimestamp: string): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(
      rawTimestamp,
    );
    if (!match) {
      return null;
    }

    const [, year, month, day, hour, minute, second] = match.map(Number);
    // Upstream displays timestamps in Asia/Almaty (UTC+05:00, no DST).
    const utcDate = new Date(
      Date.UTC(year, month - 1, day, hour - 5, minute, second),
    );
    return this.formatAlmatyIso(utcDate);
  }

  private formatAlmatyIso(utcDate: Date): string {
    const offsetHours = 5;
    const localDate = new Date(
      utcDate.getTime() + offsetHours * 60 * 60 * 1000,
    );
    const y = localDate.getUTCFullYear();
    const m = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(localDate.getUTCDate()).padStart(2, '0');
    const h = String(localDate.getUTCHours()).padStart(2, '0');
    const min = String(localDate.getUTCMinutes()).padStart(2, '0');
    const s = String(localDate.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}:${s}+0${offsetHours}:00`;
  }
}
