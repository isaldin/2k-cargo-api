import { createHash } from 'crypto';

const SENSITIVE_KEYS = new Set([
  'password',
  'p',
  'n',
  'smoke_password',
  'authorization',
  'cookie',
  'cookies',
  'set-cookie',
  'setcookie',
  'set_cookie',
  'phpsessid',
  'cuid',
  'cups',
  'passwordencrypted',
  'password_encrypted',
  'app_master_key',
  'appmasterkey',
  'smokepassword',
]);

export function hashForLog(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12)}`;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  return SENSITIVE_KEYS.has(normalized);
}

export function redactValue(key: string, value: unknown): unknown {
  if (isSensitiveKey(key)) {
    if (value === undefined || value === null || value === '') {
      return value;
    }
    return '[REDACTED]';
  }
  return value;
}

export function redactObject<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = redactValue(key, value);
  }
  return result;
}

export function redactHeaders(
  headers: Record<string, unknown>,
): Record<string, unknown> {
  return redactObject(headers);
}

function maskLongDigits(text: string): string {
  return text.replace(/\d{5,}/g, (match) => `${match.slice(0, 4)}***`);
}

export function sanitizeTextSnippet(html: string, maxLength = 120): string {
  const normalized = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const snippet = normalized.slice(0, maxLength).trim();
  return maskLongDigits(snippet);
}

export function redactSerializedCookieJar(value: string): string {
  if (!value) {
    return value;
  }
  return '[REDACTED_COOKIE_JAR]';
}

export function redactUrlEncodedBody(body: string): string {
  if (typeof body !== 'string') {
    return String(body);
  }

  try {
    const params = new URLSearchParams(body);
    const result = new URLSearchParams();
    for (const [key, value] of params) {
      result.append(key, isSensitiveKey(key) ? '[REDACTED]' : value);
    }
    return result.toString();
  } catch {
    return '[REDACTED_BODY]';
  }
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[UNSERIALIZABLE]';
  }
}
