import {
  Injectable,
  LoggerService,
  LogLevel as NestLogLevel,
} from '@nestjs/common';
import { getRequestId } from './request-context';
import { LogConfig, LogLevel, logLevelPriority } from './log.config';

export interface LogEntry {
  level: LogLevel;
  time: string;
  event: string;
  requestId?: string;
  message?: string;
  [key: string]: unknown;
}

@Injectable()
export class AppLogger implements LoggerService {
  private config: LogConfig = {
    level: 'info',
    format: 'json',
    stacks: false,
  };

  configure(config: LogConfig): void {
    this.config = config;
  }

  private shouldLog(level: LogLevel): boolean {
    return logLevelPriority(level) >= logLevelPriority(this.config.level);
  }

  write(
    level: LogLevel,
    event: string,
    fields?: Record<string, unknown>,
  ): void {
    this.writeInternal(level, event, fields);
  }

  private writeInternal(
    level: LogLevel,
    event: string,
    fields?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      time: new Date().toISOString(),
      event,
      requestId: getRequestId(),
      ...fields,
    };

    if (this.config.format === 'pretty') {
      this.writePretty(entry);
    } else {
      this.writeJson(entry);
    }
  }

  private writeJson(entry: LogEntry): void {
    const line = JSON.stringify(entry);
    if (entry.level === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }

  private writePretty(entry: LogEntry): void {
    const { level, time, event, requestId, message, ...rest } = entry;
    const parts = [time, `[${level.toUpperCase()}]`, event];
    if (requestId) {
      parts.push(`requestId=${requestId}`);
    }
    if (message) {
      parts.push(message);
    }
    const extra = Object.entries(rest)
      .map(([key, value]) => `${key}=${safeStringify(value)}`)
      .join(' ');
    if (extra) {
      parts.push(extra);
    }
    const line = parts.join(' ');
    if (entry.level === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }

  log(message: string, context?: string): void {
    this.writeInternal('info', 'application.log', { message, context });
  }

  error(message: string, trace?: string, context?: string): void {
    const fields: Record<string, unknown> = { message, context };
    if (trace && this.config.stacks) {
      fields.stack = trace;
    }
    this.writeInternal('error', 'application.error', fields);
  }

  warn(message: string, context?: string): void {
    this.writeInternal('warn', 'application.warn', { message, context });
  }

  debug(message: string, context?: string): void {
    this.writeInternal('debug', 'application.debug', { message, context });
  }

  verbose(message: string, context?: string): void {
    this.writeInternal('debug', 'application.verbose', { message, context });
  }

  debugEvent(event: string, fields?: Record<string, unknown>): void {
    this.writeInternal('debug', event, fields);
  }

  info(event: string, fields?: Record<string, unknown>): void {
    this.writeInternal('info', event, fields);
  }

  warnEvent(event: string, fields?: Record<string, unknown>): void {
    this.writeInternal('warn', event, fields);
  }

  errorEvent(event: string, fields?: Record<string, unknown>): void {
    this.writeInternal('error', event, fields);
  }

  fatal(message: string, trace?: string): void {
    const fields: Record<string, unknown> = { message };
    if (trace && this.config.stacks) {
      fields.stack = trace;
    }
    this.writeInternal('error', 'application.fatal', fields);
  }

  setLogLevels(levels: NestLogLevel[]): void {
    if (levels.length === 0) {
      return;
    }

    const lowest = levels.map(mapNestLogLevel).reduce((acc, candidate) => {
      return logLevelPriority(candidate) < logLevelPriority(acc)
        ? candidate
        : acc;
    }, 'error' as LogLevel);
    this.config = { ...this.config, level: lowest };
  }
}

function mapNestLogLevel(level: NestLogLevel): LogLevel {
  switch (level) {
    case 'verbose':
    case 'debug':
      return 'debug';
    case 'log':
      return 'info';
    case 'warn':
      return 'warn';
    case 'error':
    case 'fatal':
      return 'error';
  }
}

function safeStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[UNSERIALIZABLE]';
  }
}
