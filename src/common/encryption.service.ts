import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly IV_LENGTH = 12;
  private readonly TAG_LENGTH = 16;
  private readonly SALT_LENGTH = 16;

  encrypt(plainText: string, masterKey: Buffer): Buffer {
    const salt = randomBytes(this.SALT_LENGTH);
    const iv = randomBytes(this.IV_LENGTH);
    const key = scryptSync(masterKey, salt, 32);

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]);
  }

  decrypt(encrypted: Buffer, masterKey: Buffer): string {
    if (
      encrypted.length <
      this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH
    ) {
      throw new Error('Invalid encrypted buffer');
    }

    let offset = 0;
    const salt = encrypted.subarray(offset, (offset += this.SALT_LENGTH));
    const iv = encrypted.subarray(offset, (offset += this.IV_LENGTH));
    const tag = encrypted.subarray(offset, (offset += this.TAG_LENGTH));
    const ciphertext = encrypted.subarray(offset);

    const key = scryptSync(masterKey, salt, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
