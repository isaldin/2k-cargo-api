import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiSession } from './session.entity';
import { SessionService } from './session.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiSession])],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
