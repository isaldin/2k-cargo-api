import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { AppLogger } from './app-logger.service';

@Catch()
@Injectable()
export class ExceptionLoggingFilter extends BaseExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const error =
      exception instanceof Error ? exception : new Error(String(exception));
    const isExpected = exception instanceof HttpException;

    if (!isExpected) {
      const requestId = response.getHeader('x-request-id') as
        | string
        | undefined;
      const fields: Record<string, unknown> = {
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode,
        errorName: error.name,
        errorMessage: error.message,
      };
      if (requestId) {
        fields.requestId = requestId;
      }
      this.logger.errorEvent('http.request.failed', fields);
    }

    super.catch(exception, host);
  }
}
