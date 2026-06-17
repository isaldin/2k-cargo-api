import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../config/app.config';
import { ApiSession } from './session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(ApiSession)
    private readonly sessionRepository: Repository<ApiSession>,
    private readonly configService: ConfigService,
  ) {}

  async create(
    session: Omit<ApiSession, 'createdAt' | 'lastUsedAt'>,
  ): Promise<ApiSession> {
    const entity = this.sessionRepository.create(session);
    return this.sessionRepository.save(entity);
  }

  async findByToken(token: string): Promise<ApiSession | null> {
    const session = await this.sessionRepository.findOne({ where: { token } });
    if (!session) {
      return null;
    }

    const appConfig = this.configService.get<AppConfig>('app');
    if (appConfig?.sessionTtlSeconds !== undefined) {
      const idleSeconds = (Date.now() - session.lastUsedAt.getTime()) / 1000;
      if (idleSeconds > appConfig.sessionTtlSeconds) {
        await this.sessionRepository.delete({ token });
        return null;
      }
    }

    session.lastUsedAt = new Date();
    await this.sessionRepository.save(session);
    return session;
  }

  async updateCookies(token: string, siteCookies: string): Promise<void> {
    await this.sessionRepository.update(
      { token },
      { siteCookies, lastUsedAt: new Date() },
    );
  }

  async updateUserId(token: string, userId: number): Promise<void> {
    await this.sessionRepository.update({ token }, { userId });
  }

  async delete(token: string): Promise<void> {
    await this.sessionRepository.delete({ token });
  }
}
