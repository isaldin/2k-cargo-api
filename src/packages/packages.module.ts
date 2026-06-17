import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../session/session.module';
import { SiteClientModule } from '../site-client/site-client.module';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';

@Module({
  imports: [AuthModule, SessionModule, ConfigModule, SiteClientModule],
  providers: [PackagesService],
  controllers: [PackagesController],
})
export class PackagesModule {}
