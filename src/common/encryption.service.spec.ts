import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const service = new EncryptionService();
  const masterKey = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');

  it('encrypts and decrypts a value', () => {
    const plainText = 'secret-password';
    const encrypted = service.encrypt(plainText, masterKey);
    expect(service.decrypt(encrypted, masterKey)).toBe(plainText);
  });

  it('produces different ciphertext each time', () => {
    const plainText = 'secret-password';
    const encrypted1 = service.encrypt(plainText, masterKey);
    const encrypted2 = service.encrypt(plainText, masterKey);
    expect(encrypted1.toString('hex')).not.toBe(encrypted2.toString('hex'));
  });

  it('does not return plaintext as ciphertext', () => {
    const plainText = 'secret-password';
    const encrypted = service.encrypt(plainText, masterKey);
    expect(encrypted.toString('utf8')).not.toBe(plainText);
  });

  it('fails to decrypt with a different key', () => {
    const plainText = 'secret-password';
    const encrypted = service.encrypt(plainText, masterKey);
    const otherKey = Buffer.from('fedcba9876543210fedcba9876543210', 'utf8');
    expect(() => service.decrypt(encrypted, otherKey)).toThrow();
  });

  it('fails to decrypt a corrupted buffer', () => {
    const encrypted = Buffer.from('corrupted-data', 'utf8');
    expect(() => service.decrypt(encrypted, masterKey)).toThrow();
  });
});
