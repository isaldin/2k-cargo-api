import {
  hashForLog,
  redactValue,
  redactHeaders,
  redactUrlEncodedBody,
  redactSerializedCookieJar,
  sanitizeTextSnippet,
} from './redaction.util';

describe('redaction.util', () => {
  describe('hashForLog', () => {
    it('returns a sha256 prefix with 12 hex characters', () => {
      const hash = hashForLog('test');
      expect(hash).toMatch(/^sha256:[a-f0-9]{12}$/);
    });

    it('produces deterministic output for the same input', () => {
      expect(hashForLog('same')).toBe(hashForLog('same'));
    });

    it('produces different output for different inputs', () => {
      expect(hashForLog('a')).not.toBe(hashForLog('b'));
    });
  });

  describe('redactValue', () => {
    it('redacts password values', () => {
      expect(redactValue('password', 'secret')).toBe('[REDACTED]');
    });

    it('redacts Authorization header values', () => {
      expect(redactValue('Authorization', 'Bearer abc')).toBe('[REDACTED]');
    });

    it('redacts cookie values', () => {
      expect(redactValue('Cookie', 'PHPSESSID=abc')).toBe('[REDACTED]');
    });

    it('redacts set-cookie values after key normalization', () => {
      expect(redactValue('Set-Cookie', 'PHPSESSID=abc')).toBe('[REDACTED]');
    });

    it('redacts SMOKE_PASSWORD values after key normalization', () => {
      expect(redactValue('SMOKE_PASSWORD', 'secret')).toBe('[REDACTED]');
    });

    it('redacts APP_MASTER_KEY', () => {
      expect(redactValue('APP_MASTER_KEY', 'secret-key')).toBe('[REDACTED]');
    });

    it('redacts passwordEncrypted', () => {
      expect(redactValue('passwordEncrypted', Buffer.from('x'))).toBe(
        '[REDACTED]',
      );
    });

    it('leaves non-sensitive values unchanged', () => {
      expect(redactValue('trackCode', 'ABC123')).toBe('ABC123');
    });

    it('preserves empty values', () => {
      expect(redactValue('password', '')).toBe('');
      expect(redactValue('password', null)).toBeNull();
      expect(redactValue('password', undefined)).toBeUndefined();
    });
  });

  describe('redactHeaders', () => {
    it('redacts sensitive headers and keeps others', () => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
        Cookie: 'PHPSESSID=abc',
        'X-Request-Id': 'req-1',
      };
      expect(redactHeaders(headers)).toEqual({
        'Content-Type': 'application/json',
        Authorization: '[REDACTED]',
        Cookie: '[REDACTED]',
        'X-Request-Id': 'req-1',
      });
    });
  });

  describe('redactUrlEncodedBody', () => {
    it('redacts password field in login body', () => {
      const body = 'n=77073006789&p=secret&mem=1';
      expect(redactUrlEncodedBody(body)).toBe(
        'n=%5BREDACTED%5D&p=%5BREDACTED%5D&mem=1',
      );
    });
  });

  describe('redactSerializedCookieJar', () => {
    it('redacts a non-empty cookie jar string', () => {
      expect(redactSerializedCookieJar('{"cookies":[]}')).toBe(
        '[REDACTED_COOKIE_JAR]',
      );
    });

    it('preserves empty cookie jar string', () => {
      expect(redactSerializedCookieJar('')).toBe('');
    });
  });

  describe('sanitizeTextSnippet', () => {
    it('truncates and masks long digit sequences', () => {
      const html = '<html><body>Phone 77073006789 code</body></html>';
      expect(sanitizeTextSnippet(html)).toContain('7707***');
    });

    it('strips html tags', () => {
      expect(sanitizeTextSnippet('<p>hello world</p>')).toBe('hello world');
    });

    it('limits snippet length', () => {
      const long = 'a'.repeat(200);
      expect(sanitizeTextSnippet(long).length).toBeLessThanOrEqual(120);
    });
  });
});
