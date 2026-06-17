import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';
import { ApiSession } from '../session/session.entity';
import { Initial1749660000000 } from '../migrations/1749660000000-initial';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const appConfig = configService.getOrThrow<AppConfig>('app');
        return {
          type: 'sqlite',
          database: appConfig.databasePath,
          entities: [ApiSession],
          synchronize: appConfig.databaseSynchronize,
          migrations: [Initial1749660000000],
          migrationsRun: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
