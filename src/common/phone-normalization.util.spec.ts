import { normalizePhone } from './phone-normalization.util';

describe('normalizePhone', () => {
  it('normalizes formatted phone number', () => {
    expect(normalizePhone('+7 (707) 300-67-89')).toBe('77073006789');
  });

  it('keeps already normalized phone number', () => {
    expect(normalizePhone('77073006789')).toBe('77073006789');
  });

  it('accepts 10 digits', () => {
    expect(normalizePhone('7073006789')).toBe('7073006789');
  });

  it('accepts 15 digits', () => {
    expect(normalizePhone('123456789012345')).toBe('123456789012345');
  });

  it('throws for 9 digits', () => {
    expect(() => normalizePhone('707300678')).toThrow(
      'Phone number must contain between 10 and 15 digits',
    );
  });

  it('throws for 16 digits', () => {
    expect(() => normalizePhone('1234567890123456')).toThrow(
      'Phone number must contain between 10 and 15 digits',
    );
  });

  it('throws for empty string', () => {
    expect(() => normalizePhone('')).toThrow(
      'Phone number must contain between 10 and 15 digits',
    );
  });

  it('throws for string without digits', () => {
    expect(() => normalizePhone('abc-+()')).toThrow(
      'Phone number must contain between 10 and 15 digits',
    );
  });

  it('ignores spaces, dashes, brackets and plus sign', () => {
    expect(normalizePhone('+7 (707) 300-67-89')).toBe('77073006789');
    expect(normalizePhone('8-800-555-35-35')).toBe('88005553535');
    expect(normalizePhone('  +7 707 300 67 89  ')).toBe('77073006789');
  });
});
