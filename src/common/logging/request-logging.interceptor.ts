import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AppLogger } from './app-logger.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(request, response, start);
        },
        error: (error: unknown) => {
          const status = this.inferStatus(error, response);
          this.logRequest(request, response, start, error, status);
        },
      }),
    );
  }

  private logRequest(
    request: Request,
    response: Response,
    start: number,
    error?: unknown,
    statusOverride?: number,
  ): void {
    const durationMs = Date.now() - start;
    const statusCode = statusOverride ?? response.statusCode;
    const path = request.originalUrl ?? request.url;
    const method = request.method;
    const requestId = response.getHeader('x-request-id') as string | undefined;

    const fields: Record<string, unknown> = {
      method,
      path,
      statusCode,
      durationMs,
    };
    if (requestId) {
      fields.requestId = requestId;
    }

    if (error) {
      const err = error as Error;
      fields.errorName = err.name ?? 'Error';
      fields.errorMessage = err.message ?? 'Unknown error';
    }

    const level = this.selectLevel(statusCode);
    this.logger.write(level, 'http.request.completed', fields);
  }

  private inferStatus(error: unknown, response: Response): number {
    const err = error as { status?: number; getStatus?: () => number };
    if (typeof err?.getStatus === 'function') {
      return err.getStatus();
    }
    if (typeof err?.status === 'number') {
      return err.status;
    }
    if (response.statusCode >= 400) {
      return response.statusCode;
    }
    return 500;
  }

  private selectLevel(statusCode: number): 'error' | 'warn' | 'info' {
    if (statusCode >= 500) {
      return 'error';
    }
    if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
      return 'warn';
    }
    return 'info';
  }
}
