import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { runWithRequestContext } from './request-context';

const REQUEST_ID_HEADER = 'x-request-id';
const MAX_REQUEST_ID_LENGTH = 64;
const VALID_REQUEST_ID = /^[a-zA-Z0-9_!#$%&'*+./:=^`{|}~-]+$/;

export function isValidRequestId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH &&
    VALID_REQUEST_ID.test(value)
  );
}

function extractRequestId(request: Request): string {
  const headerValue = request.get(REQUEST_ID_HEADER);
  if (headerValue && isValidRequestId(headerValue)) {
    return headerValue;
  }
  return randomUUID();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = extractRequestId(request);
    response.setHeader(REQUEST_ID_HEADER, requestId);
    void runWithRequestContext({ requestId }, async () => next());
  }
}
