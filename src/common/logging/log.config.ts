export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'json' | 'pretty';

export interface LogConfig {
  level: LogLevel;
  format: LogFormat;
  stacks: boolean;
}

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.includes(value as LogLevel);
}

export function isLogFormat(value: string): value is LogFormat {
  return value === 'json' || value === 'pretty';
}

export function logLevelPriority(level: LogLevel): number {
  return LOG_LEVELS.indexOf(level);
}

export function parseLogConfig(): LogConfig {
  const level = process.env.LOG_LEVEL ?? 'info';
  const format = process.env.LOG_FORMAT ?? 'json';
  const stacks = process.env.LOG_STACKS === 'true';

  return {
    level: isLogLevel(level) ? level : 'info',
    format: isLogFormat(format) ? format : 'json',
    stacks,
  };
}
