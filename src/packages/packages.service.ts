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
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackagesService {
  constructor(
    private readonly siteClientService: SiteClientService,
    private readonly configService: ConfigService,
  ) {}

  async list(session: ApiSession, page = 1): Promise<Package[]> {
    return this.siteClientService.listPackages(session, page);
  }

  async getById(session: ApiSession, id: number): Promise<Package> {
    const limit =
      this.configService.getOrThrow<AppConfig>('app').packageScanPageLimit;

    for (let page = 1; page <= limit; page++) {
      const packages = await this.siteClientService.listPackages(session, page);
      const found = packages.find((pkg) => pkg.id === id);
      if (found) {
        return found;
      }
    }

    throw new NotFoundException(`Package with id ${id} not found`);
  }

  async create(session: ApiSession, dto: CreatePackageDto): Promise<Package> {
    await this.siteClientService.addPackage(
      session,
      session.userId,
      dto.trackCode,
      dto.name,
    );

    return this.findPackageByTrackCode(session, dto.trackCode);
  }

  async delete(session: ApiSession, id: number): Promise<void> {
    await this.siteClientService.deletePackage(session, id);
  }

  async update(
    session: ApiSession,
    id: number,
    dto: UpdatePackageDto,
  ): Promise<Package> {
    const existing = await this.getById(session, id);

    const trackCode = dto.trackCode ?? existing.trackCode;
    const name = dto.name ?? existing.name;

    await this.siteClientService.deletePackage(session, id);

    try {
      await this.siteClientService.addPackage(
        session,
        session.userId,
        trackCode,
        name,
      );
    } catch (error) {
      throw new BadGatewayException(
        `Delete succeeded but create failed: ${(error as Error).message}`,
      );
    }

    return this.findPackageByTrackCode(session, trackCode);
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

    throw new NotFoundException(
      `Created package with track code ${trackCode} could not be resolved`,
    );
  }
}
