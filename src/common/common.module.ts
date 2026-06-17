import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { LoggingModule } from './logging/logging.module';

@Module({
  imports: [LoggingModule],
  providers: [EncryptionService],
  exports: [EncryptionService, LoggingModule],
})
export class CommonModule {}
