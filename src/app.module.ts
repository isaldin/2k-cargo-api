import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { SessionModule } from './session/session.module';
import { SiteClientModule } from './site-client/site-client.module';
import { AuthModule } from './auth/auth.module';
import { PackagesModule } from './packages/packages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    DatabaseModule,
    CommonModule,
    SessionModule,
    SiteClientModule,
    AuthModule,
    PackagesModule,
  ],
})
export class AppModule {}
