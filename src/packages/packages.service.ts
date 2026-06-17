import {
  Injectable,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiteClientService } from '../site-client/site-client.service';
import { ApiSession } from '../session/session.entity';
import { AppConfig } from '../config/app.config';
import { Package } from '../site-client/package.types';
import { AppLogger } from '../common/logging/app-logger.service';
import { hashForLog } from '../common/logging/redaction.util';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackagesService {
  constructor(
    private readonly siteClientService: SiteClientService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  async list(session: ApiSession, page = 1): Promise<Package[]> {
    const start = Date.now();
    const sessionTokenHash = hashForLog(session.token);
    this.logger.info('packages.list.started', { sessionTokenHash, page });

    const packages = await this.siteClientService.listPackages(session, page);

    const durationMs = Date.now() - start;
    const activeStatusCount = packages.reduce(
      (sum, pkg) => sum + pkg.statuses.filter((s) => s.active).length,
      0,
    );
    const inactiveStatusCount = packages.reduce(
      (sum, pkg) => sum + pkg.statuses.filter((s) => !s.active).length,
      0,
    );

    this.logger.info('packages.list.success', {
      sessionTokenHash,
      page,
      packageCount: packages.length,
      activeStatusCount,
      inactiveStatusCount,
      durationMs,
    });

    return packages;
  }

  async getById(session: ApiSession, id: number): Promise<Package> {
    const start = Date.now();
    const sessionTokenHash = hashForLog(session.token);
    this.logger.info('packages.get.started', {
      sessionTokenHash,
      packageId: id,
    });

    const limit =
      this.configService.getOrThrow<AppConfig>('app').packageScanPageLimit;

    for (let page = 1; page <= limit; page++) {
      const packages = await this.siteClientService.listPackages(session, page);
      const found = packages.find((pkg) => pkg.id === id);
      if (found) {
        const durationMs = Date.now() - start;
        this.logger.info('packages.get.success', {
          sessionTokenHash,
          packageId: id,
          currentStatusLabel: found.currentStatus?.label,
          durationMs,
        });
        return found;
      }
    }

    throw new NotFoundException(`Package with id ${id} not found`);
  }

  async create(session: ApiSession, dto: CreatePackageDto): Promise<Package> {
    const start = Date.now();
    const sessionTokenHash = hashForLog(session.token);
    const trackCodeHash = hashForLog(dto.trackCode);
    this.logger.info('packages.create.started', {
      sessionTokenHash,
      trackCodeHash,
    });

    await this.siteClientService.addPackage(
      session,
      session.userId,
      dto.trackCode,
      dto.name,
    );

    const created = await this.findPackageByTrackCode(session, dto.trackCode);
    const durationMs = Date.now() - start;
    this.logger.info('packages.create.success', {
      sessionTokenHash,
      trackCodeHash,
      packageId: created.id,
      durationMs,
    });

    return created;
  }

  async delete(session: ApiSession, id: number): Promise<void> {
    const start = Date.now();
    const sessionTokenHash = hashForLog(session.token);
    this.logger.info('packages.delete.started', {
      sessionTokenHash,
      packageId: id,
    });

    await this.siteClientService.deletePackage(session, id);

    const durationMs = Date.now() - start;
    this.logger.info('packages.delete.success', {
      sessionTokenHash,
      packageId: id,
      durationMs,
    });
  }

  async update(
    session: ApiSession,
    id: number,
    dto: UpdatePackageDto,
  ): Promise<Package> {
    const start = Date.now();
    const sessionTokenHash = hashForLog(session.token);
    const trackCode = dto.trackCode;
    const trackCodeHash = trackCode ? hashForLog(trackCode) : undefined;
    this.logger.info('packages.patch.started', {
      sessionTokenHash,
      packageId: id,
      trackCodeHash,
    });

    const existing = await this.getById(session, id);

    const resolvedTrackCode = trackCode ?? existing.trackCode;
    const resolvedTrackCodeHash = hashForLog(resolvedTrackCode);
    const name = dto.name ?? existing.name;

    await this.siteClientService.deletePackage(session, id);

    try {
      await this.siteClientService.addPackage(
        session,
        session.userId,
        resolvedTrackCode,
        name,
      );
    } catch (error) {
      const reason = (error as Error).message ?? 'Unknown error';
      this.logger.errorEvent('packages.patch.delete_success_create_failed', {
        sessionTokenHash,
        packageId: id,
        trackCodeHash: resolvedTrackCodeHash,
        reason,
      });
      throw new BadGatewayException(
        `Delete succeeded but create failed: ${(error as Error).message}`,
      );
    }

    const updated = await this.findPackageByTrackCode(
      session,
      resolvedTrackCode,
    );
    const durationMs = Date.now() - start;
    this.logger.info('packages.patch.success', {
      sessionTokenHash,
      packageId: updated.id,
      trackCodeHash: resolvedTrackCodeHash,
      durationMs,
    });

    return updated;
  }

  private async findPackageByTrackCode(
    session: ApiSession,
    trackCode: string,
  ): Promise<Package> {
    const limit =
      this.configService.getOrThrow<AppConfig>('app').packageScanPageLimit;

    for (let page = 1; page <= limit; page++) {
      const packages = await this.siteClientService.listPackages(session, page);
      const found = packages.find((pkg) => pkg.trackCode === trackCode);
      if (found) {
        return found;
      }
    }

    throw new NotFoundException('Created package could not be resolved');
  }
}
