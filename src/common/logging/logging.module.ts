import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { AppLogger } from './app-logger.service';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { ExceptionLoggingFilter } from './exception-logging.filter';

@Global()
@Module({
  providers: [
    AppLogger,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ExceptionLoggingFilter,
    },
  ],
  exports: [AppLogger],
})
export class LoggingModule {}

export { AppLogger };
export { RequestIdMiddleware } from './request-id.middleware';
export { RequestLoggingInterceptor } from './request-logging.interceptor';
export { ExceptionLoggingFilter } from './exception-logging.filter';
export { getRequestId } from './request-context';
export {
  hashForLog,
  redactValue,
  redactHeaders,
  redactUrlEncodedBody,
} from './redaction.util';
