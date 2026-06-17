import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../common/common.module';
import { LoggingModule } from '../common/logging/logging.module';
import { SessionModule } from '../session/session.module';
import { SiteClientService } from './site-client.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    CommonModule,
    LoggingModule,
    SessionModule,
  ],
  providers: [SiteClientService],
  exports: [SiteClientService],
})
export class SiteClientModule {}
